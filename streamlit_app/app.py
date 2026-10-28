"""
The Enterprise Workflow & Applied Statistics Lab
================================================

A single-file Streamlit application with two jobs:

1. A live split-test simulator that walks a participant through six enterprise
   ticketing tasks (four clean baselines, a chaotic AI bot, and a primed
   documentation hunt) and captures telemetry plus survey ratings.
2. A visual statistics textbook (EDA -> hypothesis tests -> ANOVA -> regression
   -> Bayesian updating) that runs every analysis on either that live telemetry
   or a seeded benchmark dataset of 300 synthetic participants.

Run with:  streamlit run app.py
"""

import os
import random
import sys
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import statsmodels.formula.api as smf
import streamlit as st
from scipy import stats
from statsmodels.stats.anova import anova_lm
from statsmodels.stats.multicomp import pairwise_tukeyhsd
from statsmodels.stats.power import TTestIndPower

from legacy_lab.design import AI_BOT, CART_CODE, COLUMNS, JOB_LEVELS, JOB_ROLES, LEGACY, PRIMING_TEXT, TESTS
from legacy_lab.features import enrich
from legacy_lab.simulate import simulate_panel

st.set_page_config(
    page_title="Enterprise AI & Statistics Lab",
    page_icon="📊",
    layout="wide",
)

# ---------------------------------------------------------------------------
# Display constants
# ---------------------------------------------------------------------------

# Palette: validated dark-mode categorical steps (blue, orange, aqua) on a #1a1a19 surface.
PAL = dict(
    blue="#3987e5",
    orange="#d95926",
    aqua="#199e70",
    text="#f0efec",
    text2="#c3c2b7",
    muted="#8a897f",
    grid="#2e2e2c",
    surface="#1a1a19",
)
LEVEL_COLORS = dict(zip(JOB_LEVELS, [PAL["blue"], PAL["orange"], PAL["aqua"]]))
WORKFLOW_COLORS = {LEGACY: PAL["blue"], AI_BOT: PAL["orange"]}
PRIMING_COLORS = {"Unprimed": PAL["blue"], "Primed": PAL["orange"]}
PHASE_COLORS = {"Baseline (Tests 1–4)": PAL["blue"], "Chaos (Tests 5–6)": PAL["orange"]}

METRICS = {
    "completion_time": "Completion time (s)",
    "frustration": "Frustration (1–10)",
    "efficiency": "Perceived efficiency (1–10)",
    "error_count": "Errors encountered",
}

st.markdown(
    """
    <style>
    .scenario-card {border-left: 4px solid #3987e5; background: #242423; padding: 1.1rem 1.4rem;
                    border-radius: 8px; font-size: 1.08rem; line-height: 1.6; margin-bottom: 1rem;}
    .priming-banner {background: #2b2118; border: 2px solid #d95926; border-radius: 10px;
                     padding: 1rem 1.3rem; font-size: 1.25rem; font-weight: 600; color: #f0efec;
                     margin-bottom: 1rem;}
    .dense-doc {font-size: 0.82rem; color: #a9a89e; line-height: 1.45; text-align: justify;}
    .chapter-tag {color: #8a897f; font-size: 0.85rem; letter-spacing: 0.06em; text-transform: uppercase;}
    </style>
    """,
    unsafe_allow_html=True,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def style(fig, title=None, height=400):
    """Apply the lab's dark, recessive-grid chart styling."""
    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor=PAL["surface"],
        plot_bgcolor=PAL["surface"],
        font=dict(color=PAL["text2"], size=13),
        height=height,
        margin=dict(l=55, r=25, t=70 if title else 35, b=50),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, x=0, title_text=""),
        hoverlabel=dict(bgcolor="#2a2a28", font_color=PAL["text"]),
    )
    if title:
        fig.update_layout(title=dict(text=title, font=dict(color=PAL["text"], size=16)))
    fig.update_xaxes(gridcolor=PAL["grid"], zerolinecolor=PAL["grid"], linecolor=PAL["grid"])
    fig.update_yaxes(gridcolor=PAL["grid"], zerolinecolor=PAL["grid"], linecolor=PAL["grid"])
    return fig


def show(fig):
    st.plotly_chart(fig, theme=None)


@contextmanager
def guarded(label):
    """Keep one failing analysis (e.g. too little live data) from taking down the tab."""
    try:
        yield
    except Exception as exc:  # noqa: BLE001 - surface any modelling failure to the user
        st.warning(
            f"**{label}** couldn't be computed on the current data: `{exc}`. "
            "Collect more live sessions or switch to the benchmark dataset."
        )


def chapter(tag, title, body_md):
    with st.expander(f"📘 {title}", expanded=False):
        st.markdown(f"<div class='chapter-tag'>{tag}</div>", unsafe_allow_html=True)
        st.markdown(body_md)


def fmt_p(p):
    return "< 0.001" if p < 0.001 else f"{p:.3f}"


def mean_ci(series):
    s = series.dropna()
    n = len(s)
    if n < 2:
        return s.mean(), 0.0
    return s.mean(), stats.t.ppf(0.975, n - 1) * s.std(ddof=1) / np.sqrt(n)


# ---------------------------------------------------------------------------
# Benchmark synthetic data
# ---------------------------------------------------------------------------

@st.cache_data
def generate_benchmark(n=300, seed=42):
    """Benchmark dataset for the teaching tabs (see lab/simulate.py for the data-generating process)."""
    return enrich(simulate_panel(n, seed))


# ---------------------------------------------------------------------------
# Session state
# ---------------------------------------------------------------------------

def init_state():
    """The simulator is a small state machine. Streamlit reruns the whole script on
    every click, so all progress has to live in session_state:

        step 0 (intro) -> step 1..6 [phase "task" -> phase "survey"] -> step 7 (done)
    """
    ss = st.session_state
    ss.setdefault("telemetry", [])     # one dict per completed test, across all participants
    ss.setdefault("step", 0)           # 0 = intro, 1..6 = tests, 7 = finished
    ss.setdefault("phase", "task")     # task | survey
    ss.setdefault("participant", None) # demographics + id + randomised arm
    ss.setdefault("t_start", None)     # wall-clock start of the current test
    ss.setdefault("errors", 0)         # validation / fake-UI errors in the current test
    ss.setdefault("attempts", 0)       # Test 5 submissions, also seeds its chaos
    ss.setdefault("pending", None)     # task result waiting for its survey answers
    ss.setdefault("flash", None)       # error message that must survive one st.rerun()


IN_BROWSER = sys.platform == "emscripten"  # running under stlite / Pyodide

# Every completed test is appended here so data survives across browser sessions
# and participants. Override with LAB_DATA_PATH; set it to "" to disable writing.
DATA_PATH = os.environ.get("LAB_DATA_PATH", str(Path(__file__).parent / "data" / "raw" / "live_sessions.csv"))


def persist_row(row):
    if not DATA_PATH:
        return
    try:
        path = Path(DATA_PATH)
        path.parent.mkdir(parents=True, exist_ok=True)
        pd.DataFrame([row], columns=COLUMNS).to_csv(path, mode="a", header=not path.exists(), index=False)
    except OSError as exc:
        # Read-only hosts (e.g. some cloud deployments) can't write; the sidebar
        # CSV download is the fallback.
        st.toast(f"Couldn't save to {DATA_PATH}: {exc}. Use the sidebar download instead.")


def assign_arm():
    """Permuted-block randomisation (blocks of 4: two primed, two control).

    With the small samples a class study gets, simple coin flips can easily give
    a 60/40 split. Blocks keep the arms balanced after every 4 participants. The
    position in the sequence is the number of participants already saved.
    """
    k = 0
    if DATA_PATH and Path(DATA_PATH).exists():
        try:
            k = pd.read_csv(DATA_PATH, usecols=["participant_id"])["participant_id"].nunique()
        except (OSError, ValueError, pd.errors.EmptyDataError):
            k = 0
    block = [0, 0, 1, 1]
    random.Random(f"block-{k // 4}").shuffle(block)
    return block[k % 4]


def live_dataframe():
    """Everyone's sessions: the shared CSV every participant on this server appends to,
    plus this browser's own rows (in case the file couldn't be written)."""
    frames = []
    if DATA_PATH and Path(DATA_PATH).exists():
        try:
            frames.append(pd.read_csv(DATA_PATH))
        except (OSError, ValueError, pd.errors.EmptyDataError):
            pass
    if st.session_state.telemetry:
        frames.append(pd.DataFrame(st.session_state.telemetry))
    if not frames:
        return pd.DataFrame()
    df = pd.concat(frames, ignore_index=True).drop_duplicates(["participant_id", "test_num"], keep="first")
    return enrich(df)


init_state()
ss = st.session_state


# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------

with st.sidebar:
    st.title("Enterprise AI & Statistics Lab")
    st.caption("Split-testing legacy ticketing against an AI bot, with a full applied-statistics textbook attached.")
    source = st.radio(
        "Analysis data source",
        ["Use Live Session Telemetry", "Use Benchmark Synthetic Data (N=300)"],
        help="Live = every participant who has used this server since it last restarted.",
        index=1,
    )
    live_df = live_dataframe()
    n_live = live_df["participant_id"].nunique() if not live_df.empty else 0
    c1, c2 = st.columns(2)
    c1.metric("Live participants", n_live)
    c2.metric("Live test rows", len(live_df))
    if not live_df.empty:
        st.download_button(
            "⬇️ Download live telemetry (CSV)",
            live_df.to_csv(index=False).encode(),
            "live_telemetry.csv",
            "text/csv",
        )
    if st.button("🔃 Refresh class data"):
        st.rerun()
    if st.button("🔄 Reset my session"):
        for key in list(ss.keys()):
            del ss[key]
        st.rerun()
    st.divider()
    st.caption(
        # The GitHub Pages build runs this app inside each visitor's browser (stlite), so there
        # is no shared server file there: "live" means this browser only.
        "This in-browser version keeps live data in this browser tab only. Download the CSV to keep it."
        if IN_BROWSER else
        "Live data pools everyone using this server, but it is wiped when the server restarts. "
        "Download the CSV after your session to keep it."
    )

bench_df = generate_benchmark()
using_live = source.startswith("Use Live") and not live_df.empty
df = live_df if using_live else bench_df

st.title("The Enterprise Workflow & Applied Statistics Lab")
if source.startswith("Use Live") and live_df.empty:
    st.info(
        "No live telemetry yet, so the analysis tabs are showing the **benchmark dataset**. "
        "Complete the simulator in Tab 1 to analyse your own session."
    )
elif using_live:
    st.caption(
        f"Analysing **live telemetry**: {n_live} participant(s), {len(live_df)} rows. "
        "Small samples make several models unstable, which is itself a lesson."
    )
else:
    st.caption("Analysing the **benchmark dataset**: 300 synthetic participants × 6 tests, seed 42.")

tabs = st.tabs([
    "🧪 1 · Live Simulator",
    "📊 2 · EDA & Demographics",
    "⚖️ 3 · Hypothesis Testing",
    "🧮 4 · Two-Way ANOVA",
    "📈 5 · Regression",
    "🧠 6 · Bayes & Manifesto",
])


# ---------------------------------------------------------------------------
# Tab 1 - The live experiment simulator
# ---------------------------------------------------------------------------

# Clean baseline forms: (kind, label, options, default index)
CLEAN_FORMS = {
    1: [
        ("text", "Username / Employee ID", None, None),
        ("select", "Affected system", ["Active Directory", "SAP", "Salesforce", "Workday"], None),
        ("radio", "Urgency", ["Low", "Medium", "High"], None),
    ],
    2: [
        ("select", "Software", ["Figma", "Tableau", "JetBrains All Products", "Adobe Creative Cloud"], None),
        ("text", "Cost center code (e.g. CC-4410)", None, None),
        ("area", "Business justification", None, None),
    ],
    3: [
        ("area", "Tell Nova what you need", None, None),
        ("select", "Nova's suggested category", ["Network › VPN Access", "Network › Wi-Fi", "Security › MFA"], 0),
    ],
    4: [
        ("area", "Tell Nova what you need", None, None),
        ("select", "Nova's suggested category", ["Hardware › Laptop Replacement", "Hardware › Monitor", "Hardware › Peripherals"], 0),
        ("radio", "Delivery location", ["Office desk", "Home address on file"], 0),
    ],
}

BOT_GREETINGS = {
    3: "Hi! I'm **Nova**, your IT assistant. I've already detected you're on the corporate network and pre-filled the category.",
    4: "Welcome back! I've pulled your asset record (MBP-2021-0442) and pre-selected a replacement category.",
}

CHAOS_REPLIES = [
    "Great question! Have you considered that the outage might be a feature?",
    "I've analysed your request and determined it is a request. Please clarify the request.",
    "Based on synergy vectors, I recommend rebooting the cloud.",
    "I'm 87% confident this relates to printers. Or possibly DNS. It's always DNS.",
    "Your ticket has been categorised as 'Vibes › Unclear'. Would you like to escalate to a different AI?",
    "Per policy, I can't help with production outages, but I can write you a haiku about one.",
]
HALLUCINATED = [
    "Quantum Printer Calibration",
    "Blockchain › Mood Ledger",
    "Cloud › Weather (Actual Clouds)",
    "Synergy › Paradigm Shift Request",
    "Hardware › Emotional Support Monitor",
    "Network › Vibe Check",
    "AI › Ask Another AI",
    "Facilities › Ceiling Bandwidth",
]
CHAOS_CORRECT = "Incident › Production Outage (Sev 1)"
CHAOS_ERRORS = [
    "⚠️ Error 503: Nova's context window overflowed. Please re-enter your request.",
    "🤖 Nova: I've escalated this to Tier 3… wait, I've un-escalated it. Please resubmit.",
    "TypeError: undefined is not a ticket (at nova.js:4471)",
    "Session token hallucinated. Please try again.",
]


def finish_task(rage_quit=False):
    """Stop the clock and hand the result to the survey phase. The row is only
    written to telemetry after the survey, so every row has ratings."""
    ss.pending = dict(
        completion_time=round(time.time() - ss.t_start, 1),
        error_count=ss.errors,
        rage_quit=int(rage_quit),
    )
    ss.phase = "survey"
    st.rerun()


def abandon_button(test_num, prominent=False):
    label = "🏳️ Abandon Ticket / I Give Up"
    key = f"{ss.participant['id']}_abandon_{test_num}"
    if prominent:
        clicked = st.button(label, type="primary", key=key)
    else:
        clicked = st.button(label, key=key, help="Logs this test as a rage-quit.")
    if clicked:
        finish_task(rage_quit=True)


def render_clean_test(test_num):
    """Tests 1-4: ordinary, well-behaved forms. Widget keys include the participant
    id so the next participant starts with blank fields."""
    pid = ss.participant["id"]
    if test_num in BOT_GREETINGS:
        st.chat_message("assistant").markdown(BOT_GREETINGS[test_num])
    with st.form(f"{pid}_form_{test_num}"):
        values = []
        for i, (kind, label, options, default) in enumerate(CLEAN_FORMS[test_num]):
            key = f"{pid}_t{test_num}_f{i}"
            if kind == "text":
                values.append(st.text_input(label, key=key))
            elif kind == "area":
                values.append(st.text_area(label, key=key, height=90))
            elif kind == "select":
                values.append(st.selectbox(label, options, index=default, key=key, placeholder="Choose…"))
            elif kind == "radio":
                values.append(st.radio(label, options, index=default, key=key, horizontal=True))
        submitted = st.form_submit_button("Submit ticket", type="primary")
    if submitted:
        if any(v in (None, "") for v in values):
            ss.errors += 1
            st.error("Validation failed: every field is required.")
        else:
            finish_task()
    abandon_button(test_num)


def render_chaos_bot():
    """Test 5: a half-broken AI assistant. It gives vague replies, hallucinates
    subcategories, offers nonsense priorities and throws fake errors."""
    pid = ss.participant["id"]
    # The RNG is seeded per attempt so options stay stable while the user is
    # choosing (a reshuffle on every rerun would make the form unusable). They
    # reshuffle, and the hallucinations rotate, after each failed submission.
    rng = random.Random(f"{pid}-{ss.attempts}")
    st.chat_message("assistant").markdown(
        "Hi, I'm **Nova 2.0 (beta)** ✨ — now with *generative categorisation*! " + rng.choice(CHAOS_REPLIES)
    )
    options = rng.sample(HALLUCINATED, 5) + [CHAOS_CORRECT]
    rng.shuffle(options)
    priority_opts = rng.sample(["P1", "Urgent-ish", "P∞", "Medium Rare", "P0.5", "Whenever"], 4)
    with st.form(f"{pid}_form_5_{ss.attempts}"):
        desc = st.text_area("Describe the production outage to Nova", key=f"{pid}_t5_desc", height=90)
        sub = st.selectbox("Subcategory (AI-generated)", options, index=None, placeholder="Nova is thinking…")
        st.radio("Priority (Nova-suggested)", priority_opts, horizontal=True)
        submitted = st.form_submit_button("Send to Nova", type="primary")
    # Errors are stored and shown after st.rerun() because the rerun is what
    # rebuilds the form with freshly shuffled options.
    if ss.flash:
        st.error(ss.flash)
        ss.flash = None
    if submitted:
        ss.attempts += 1
        # Order of checks: missing input, then a hallucinated category, then a random
        # fake outage. Fake outages stop after 3 attempts so the test is always
        # winnable for anyone who persists.
        if not desc or sub is None:
            ss.errors += 1
            ss.flash = "Nova: I can't categorise silence. Please describe the issue and pick a subcategory."
            st.rerun()
        elif sub != CHAOS_CORRECT:
            ss.errors += 1
            ss.flash = f"Nova: '{sub}' isn't a real category in this universe. Ticket rejected."
            st.rerun()
        elif ss.attempts < 4 and rng.random() < 0.65:
            ss.errors += 1
            ss.flash = rng.choice(CHAOS_ERRORS)
            st.rerun()
        else:
            finish_task()
    abandon_button(5)


DENSE_FILLER = (
    "In accordance with the Unified Request Fulfilment Framework (URFF) and subject to the governance "
    "provisions of Annex 14(c), all service interactions shall be classified, triaged, and routed through "
    "the appropriate assignment group as defined in the Configuration Management Database, except where "
    "superseded by regional addenda, change-freeze windows, or ad-hoc executive exceptions logged under "
    "the Exception Register (see KB0009921, KB0011004, and the deprecated KB0003318). Requesters are "
    "reminded that SLA clocks commence upon validated categorisation rather than submission, and that "
    "partially completed records are auto-archived after 72 business hours. "
)


def render_doc_hunt():
    """Test 6: the form has no submit button. Users must scroll past the filler, open
    the KB article and spot the cart code (paragraph 1.3), then check out from
    inside the article. Plain widgets are used instead of st.form, because a form
    must have a submit button."""
    pid = ss.participant["id"]
    st.markdown("#### 🎥 Request: Conference Room AV setup for the 5:00 PM board call")
    abandon_button(6, prominent=True)
    st.selectbox("Request type", ["Facilities", "AV / Conferencing", "General Inquiry"], index=None,
                 key=f"{pid}_t6_type", placeholder="Choose…")
    st.text_input("Room number", key=f"{pid}_t6_room")
    st.text_area("Describe your request", key=f"{pid}_t6_desc", height=90)
    st.caption("ℹ️ For your convenience, the submission process has been streamlined. See documentation below.")
    st.markdown(
        "<div class='dense-doc'>" + "".join(
            f"<p><b>§{i}.</b> {DENSE_FILLER}</p>" for i in range(1, 7)
        ) + "</div>",
        unsafe_allow_html=True,
    )
    with st.expander("📎 KB0012847 — Unified Request Fulfilment Procedures (Rev. 47) · documentation link"):
        st.markdown(
            "<div class='dense-doc'>"
            f"<p><b>1.1 Scope.</b> {DENSE_FILLER}</p>"
            f"<p><b>1.2 Definitions.</b> {DENSE_FILLER}</p>"
            "<p><b>1.3 Submission.</b> Pursuant to the platform consolidation initiative, discrete request "
            "forms no longer transmit records directly. Requesters must instead add the item to the Service "
            "Catalog Shopping Cart by entering the cart reference code CART-7781 in the Cart Reference field "
            "below and proceeding to checkout, after which the record is created in a pending-approval state "
            f"and routed per Annex 14(c). {DENSE_FILLER}</p>"
            f"<p><b>1.4 Exceptions.</b> {DENSE_FILLER}</p>"
            "</div>",
            unsafe_allow_html=True,
        )
        code = st.text_input("Cart Reference", key=f"{pid}_t6_code")
        if st.button("🛒 Proceed to Checkout", key=f"{pid}_t6_checkout"):
            filled = all(ss.get(f"{pid}_t6_{k}") for k in ("type", "room", "desc"))
            if code.strip().upper() != CART_CODE:
                ss.errors += 1
                st.error("Checkout failed: invalid cart reference. Please consult the documentation.")
            elif not filled:
                ss.errors += 1
                st.error("Checkout failed: the request form above is incomplete.")
            else:
                finish_task()


def render_survey(test_num):
    pid = ss.participant["id"]
    res = ss.pending
    if res["rage_quit"]:
        st.warning(f"Ticket abandoned after **{res['completion_time']:.1f}s**. Logged as a rage-quit.")
    else:
        st.success(f"Test {test_num} complete in **{res['completion_time']:.1f}s** with {res['error_count']} error(s).")
    with st.form(f"{pid}_survey_{test_num}"):
        st.markdown("**Quick pulse check**")
        frust = st.slider("Frustration (1 = calm, 10 = rage)", 1, 10, 5)
        eff = st.slider("Perceived system efficiency (1 = useless, 10 = flawless)", 1, 10, 5)
        label = "Finish the grind 🏁" if test_num == 6 else f"On to Test {test_num + 1} →"
        nxt = st.form_submit_button(label, type="primary")
    if nxt:
        p = ss.participant
        meta = TESTS[test_num]
        # Priming exposure is per row: primed-arm participants only see a banner on
        # chaos tests, so their baseline rows count as unprimed.
        primed = int(p["primed_arm"] and meta["chaos"])
        row = dict(
            participant_id=p["id"],
            source="live",
            submitted_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            years_experience=p["years"],
            job_level=p["level"],
            job_role=p["role"],
            primed_arm=p["primed_arm"],
            test_num=test_num,
            test_name=meta["name"],
            workflow=meta["workflow"],
            workflow_chaos=meta["chaos"],
            priming_exposed=primed,
            completion_time=res["completion_time"],
            error_count=res["error_count"],
            rage_quit=res["rage_quit"],
            frustration=frust,
            efficiency=eff,
        )
        ss.telemetry.append(row)
        persist_row(row)
        ss.step += 1
        ss.phase = "task"
        ss.t_start = None
        ss.errors = 0
        ss.attempts = 0
        ss.pending = None
        st.rerun()


with tabs[0]:
    if ss.step == 0:
        st.subheader("Phase 1 · The Scenario")
        st.markdown(
            "<div class='scenario-card'><b>The Scenario:</b> <i>“You are a Project Lead at a fast-growing "
            "tech firm. It’s 4:45 PM on a Friday, and you must log 6 urgent IT/System requests before "
            "end-of-day. Your goal: Survive the enterprise ticketing system and get your tickets resolved "
            "as fast as possible.”</i></div>",
            unsafe_allow_html=True,
        )
        st.markdown("**Optional demographics** (recommended for science, every field can be skipped)")
        with st.form("demographics"):
            c1, c2, c3 = st.columns(3)
            years = c1.number_input("Years of experience (25 = 25+)", 0, 25, value=None, step=1)
            level = c2.selectbox("Job level", JOB_LEVELS, index=None, placeholder="Prefer not to say")
            role = c3.selectbox("Job role", JOB_ROLES, index=None, placeholder="Prefer not to say")
            consent = st.checkbox(
                "I agree to take part. I understand my anonymous timings, ratings and optional demographics "
                "will be recorded for a class research project, and that I can stop at any time."
            )
            start = st.form_submit_button("🚀 Start the 4:45 PM grind", type="primary")
        # Neutral wording on purpose: telling participants about the priming
        # manipulation up front would contaminate it. They are debriefed at the end.
        st.caption("No names or contact details are collected. The study takes about 10 minutes.")
        if start and not consent:
            st.error("Please tick the consent box to begin.")
        elif start:
            ss.participant = dict(
                id=f"LIVE-{uuid.uuid4().hex[:6].upper()}",
                years=years,
                level=level,
                role=role,
                primed_arm=assign_arm(),
            )
            ss.step = 1
            st.rerun()

    elif 1 <= ss.step <= 6:
        t = ss.step
        meta = TESTS[t]
        st.progress((t - 1) / 6, text=f"Test {t} of 6 · {meta['workflow']}")
        st.subheader(f"Test {t} · {meta['name']}")
        if ss.phase == "task":
            if ss.participant["primed_arm"] and t in PRIMING_TEXT:
                st.markdown(f"<div class='priming-banner'>📣 {PRIMING_TEXT[t]}</div>", unsafe_allow_html=True)
            # The clock starts the first time the test page renders and survives
            # the reruns triggered by typing and clicking within the test.
            if ss.t_start is None:
                ss.t_start = time.time()
            if t <= 4:
                render_clean_test(t)
            elif t == 5:
                render_chaos_bot()
            else:
                render_doc_hunt()
        else:
            render_survey(t)

    else:
        st.subheader("🏁 You survived Friday at 4:45 PM")
        mine = live_df[live_df["participant_id"] == ss.participant["id"]]
        bench_median = bench_df.groupby("test_num")["completion_time"].median()
        summary = mine[["test_num", "test_name", "completion_time", "error_count", "rage_quit", "frustration", "efficiency"]].copy()
        summary["benchmark_median_time"] = summary["test_num"].map(bench_median).round(1)
        st.dataframe(summary, hide_index=True)
        arm = "primed" if ss.participant["primed_arm"] else "control"
        st.info(
            "**Debrief.** Thank you for taking part. This study tested whether a short marketing-style "
            "statement (*“ServiceNow’s single pane of glass is incredibly efficient”*) changes how efficient "
            "people *rate* a system, even when their own experience of it is poor. Half of participants saw "
            f"that banner and half didn't. You were in the **{arm}** group. Test 6 was deliberately hard: "
            "the submit button was hidden in the documentation. Please don't tell future participants "
            "about the banner until data collection is finished."
        )
        st.caption("Switch the sidebar to live telemetry to analyse your session.")
        if st.button("➕ Run another participant", type="primary"):
            ss.step = 0
            ss.participant = None
            st.rerun()


# ---------------------------------------------------------------------------
# Tab 2 - EDA & demographics (Chapters 1 & 2)
# ---------------------------------------------------------------------------

with tabs[1]:
    st.header("Exploratory Data Analysis & Demographics")
    chapter("Chapters 1 & 2", "Describing a distribution: centre, spread, shape", r"""
The **mean** $\bar x = \frac{1}{n}\sum x_i$ is the balance point of the data, so a handful of very
slow tickets pull it to the right. The **median** is the 50th percentile and doesn't care how far
the extreme values go.

Spread is measured by the **standard deviation** $s=\sqrt{\frac{1}{n-1}\sum (x_i-\bar x)^2}$ and
the outlier-resistant **IQR** $= Q_3 - Q_1$. **Skewness**
$g_1 = \frac{\frac{1}{n}\sum (x_i-\bar x)^3}{s^3}$ tells you which way the tail points: positive
means a long right tail, where mean > median.

Watch Tests 5 and 6. A few participants who fight the chaos bot or the documentation hunt for
minutes on end stretch the right tail, so the mean overstates what a typical user experiences.
""")

    k1, k2, k3, k4 = st.columns(4)
    base = df[df["workflow_chaos"] == 0]
    chaos = df[df["workflow_chaos"] == 1]
    k1.metric("Participants", df["participant_id"].nunique())
    k2.metric("Median time · baseline", f"{base['completion_time'].median():.0f}s" if len(base) else "–")
    k3.metric("Median time · chaos", f"{chaos['completion_time'].median():.0f}s" if len(chaos) else "–")
    k4.metric("Rage-quit rate · chaos", f"{chaos['rage_quit'].mean():.0%}" if len(chaos) else "–")

    with guarded("Descriptive statistics"):
        g = df.groupby(["test_num", "test_label"])["completion_time"]
        desc = pd.DataFrame({
            "n": g.size(),
            "Mean": g.mean(),
            "Median": g.median(),
            "Std Dev": g.std(),
            "IQR": g.quantile(0.75) - g.quantile(0.25),
            "Skewness": g.apply(lambda s: stats.skew(s, bias=False) if len(s) > 2 else np.nan),
        }).reset_index()
        desc["Mean − Median"] = desc["Mean"] - desc["Median"]
        st.dataframe(desc.drop(columns="test_num").round(2), hide_index=True)

        fig = go.Figure()
        for _, r in desc.iterrows():
            fig.add_trace(go.Scatter(
                x=[r["Median"], r["Mean"]], y=[r["test_label"]] * 2, mode="lines",
                line=dict(color=PAL["muted"], width=2), showlegend=False, hoverinfo="skip",
            ))
        fig.add_trace(go.Scatter(
            x=desc["Median"], y=desc["test_label"], mode="markers", name="Median",
            marker=dict(size=12, color=PAL["blue"], line=dict(color=PAL["surface"], width=2)),
            hovertemplate="%{y}<br>Median %{x:.1f}s<extra></extra>",
        ))
        fig.add_trace(go.Scatter(
            x=desc["Mean"], y=desc["test_label"], mode="markers", name="Mean",
            marker=dict(size=12, color=PAL["orange"], line=dict(color=PAL["surface"], width=2)),
            hovertemplate="%{y}<br>Mean %{x:.1f}s<extra></extra>",
        ))
        fig.update_yaxes(autorange="reversed")
        fig.update_xaxes(title="Completion time (s)")
        show(style(fig, "The right tail drags the mean away from the median", 360))

    with guarded("Distribution view"):
        pick = st.selectbox("Inspect one test's distribution", list(TESTS), index=5,
                            format_func=lambda t: f"Test {t} · {TESTS[t]['name']}")
        sub = df[df["test_num"] == pick]
        fig = px.histogram(sub, x="completion_time", nbins=40, color_discrete_sequence=[PAL["blue"]])
        fig.update_traces(marker_line_color=PAL["surface"], marker_line_width=1)
        for val, name, color in [(sub["completion_time"].mean(), "Mean", PAL["orange"]),
                                 (sub["completion_time"].median(), "Median", PAL["text"])]:
            fig.add_vline(x=val, line=dict(color=color, width=2, dash="dash"),
                          annotation_text=f"{name} {val:.0f}s", annotation_font_color=PAL["text2"])
        fig.update_layout(xaxis_title="Completion time (s)", yaxis_title="Participants")
        show(style(fig, f"Test {pick}: completion-time histogram", 360))

    st.subheader("Demographic splits")
    demo = df.dropna(subset=["job_level"])
    if demo.empty:
        st.info("No demographic answers in this dataset yet. Participants skipped the optional form.")
    else:
        with guarded("Demographic plots"):
            c1, c2 = st.columns(2)
            with c1:
                fig = px.box(demo, x="test_label", y="completion_time", color="job_level",
                             color_discrete_map=LEVEL_COLORS, category_orders={"job_level": JOB_LEVELS})
                fig.update_layout(xaxis_title="", yaxis_title="Completion time (s)")
                show(style(fig, "Completion time by test and job level", 420))
            with c2:
                fig = px.box(demo.dropna(subset=["exp_bucket"]), x="exp_bucket", y="frustration", color="phase",
                             color_discrete_map=PHASE_COLORS)
                fig.update_layout(xaxis_title="Years of experience", yaxis_title="Frustration (1–10)")
                show(style(fig, "Frustration by experience: baseline vs chaos", 420))

            fig = px.histogram(demo[demo["workflow_chaos"] == 1], x="frustration", color="job_level",
                               facet_col="job_level", nbins=10, histnorm="percent",
                               color_discrete_map=LEVEL_COLORS, category_orders={"job_level": JOB_LEVELS})
            fig.update_traces(marker_line_color=PAL["surface"], marker_line_width=1)
            fig.for_each_annotation(lambda a: a.update(text=a.text.split("=")[-1]))
            fig.update_layout(showlegend=False, yaxis_title="% of chaos-test rows")
            fig.update_xaxes(title="Frustration")
            show(style(fig, "Frustration on the chaos tests, by job level", 340))


# ---------------------------------------------------------------------------
# Tab 3 - Hypothesis testing & assumptions (Chapters 3, 4, 6)
# ---------------------------------------------------------------------------

# Each comparison returns (group A rows, group B rows, label A, label B, caveat).
# The between-subjects comparisons come first because they suit independent-samples
# tests. The pooled ones carry a caveat about repeated measures.
COMPARISONS = {
    "Test 6 · Primed vs Control arm": lambda d: (
        d[(d.test_num == 6) & (d.primed_arm == 1)], d[(d.test_num == 6) & (d.primed_arm == 0)],
        "Primed", "Control", None),
    "Test 5 · Primed vs Control arm": lambda d: (
        d[(d.test_num == 5) & (d.primed_arm == 1)], d[(d.test_num == 5) & (d.primed_arm == 0)],
        "Primed", "Control", None),
    "Test 6 · Director/Executive vs IC/Associate": lambda d: (
        d[(d.test_num == 6) & (d.job_level == JOB_LEVELS[2])], d[(d.test_num == 6) & (d.job_level == JOB_LEVELS[0])],
        "Directors", "ICs", None),
    "Chaos (Tests 5–6) vs Baseline (Tests 1–4)": lambda d: (
        d[d.workflow_chaos == 1], d[d.workflow_chaos == 0], "Chaos", "Baseline",
        "Each participant contributes to both groups, so a paired design would be more appropriate. "
        "It's included here to show how independent-samples tests behave on heavy-tailed data."),
    "AI Bot vs Legacy workflow (all tests)": lambda d: (
        d[d.workflow == AI_BOT], d[d.workflow == LEGACY], "AI Bot", "Legacy",
        "Within-subject comparison treated as independent, for illustration."),
}

with tabs[2]:
    st.header("Hypothesis Testing & Assumptions")
    chapter("Chapters 3, 4 & 6", "From a question to a p-value", r"""
A hypothesis test asks: *if there were truly no difference ($H_0$), how surprising is what we saw?*

The two-sample **t statistic** measures the gap between means in units of its standard error:
$$t=\frac{\bar x_A-\bar x_B}{\sqrt{s_A^2/n_A+s_B^2/n_B}}$$

Which test is valid depends on its assumptions:

* **Normality** of each group, checked with Shapiro–Wilk ($H_0$: data are normal).
* **Equal variances**, checked with Levene ($H_0$: variances are equal).

Both hold → **Student's t**. Normal but unequal spread → **Welch's t** (adjusted degrees of freedom).
Not normal → the rank-based **Mann–Whitney U**, which compares whole distributions without
assuming a shape.

A **one-sided** test puts all of $\alpha$ in one tail, so it has more power *if* you committed to
the direction before seeing the data. The shaded area under the curve below *is* the p-value.
""")

    c1, c2, c3 = st.columns([2, 1.3, 1.3])
    comp = c1.selectbox("Comparison", list(COMPARISONS))
    metric = c2.selectbox("Outcome", list(METRICS), format_func=METRICS.get, index=1)
    alpha = c3.select_slider("Significance level α", [0.01, 0.025, 0.05, 0.10], value=0.05)
    a_df, b_df, la, lb, caveat = COMPARISONS[comp](df)
    direction = st.radio(
        "Alternative hypothesis",
        ["two-sided", "greater", "less"],
        horizontal=True,
        format_func=lambda x: {"two-sided": f"Two-sided: {la} ≠ {lb}",
                               "greater": f"One-sided: {la} > {lb}",
                               "less": f"One-sided: {la} < {lb}"}[x],
    )
    if caveat:
        st.caption(f"⚠️ {caveat}")

    a, b = a_df[metric].dropna().to_numpy(float), b_df[metric].dropna().to_numpy(float)
    effect_d = None
    if len(a) < 3 or len(b) < 3:
        st.warning(f"Need at least 3 observations per group (have {len(a)} and {len(b)}). "
                   "Collect more live data or switch to the benchmark dataset.")
    else:
        with guarded("Hypothesis test"):
            # Shapiro-Wilk's p-value is only reliable up to n = 5000, so larger
            # samples are truncated. All three tests are computed so the table can
            # show what the diagnostics chose against what they rejected.
            sh_a = stats.shapiro(a[:5000])
            sh_b = stats.shapiro(b[:5000])
            lev = stats.levene(a, b)
            normal = sh_a.pvalue > alpha and sh_b.pvalue > alpha
            equal_var = lev.pvalue > alpha
            student = stats.ttest_ind(a, b, equal_var=True, alternative=direction)
            welch = stats.ttest_ind(a, b, equal_var=False, alternative=direction)
            mwu = stats.mannwhitneyu(a, b, alternative=direction)
            # Decision rule: both normal and equal variance -> Student; normal but
            # unequal variance -> Welch; any group non-normal -> Mann-Whitney U.
            chosen = ("Student's t-test" if normal and equal_var
                      else "Welch's t-test" if normal else "Mann–Whitney U")
            # Cohen's d with pooled SD. It also seeds the power-analysis slider below.
            pooled =np.sqrt(((len(a) - 1) * a.var(ddof=1) + (len(b) - 1) * b.var(ddof=1)) / (len(a) + len(b) - 2))
            effect_d = (a.mean() - b.mean()) / pooled if pooled > 0 else 0.0

            st.subheader("Step 1 · Assumption checks")
            d1, d2, d3 = st.columns(3)
            d1.metric(f"Shapiro–Wilk · {la}", f"p = {fmt_p(sh_a.pvalue)}",
                      "normal" if sh_a.pvalue > alpha else "not normal", delta_color="off")
            d2.metric(f"Shapiro–Wilk · {lb}", f"p = {fmt_p(sh_b.pvalue)}",
                      "normal" if sh_b.pvalue > alpha else "not normal", delta_color="off")
            d3.metric("Levene (equal variance)", f"p = {fmt_p(lev.pvalue)}",
                      "equal" if equal_var else "unequal", delta_color="off")

            st.subheader("Step 2 · Automated test selection")
            st.markdown(f"Diagnostics select **{chosen}**.")
            results = pd.DataFrame([
                ["Student's t-test", f"t = {student.statistic:.3f}", fmt_p(student.pvalue)],
                ["Welch's t-test", f"t = {welch.statistic:.3f}", fmt_p(welch.pvalue)],
                ["Mann–Whitney U", f"U = {mwu.statistic:.0f}", fmt_p(mwu.pvalue)],
            ], columns=["Test", "Statistic", "p-value"])
            results.insert(0, "Selected", results["Test"].eq(chosen).map({True: "✅", False: ""}))
            st.dataframe(results, hide_index=True)
            chosen_p = {"Student's t-test": student.pvalue, "Welch's t-test": welch.pvalue,
                        "Mann–Whitney U": mwu.pvalue}[chosen]
            verdict = "reject H₀" if chosen_p < alpha else "fail to reject H₀"
            st.markdown(
                f"**{la}** mean {a.mean():.2f} (n={len(a)}) vs **{lb}** mean {b.mean():.2f} (n={len(b)}) · "
                f"Cohen's d = {effect_d:.2f} · p = {fmt_p(chosen_p)} → **{verdict}** at α = {alpha}."
            )

            st.subheader("Step 3 · See the p-value")
            # Draw the null t distribution for the chosen t-test (Welch stands in for
            # Mann-Whitney) and shade the tail(s) beyond the observed statistic. That
            # shaded area is exactly the p-value.
            use_student = chosen == "Student's t-test"
            t_obs = student.statistic if use_student else welch.statistic
            if use_student:
                dof = len(a) + len(b) - 2
            else:
                # Welch-Satterthwaite approximation for the degrees of freedom.
                va, vb = a.var(ddof=1) / len(a), b.var(ddof=1) / len(b)
                dof = (va + vb) ** 2 / (va ** 2 / (len(a) - 1) + vb ** 2 / (len(b) - 1))
            span = max(4.5, abs(t_obs) + 1)
            xs = np.linspace(-span, span, 800)
            ys = stats.t.pdf(xs, dof)
            if direction == "two-sided":
                mask = np.abs(xs) >= abs(t_obs)
                crit = [stats.t.ppf(1 - alpha / 2, dof), -stats.t.ppf(1 - alpha / 2, dof)]
            elif direction == "greater":
                mask = xs >= t_obs
                crit = [stats.t.ppf(1 - alpha, dof)]
            else:
                mask = xs <= t_obs
                crit = [stats.t.ppf(alpha, dof)]
            fig = go.Figure()
            fig.add_trace(go.Scatter(x=xs, y=ys, mode="lines", name=f"t distribution under H₀ (df={dof:.1f})",
                                     line=dict(color=PAL["blue"], width=2)))
            fig.add_trace(go.Scatter(x=xs, y=np.where(mask, ys, np.nan), mode="lines", fill="tozeroy",
                                     name="p-value region", line=dict(color=PAL["orange"], width=0),
                                     fillcolor="rgba(217,89,38,0.55)", hoverinfo="skip", connectgaps=False))
            fig.add_vline(x=t_obs, line=dict(color=PAL["text"], width=2),
                          annotation_text=f"observed t = {t_obs:.2f}", annotation_font_color=PAL["text"])
            for cv in crit:
                fig.add_vline(x=cv, line=dict(color=PAL["muted"], width=1.5, dash="dot"),
                              annotation_text=f"critical {cv:.2f}", annotation_position="bottom right",
                              annotation_font_color=PAL["muted"])
            test_name = "Student" if use_student else "Welch"
            p_t = student.pvalue if use_student else welch.pvalue
            fig.update_layout(xaxis_title="t", yaxis_title="Density")
            show(style(fig, f"{test_name} t-test, {direction}: shaded area = p = {fmt_p(p_t)}", 380))
            if chosen == "Mann–Whitney U":
                st.caption("The selected test is Mann–Whitney U. The curve shows the Welch t-test for intuition; "
                           "use the Mann–Whitney p-value above for inference.")

            fig = go.Figure()
            for vals, name, color in [(a, la, PAL["orange"]), (b, lb, PAL["blue"])]:
                fig.add_trace(go.Histogram(x=vals, name=name, marker_color=color, opacity=0.6,
                                           histnorm="probability density", nbinsx=30))
            fig.update_layout(barmode="overlay", xaxis_title=METRICS[metric], yaxis_title="Density")
            show(style(fig, "The two samples being compared", 320))

    st.subheader("Power analysis")
    chapter("Chapter 6", "Power: the probability of catching a real effect", r"""
**Power** $=1-\beta$ is the chance a test rejects $H_0$ when a true effect of size
$d=\frac{\mu_A-\mu_B}{\sigma}$ exists. It rises with effect size, with sample size, and with a looser
$\alpha$. The usual target is 80%. Cohen's benchmarks are small $d=0.2$, medium $0.5$ and large $0.8$.
""")
    p1, p2, p3 = st.columns(3)
    d_default = float(np.clip(abs(effect_d), 0.05, 1.5)) if effect_d is not None else 0.5
    d_sel = p1.slider("Effect size d", 0.05, 1.5, round(d_default, 2), 0.05,
                      help="Defaults to the observed |Cohen's d| from the comparison above.")
    alpha_p = p2.select_slider("α (power)", [0.01, 0.025, 0.05, 0.10], value=alpha)
    n_sel = p3.slider("Sample size per group n", 5, 500, 64, 1)
    # statsmodels names one-sided alternatives "larger"/"smaller" relative to the sign
    # of d. Because the slider holds |d|, both one-sided directions map to "larger".
    alt_map = {"two-sided": "two-sided", "greater": "larger", "less": "larger"}
    with guarded("Power analysis"):
        analysis = TTestIndPower()
        ns = np.arange(5, 501)
        fig = go.Figure()
        for d_ref in (0.2, 0.5, 0.8):
            fig.add_trace(go.Scatter(
                x=ns, y=analysis.power(d_ref, ns, alpha_p, alternative=alt_map[direction]),
                mode="lines", name=f"d = {d_ref} (benchmark)", line=dict(color=PAL["muted"], width=1.5, dash="dot"),
                hovertemplate="n=%{x}<br>power=%{y:.2f}<extra>d=" + str(d_ref) + "</extra>",
            ))
        fig.add_trace(go.Scatter(
            x=ns, y=analysis.power(d_sel, ns, alpha_p, alternative=alt_map[direction]),
            mode="lines", name=f"d = {d_sel:.2f} (selected)", line=dict(color=PAL["blue"], width=3),
            hovertemplate="n=%{x}<br>power=%{y:.2f}<extra></extra>",
        ))
        pow_now = analysis.power(d_sel, n_sel, alpha_p, alternative=alt_map[direction])
        fig.add_trace(go.Scatter(x=[n_sel], y=[pow_now], mode="markers", name="Your design",
                                 marker=dict(size=13, color=PAL["orange"], line=dict(color=PAL["surface"], width=2))))
        fig.add_hline(y=0.8, line=dict(color=PAL["text2"], width=1, dash="dash"),
                      annotation_text="80% power", annotation_font_color=PAL["text2"])
        fig.update_layout(xaxis_title="n per group", yaxis_title="Power", yaxis_range=[0, 1.02])
        show(style(fig, "Power curves (TTestIndPower)", 400))
        n_req = analysis.solve_power(effect_size=d_sel, alpha=alpha_p, power=0.8, alternative=alt_map[direction])
        m1, m2 = st.columns(2)
        m1.metric("Power at your n", f"{pow_now:.1%}")
        m2.metric("n per group for 80% power", f"{int(np.ceil(n_req))}")


# ---------------------------------------------------------------------------
# Tab 4 - Two-way ANOVA & demographic interactions (Chapters 7 & 9)
# ---------------------------------------------------------------------------

with tabs[3]:
    st.header("Two-Way ANOVA & Demographic Interactions")
    chapter("Chapters 7 & 9", "Partitioning variance between factors", r"""
ANOVA splits the total variability in an outcome into pieces explained by each factor, plus what's
left over: $SS_\text{total}=SS_\text{workflow}+SS_\text{priming}+SS_\text{level}+SS_{\text{workflow}\times\text{priming}}+SS_\text{error}$.

Each factor gets an $F=\frac{MS_\text{factor}}{MS_\text{error}}$ ratio. A large $F$ means that factor
moves the outcome by more than noise would. **Partial η²** gives that effect's share of variance.

An **interaction** means the effect of one factor depends on the level of another. On an
interaction plot, **non-parallel lines** are the signature. **Tukey's HSD** then compares every pair
of cells while holding the family-wise error rate at α.
""")
    resp = st.radio("Response variable", ["frustration", "efficiency"], horizontal=True, format_func=METRICS.get)
    st.caption(
        "The model uses the chaos tests (5 and 6) only. That's where the design is a balanced 2 × 2: Test 5 is "
        "the AI Bot, Test 6 is legacy ticketing, and each participant is randomised to a primed or control arm. "
        "Tests 1–4 are never primed, so including them would make the priming factor absorb the whole chaos effect."
    )
    adf = df[df.workflow_chaos == 1].dropna(subset=["job_level"])
    if adf.empty:
        st.info("The ANOVA model needs chaos-test rows with job level, and this dataset has none.")
    else:
        with guarded("Two-way ANOVA"):
            formula = f"{resp} ~ C(workflow) + C(priming) + C(job_level) + C(workflow):C(priming)"
            st.code(formula, language="text")
            model = smf.ols(formula, data=adf).fit()
            # Type II sums of squares: each main effect is tested after the other
            # main effects, which suits unbalanced cells such as job level.
            aov = anova_lm(model, typ=2)
            # Partial eta squared = SS_effect / (SS_effect + SS_error).
            aov["partial η²"] = aov["sum_sq"] / (aov["sum_sq"] + aov.loc["Residual", "sum_sq"])
            aov.loc["Residual", "partial η²"] = np.nan
            st.dataframe(aov.round(4))
            st.caption(f"R² = {model.rsquared:.3f} · n = {int(model.nobs)} · Type II sums of squares")

        with guarded("Interaction plots"):
            c1, c2 = st.columns(2)
            with c1:
                fig = go.Figure()
                for prim in ["Unprimed", "Primed"]:
                    cells = [mean_ci(adf[(adf.workflow == w) & (adf.priming == prim)][resp]) for w in [LEGACY, AI_BOT]]
                    fig.add_trace(go.Scatter(
                        x=[LEGACY, AI_BOT], y=[m for m, _ in cells], name=prim, mode="lines+markers",
                        error_y=dict(type="data", array=[h for _, h in cells], thickness=1.5),
                        line=dict(color=PRIMING_COLORS[prim], width=2), marker=dict(size=10),
                    ))
                fig.update_layout(yaxis_title=f"Mean {METRICS[resp]}", xaxis_title="Workflow")
                show(style(fig, "Workflow × Priming, chaos tests (±95% CI)", 400))
            with c2:
                chaos_rows = adf
                fig = go.Figure()
                for prim in ["Unprimed", "Primed"]:
                    cells = [mean_ci(chaos_rows[(chaos_rows.job_level == l) & (chaos_rows.priming == prim)][resp])
                             for l in JOB_LEVELS]
                    fig.add_trace(go.Scatter(
                        x=JOB_LEVELS, y=[m for m, _ in cells], name=prim, mode="lines+markers",
                        error_y=dict(type="data", array=[h for _, h in cells], thickness=1.5),
                        line=dict(color=PRIMING_COLORS[prim], width=2), marker=dict(size=10),
                    ))
                fig.update_layout(yaxis_title=f"Mean {METRICS[resp]}", xaxis_title="Job level")
                show(style(fig, "Who falls for the priming? (±95% CI)", 400))

            lift = []
            for lvl in JOB_LEVELS:
                p_rows = chaos_rows[(chaos_rows.job_level == lvl) & (chaos_rows.priming == "Primed")][resp]
                u_rows = chaos_rows[(chaos_rows.job_level == lvl) & (chaos_rows.priming == "Unprimed")][resp]
                if len(p_rows) > 1 and len(u_rows) > 1:
                    p_val = stats.ttest_ind(p_rows, u_rows, equal_var=False).pvalue
                    lift.append([lvl, len(p_rows), len(u_rows), p_rows.mean() - u_rows.mean(), fmt_p(p_val)])
            if lift:
                st.markdown("**Priming effect by job level** (chaos tests, primed minus unprimed, Welch's t)")
                st.dataframe(pd.DataFrame(lift, columns=["Job level", "n primed", "n unprimed",
                                                         f"Δ {resp}", "p-value"]).round(2), hide_index=True)

        with guarded("Extended model"):
            with st.expander("Formal test: does priming susceptibility differ by job level?"):
                ext = smf.ols(f"{resp} ~ C(workflow) * C(priming) + C(job_level) * C(priming)", data=adf).fit()
                st.dataframe(anova_lm(ext, typ=2).round(4))
                st.caption("A significant C(priming):C(job_level) row means seniority changes how much the banner sways people.")

        with guarded("Tukey's HSD"):
            st.subheader("Tukey's HSD post-hoc comparisons")
            # Tukey compares all four workflow x priming cells pairwise and controls
            # the family-wise error rate.
            cells = adf["workflow"] + " · " + adf["priming"]
            tk = pairwise_tukeyhsd(adf[resp], cells, alpha=0.05)
            table = tk.summary().data
            st.dataframe(pd.DataFrame(table[1:], columns=table[0]), hide_index=True)


# ---------------------------------------------------------------------------
# Tab 5 - Logistic & OLS regression (Chapters 10 & 12)
# ---------------------------------------------------------------------------

def coef_table(res, odds=False):
    ci = res.conf_int()
    out = pd.DataFrame({
        "β": res.params,
        "Std Err": res.bse,
        "z" if odds else "t": res.tvalues,
        "p-value": res.pvalues,
        "CI 2.5%": ci[0],
        "CI 97.5%": ci[1],
    })
    if odds:
        out["Odds ratio e^β"] = np.exp(res.params)
    return out.round(4)


with tabs[4]:
    st.header("Logistic Regression & OLS Modelling")
    chapter("Chapter 10", "Logistic regression: modelling a yes/no outcome", r"""
A rage-quit is binary, so we model its **log-odds** as a straight line:
$$\log\frac{p}{1-p}=\beta_0+\beta_1\,\text{years}+\beta_2\,\text{chaos}+\beta_3\,\text{primed}$$
Exponentiating a coefficient gives an **odds ratio**. $e^{\beta_2}=10$ would mean the chaos workflow
multiplies the odds of quitting by ten. Pushing the line through the sigmoid
$p=\frac{1}{1+e^{-\eta}}$ turns it into a probability.
""")
    reg = df.dropna(subset=["years_experience"])
    if reg.empty:
        st.info("The regression models need years of experience, and no participant in this dataset provided it.")
    else:
        with guarded("Logistic regression"):
            if reg["rage_quit"].nunique() < 2:
                raise ValueError("rage_quit has no variation yet (nobody, or everybody, quit)")
            logit = smf.logit("rage_quit ~ years_experience + workflow_chaos + priming_exposed", data=reg).fit(disp=0)
            st.dataframe(coef_table(logit, odds=True))
            st.caption(f"McFadden pseudo-R² = {logit.prsquared:.3f} · n = {int(logit.nobs)}")

            c1, c2 = st.columns([2, 1])
            with c1:
                yrs = np.linspace(0, 25, 100)
                fig = go.Figure()
                for label, ch, pr, color in [("Baseline workflow", 0, 0, PAL["blue"]),
                                             ("Chaos, unprimed", 1, 0, PAL["orange"]),
                                             ("Chaos, primed", 1, 1, PAL["aqua"])]:
                    pred = logit.predict(pd.DataFrame({"years_experience": yrs, "workflow_chaos": ch, "priming_exposed": pr}))
                    fig.add_trace(go.Scatter(x=yrs, y=pred, name=label, line=dict(color=color, width=2),
                                             hovertemplate="%{x:.0f} yrs<br>P(quit)=%{y:.1%}<extra>" + label + "</extra>"))
                fig.update_layout(xaxis_title="Years of experience", yaxis_title="P(rage-quit)", yaxis_tickformat=".0%")
                show(style(fig, "Predicted rage-quit probability", 380))
            with c2:
                st.markdown("**Try a profile**")
                y_in = st.slider("Years of experience", 0, 25, 5)
                ch_in = st.toggle("Chaos workflow", value=True)
                pr_in = st.toggle("Shown priming banner", value=False)
                prob = logit.predict(pd.DataFrame({"years_experience": [y_in], "workflow_chaos": [int(ch_in)],
                                                   "priming_exposed": [int(pr_in)]}))[0]
                st.metric("Predicted P(rage-quit)", f"{prob:.1%}")

        chapter("Chapter 12", "OLS: which levers drive frustration?", r"""
Ordinary least squares finds the coefficients that minimise $\sum (y_i-\hat y_i)^2$. Each $\beta$ is the
expected change in frustration for a one-unit change in that predictor, **holding the others
fixed**. Check the residuals afterwards. A funnel in residuals-vs-fitted signals heteroscedasticity,
and a bent Q–Q line signals non-normal errors.
""")
        with guarded("OLS regression"):
            terms = "completion_min + error_count + years_experience + workflow_chaos + priming_exposed"
            if reg["job_level"].nunique() > 1:
                terms += " + C(job_level)"
            ols = smf.ols(f"frustration ~ {terms}", data=reg).fit()
            st.code(f"frustration ~ {terms}", language="text")
            st.dataframe(coef_table(ols))
            st.caption(f"R² = {ols.rsquared:.3f} · adj. R² = {ols.rsquared_adj:.3f} · n = {int(ols.nobs)}")

            c1, c2 = st.columns(2)
            with c1:
                jitter = np.random.default_rng(0).uniform(-0.15, 0.15, len(ols.fittedvalues))
                fig = go.Figure(go.Scatter(
                    x=ols.fittedvalues, y=ols.resid + jitter, mode="markers",
                    marker=dict(size=6, color=PAL["blue"], opacity=0.45), name="Residual",
                    hovertemplate="fitted %{x:.2f}<br>residual %{y:.2f}<extra></extra>",
                ))
                fig.add_hline(y=0, line=dict(color=PAL["text2"], width=1, dash="dash"))
                fig.update_layout(xaxis_title="Fitted frustration", yaxis_title="Residual (jittered)", showlegend=False)
                show(style(fig, "Residuals vs fitted", 360))
            with c2:
                (osm, osr), (slope, intercept, _) = stats.probplot(ols.resid, dist="norm")
                fig = go.Figure()
                fig.add_trace(go.Scatter(x=osm, y=osr, mode="markers", name="Residuals",
                                         marker=dict(size=6, color=PAL["blue"], opacity=0.5)))
                fig.add_trace(go.Scatter(x=osm, y=slope * osm + intercept, mode="lines", name="Normal reference",
                                         line=dict(color=PAL["orange"], width=2)))
                fig.update_layout(xaxis_title="Theoretical quantiles", yaxis_title="Sample quantiles", showlegend=False)
                show(style(fig, "Normal Q–Q plot of residuals", 360))

        st.subheader("Simpson's Paradox: experience vs perceived efficiency")
        st.markdown(
            "Does experience make people rate the system as more efficient? Look at everyone together first, "
            "then split by job level."
        )
        with guarded("Simpson's paradox"):
            # Collapse to one point per participant (mean rating across their tests).
            # Otherwise each person would count six times and inflate the scatter.
            pp = (reg.dropna(subset=["job_level"])
                     .groupby(["participant_id", "job_level"], as_index=False)
                     .agg(years_experience=("years_experience", "first"), efficiency=("efficiency", "mean")))
            if len(pp) < 3:
                raise ValueError("need at least 3 participants with demographics")
            split = st.toggle("Break down by job level", value=False)
            fig = go.Figure()
            slopes = []
            agg_fit = np.polyfit(pp.years_experience, pp.efficiency, 1) if pp.years_experience.nunique() > 1 else None
            if not split:
                fig.add_trace(go.Scatter(x=pp.years_experience, y=pp.efficiency, mode="markers", name="Participants",
                                         marker=dict(size=7, color=PAL["blue"], opacity=0.55)))
                if agg_fit is not None:
                    xs = np.linspace(pp.years_experience.min(), pp.years_experience.max(), 50)
                    fig.add_trace(go.Scatter(x=xs, y=np.polyval(agg_fit, xs), mode="lines", name="Aggregate trend",
                                             line=dict(color=PAL["text"], width=3)))
            else:
                for lvl in JOB_LEVELS:
                    sub = pp[pp.job_level == lvl]
                    if sub.empty:
                        continue
                    fig.add_trace(go.Scatter(x=sub.years_experience, y=sub.efficiency, mode="markers", name=lvl,
                                             marker=dict(size=7, color=LEVEL_COLORS[lvl], opacity=0.6)))
                    if sub.years_experience.nunique() > 1:
                        fit = np.polyfit(sub.years_experience, sub.efficiency, 1)
                        xs = np.linspace(sub.years_experience.min(), sub.years_experience.max(), 20)
                        fig.add_trace(go.Scatter(x=xs, y=np.polyval(fit, xs), mode="lines", showlegend=False,
                                                 line=dict(color=LEVEL_COLORS[lvl], width=3)))
                        slopes.append([lvl, len(sub), fit[0]])
                if agg_fit is not None:
                    xs = np.linspace(pp.years_experience.min(), pp.years_experience.max(), 50)
                    fig.add_trace(go.Scatter(x=xs, y=np.polyval(agg_fit, xs), mode="lines", name="Aggregate trend",
                                             line=dict(color=PAL["muted"], width=2, dash="dash")))
            fig.update_layout(xaxis_title="Years of experience", yaxis_title="Mean perceived efficiency (per participant)")
            show(style(fig, "Aggregate trend vs within-group trends", 420))
            if agg_fit is not None:
                rows = [["All participants (aggregate)", len(pp), agg_fit[0]]] + slopes
                st.dataframe(pd.DataFrame(rows, columns=["Group", "n", "Slope (efficiency per year)"]).round(3),
                             hide_index=True)
            st.caption(
                "In the benchmark data the aggregate slope is positive while every within-level slope is negative. "
                "Seniority confounds the relationship: directors have more years *and* rate the system higher."
            )


# ---------------------------------------------------------------------------
# Tab 6 - Bayesian updating & manifesto (Chapter 11 & conclusion)
# ---------------------------------------------------------------------------

with tabs[5]:
    st.header("Bayesian Updating & the AI Governance Manifesto")
    chapter("Chapter 11", "Bayes' theorem: trust as a belief that updates", r"""
$$P(\text{reliable}\mid\text{data})=\frac{P(\text{data}\mid\text{reliable})\,P(\text{reliable})}{P(\text{data})}$$

Start with a **prior** belief, for example a vendor's claim that the bot resolves 90% of tickets.
Every observed ticket is evidence. With a $\text{Beta}(a,b)$ prior on the success rate $\theta$ and
$k$ successes in $n$ tickets, the posterior is simply $\text{Beta}(a+k,\;b+n-k)$. Strong priors
need lots of evidence to move, and weak priors defer to the data almost immediately.
""")

    # Evidence stream: AI Bot tickets in a fixed shuffled order, so the "tickets
    # observed" slider replays the same sequence every time.
    ai_rows = df[df.workflow == AI_BOT].sample(frac=1, random_state=7)
    ai_success = ((ai_rows.rage_quit == 0) & (ai_rows.error_count <= 1)).astype(int).to_numpy()
    st.markdown(
        f"**Evidence:** {len(ai_success)} AI Bot tickets in the current dataset. A ticket counts as a success when it "
        f"was resolved with ≤ 1 error and no rage-quit (observed rate {ai_success.mean():.0%})."
        if len(ai_success) else "**Evidence:** no AI Bot tickets yet."
    )
    b1, b2, b3 = st.columns(3)
    prior_mean = b1.slider("Prior trust: P(bot resolves a ticket)", 0.01, 0.99, 0.90, 0.01,
                           help="E.g. the vendor's marketing claim.")
    prior_strength = b2.slider("Prior strength (pseudo-tickets)", 2, 300, 40,
                               help="How many tickets' worth of conviction the prior carries.")
    n_obs = b3.slider("Tickets observed so far", 0, max(len(ai_success), 1), min(30, len(ai_success)))
    # Beta prior from mean and strength: a0 + b0 = strength and a0 / (a0 + b0) = mean.
    # Conjugacy means the posterior is just Beta(a0 + successes, b0 + failures).
    a0, b0 = prior_mean * prior_strength, (1 - prior_mean) * prior_strength
    seen = ai_success[:n_obs]
    k = int(seen.sum())
    a_post, b_post = a0 + k, b0 + n_obs - k

    with guarded("Bayesian updating"):
        theta = np.linspace(0.001, 0.999, 500)
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=theta, y=stats.beta.pdf(theta, a0, b0), name="Prior",
                                 line=dict(color=PAL["muted"], width=2, dash="dash")))
        if n_obs:
            lik = stats.beta.pdf(theta, k + 1, n_obs - k + 1)
            fig.add_trace(go.Scatter(x=theta, y=lik, name="Likelihood (normalised)",
                                     line=dict(color=PAL["blue"], width=2, dash="dot")))
        fig.add_trace(go.Scatter(x=theta, y=stats.beta.pdf(theta, a_post, b_post), name="Posterior",
                                 line=dict(color=PAL["orange"], width=3), fill="tozeroy",
                                 fillcolor="rgba(217,89,38,0.18)"))
        fig.update_layout(xaxis_title="θ = true ticket-resolution rate", yaxis_title="Density", xaxis_tickformat=".0%")
        show(style(fig, f"Prior → Posterior after {n_obs} tickets ({k} successes)", 400))
        lo, hi = stats.beta.ppf([0.025, 0.975], a_post, b_post)
        m1, m2, m3 = st.columns(3)
        m1.metric("Prior mean", f"{prior_mean:.0%}")
        m2.metric("Posterior mean", f"{a_post / (a_post + b_post):.1%}",
                  f"{a_post / (a_post + b_post) - prior_mean:+.1%}")
        m3.metric("95% credible interval", f"{lo:.0%} – {hi:.0%}")

        if len(ai_success):
            cum_k = np.concatenate([[0], np.cumsum(ai_success)])
            steps = np.arange(len(cum_k))
            pa, pb = a0 + cum_k, b0 + steps - cum_k
            fig = go.Figure()
            fig.add_trace(go.Scatter(x=steps, y=stats.beta.ppf(0.975, pa, pb), mode="lines",
                                     line=dict(width=0), showlegend=False, hoverinfo="skip"))
            fig.add_trace(go.Scatter(x=steps, y=stats.beta.ppf(0.025, pa, pb), mode="lines", fill="tonexty",
                                     line=dict(width=0), fillcolor="rgba(57,135,229,0.22)", name="95% credible band",
                                     hoverinfo="skip"))
            fig.add_trace(go.Scatter(x=steps, y=pa / (pa + pb), mode="lines", name="Posterior mean",
                                     line=dict(color=PAL["blue"], width=2),
                                     hovertemplate="after %{x} tickets: %{y:.1%}<extra></extra>"))
            fig.add_vline(x=n_obs, line=dict(color=PAL["orange"], width=2, dash="dash"),
                          annotation_text="slider position", annotation_font_color=PAL["text2"])
            fig.update_layout(xaxis_title="Tickets observed", yaxis_title="Belief in resolution rate",
                              yaxis_tickformat=".0%")
            show(style(fig, "Trust erosion: the posterior as evidence accumulates", 360))

    with st.expander("🎲 Discrete Bayes: how many errors until you stop trusting the bot?"):
        e1, e2, e3 = st.columns(3)
        p_rel = e1.slider("Prior P(bot is reliable)", 0.01, 0.99, 0.80, 0.01)
        p_err_rel = e2.slider("P(error | reliable)", 0.01, 0.5, 0.10, 0.01)
        p_err_unrel = e3.slider("P(error | unreliable)", 0.05, 0.99, 0.60, 0.01)
        # Bayes' theorem applied k times: P(R | k errors) ∝ P(R) · P(E | R)^k.
        ks = np.arange(0, 11)
        num = p_rel * p_err_rel ** ks
        post = num / (num + (1 - p_rel) * p_err_unrel ** ks)
        fig = go.Figure(go.Scatter(x=ks, y=post, mode="lines+markers", line=dict(color=PAL["orange"], width=2),
                                   marker=dict(size=9), hovertemplate="%{x} errors → %{y:.1%}<extra></extra>"))
        fig.add_hline(y=0.5, line=dict(color=PAL["muted"], dash="dash"), annotation_text="coin-flip trust",
                      annotation_font_color=PAL["muted"])
        fig.update_layout(xaxis_title="Consecutive errors observed", yaxis_title="P(reliable | errors)",
                          yaxis_tickformat=".0%", yaxis_range=[0, 1.02])
        show(style(fig, "Posterior trust after k consecutive errors", 340))

    st.divider()
    st.header("Executive Summary")
    with guarded("Executive summary"):
        base_med = df[df.workflow_chaos == 0]["completion_time"].median()
        chaos_med = df[df.workflow_chaos == 1]["completion_time"].median()
        rq_base = df[df.workflow_chaos == 0]["rage_quit"].mean()
        rq_chaos = df[df.workflow_chaos == 1]["rage_quit"].mean()
        t6 = df[df.test_num == 6]
        prime_lift = (t6[t6.primed_arm == 1]["efficiency"].mean() - t6[t6.primed_arm == 0]["efficiency"].mean())
        s1, s2, s3, s4 = st.columns(4)
        s1.metric("Chaos slowdown (median)", f"{chaos_med / base_med:.1f}×" if base_med else "–")
        s2.metric("Rage-quit rate", f"{rq_chaos:.0%}", f"{(rq_chaos - rq_base) * 100:+.0f} pts vs baseline",
                  delta_color="inverse")
        s3.metric("Priming lift on T6 efficiency", f"{prime_lift:+.2f}" if not np.isnan(prime_lift) else "–",
                  help="Primed minus control, perceived-efficiency rating on the documentation hunt.")
        s4.metric("Posterior bot reliability", f"{a_post / (a_post + b_post):.0%}")

    st.markdown("""
### The AI Workflow Manifesto

1. **Measure the median and the tail.** Averages hide the Friday-at-4:45 disasters. Track the 90th
   percentile, abandonment, and the mean–median gap for every workflow.
2. **Satisfaction surveys can be primed.** One sentence of marketing copy measurably inflates
   perceived efficiency, most of all among senior leaders who buy the tools. Run blind evaluations
   and give behavioural telemetry (time, errors, rage-quits) more weight than opinion.
3. **Segment before you conclude.** Simpson's paradox is real in enterprise data. A trend across the
   whole company can reverse inside every job level.
4. **Treat AI trust as a posterior.** Start with a sceptical prior, update on observed outcomes,
   and publish the credible interval alongside any reliability claim.
5. **Govern the failure modes.** A hallucinating assistant performs worse than a dull form. Ship
   AI workflows with fallbacks, an obvious escape hatch, and abandonment alerts.

**Call to action:** before your next ticketing or AI-assistant rollout, run this six-test grind on
a pilot group. Randomise the priming, power the study for the effect you care about, and let the
posterior, not the press release, decide.
""")

# Mock IRB Review: SNOW Stats Lab

**Protocol:** *Praise for the Incumbent, Warnings for the AI*: framing, AI errors and perceived efficiency in a simulated IT service portal
**Principal investigator:** Natalie Zachariah
**Review date:** October 28, 2026 · **Protocol version reviewed:** v2 (live site as of this date) · **Proposed revision:** v3 (section 6)

> **This is a mock review written as a learning exercise.** It follows the structure and questions a US institutional review board would typically raise under the Common Rule (45 CFR 46), but it is **not** an IRB determination. If results will be published or presented as research beyond the course, or if your employer or institution has its own review process, submit the protocol to that body before collecting data.

---

## 1. Protocol summary (as reviewed)

| Item | Current protocol (v2) |
|---|---|
| Purpose | Teaching statistics and AI live, and the course project's dataset: does framing change how efficient a ticketing system *feels*, compared with measured performance? |
| Setting | Live online session (AI Pathfinders call) and course classmates. Participants open a public website on their own device. |
| Participants | Adult professionals and students who join the session. Expected N ≈ 20–70. No incentives. |
| Procedure | Consent → optional demographics → six simulated IT tickets (three ServiceNow-style forms, three with an AI agent) → per-ticket ratings → final survey → debrief (≈ 8–10 min). |
| Manipulations | (1) Positive ServiceNow banner, 50%. (2) "AI team", 50% independently: hallucination warning + displayed AI confidence + an always-correct agent. The other team's agent silently fills in the wrong room and cart code on one ticket; unless caught, a fictional angry email from "AV Operations" follows. |
| Deception | Yes: banners presented as real reminders, a planted AI error, a fictional email. Debrief at the end. |
| Data | Timings, error counts, abandonments, 1–10 ratings, typed ticket descriptions, optional job level / role / years, final survey, optional comment, random participant code. |
| Storage | One Supabase (PostgreSQL) project. Analysis and report in a public GitHub repository. |

## 2. Preliminary determination

- **Is it research?** Partly. A pure classroom demonstration whose data is only shown in the room is usually *not* human-subjects research. But this project collects data systematically to answer a question, writes it up, and publishes it in a public repository. **Treat it as research.**
- **Risk level:** **minimal risk**. The tasks resemble everyday work software; the worst plausible harms are mild frustration or embarrassment, and a privacy risk from free text and small groups.
- **Deception:** permissible for a minimal-risk study only if (a) the research could not practicably be done without it, (b) it doesn't involve risks participants would object to, and (c) participants are debriefed and can withdraw. Revealing the banners in advance would defeat the purpose, so (a) is met. Conditions (b) and (c) drive most of the mitigations below.
- **Likely review path** at a real institution: exempt or expedited review, with an **alteration of informed consent** for the deception, conditional on the items in section 5.

---

## 3. Reviewer questions

Each question is followed by the PI's response, or the remaining action. Status: ✅ resolved in the code today · 🟡 PI action needed · 🔵 addressed by the v3 design.

### A. Purpose and design

1. **What exactly is the primary question, and is it fixed in advance?** H1 (praise → ServiceNow ratings) and H2 (AI team vs other team → AI ratings) are fixed in `report/report_template.md`. 🟡 Pre-register them (OSF or AsPredicted) **before** the session, including exclusion rules and the analysis plan.
2. **Does the design let you answer it?** Not fully. In v2, the "AI team" differs in three ways at once (warning, displayed confidence, agent accuracy), so H2 cannot attribute any effect to the warning. The planted error also works *against* H2. 🔵 v3 separates the three into independent factors.
3. **Are ticket scenarios confounded with platform?** Yes: ServiceNow always gets password/licence/boardroom scenarios and the AI always gets MFA/install/camera, so "AI is faster" could partly be "these scenarios are easier". 🔵 v3 counterbalances scenario sets across platforms.
4. **Is effort comparable within each platform?** Since today, yes: every ServiceNow ticket has four fields, a description and a cart checkout. ✅
5. **Is there a no-message control that matches the banner's length and position?** No: the control sees nothing, so "banner vs none" confounds content with the mere presence of a message. 🔵 v3 uses a neutral banner of equal length.

### B. Recruitment, consent and voluntariness

6. **Who is recruited, and could anyone feel pressured?** On a work call, colleagues, or people junior to the presenter, may feel they *should* take part, and others can see who is clicking. ✅ The consent text now says participation is voluntary, people can watch without taking part, and there are no consequences. 🟡 Say this out loud at the start, and don't ask people to report whether they finished.
7. **Are participants adults?** ✅ The consent checkbox now confirms the participant is 18 or older.
8. **Does the consent text cover the essentials?** ✅ It now covers who runs the study, the purpose (without revealing the manipulation), duration, what is and isn't recorded, voluntariness, the right to stop, group display, that some details come at the end, and withdrawal. ✅ Contact route added: participants message Natalie Zachariah on Teams for questions and withdrawal requests.
9. **Can people decline without others noticing?** Yes: it's a link on their own device, and there's no list of who took part. ✅
10. **Incentives?** None. ✅
11. **Can someone take part twice?** Yes ("start a new participant" button, or a new browser). 🟡 Ask people to take part once. Duplicates can be screened only roughly (identical demographics plus close timing), which the cleaning log should report. 🔵 v3 adds a one-per-browser guard.

### C. Deception and debriefing

12. **Are the banners false?** The ServiceNow line is marketing copy, not a factual claim about this system. The AI warning is broadly true of AI in general, but it is false *for the AI team's agent*, which never errs. The debrief explains both. ✅
13. **Could the planted error or the angry email cause distress?** Mildly. The email blames the participant ("Please check your tickets…"), which could embarrass someone in front of colleagues if they mention it. ✅ The debrief now says the email, room mix-up and cart codes were fictional and nobody was sent anywhere. 🔵 v3 softens the email to a factual, firm message, in place of a blaming one.
14. **Is the debrief adequate?** ✅ It explains both coin flips, the participant's own condition, the fictional email, and why deception was needed. It also asks people not to tell others, and offers withdrawal with a participant code.
15. **Can people withdraw after learning of the deception?** ✅ A "withdraw my data" button records the code, and the participant then disappears from every live chart and from the analysis (cleaning rule 1). 🟡 Also honour emailed withdrawal requests until the analysis is final, and say when that is.
16. **Could the live charts reveal someone's condition or answers?** The lessons show the group's data during the session. ✅ Free text is never shown, and job-level splits hide groups smaller than 5. 🟡 Don't single out individual dots or ask people to identify themselves on a chart.

### D. Privacy and confidentiality

17. **What identifiers are collected?** No name, email or account. A random code, optional coarse demographics, and typed descriptions. ✅
18. **Could free text contain personal information?** Yes: people sometimes type names, emails or phone numbers into tickets. ✅ The site now scrubs email addresses and long numbers before saving. ✅ Free text is never displayed or included in public data. 🟡 Before analysis, read the export and redact anything else identifying.
19. **Who can read the raw data?** *Previously anyone with the site's public key could read every row, including free text. This was the most serious issue found.* ✅ Fixed: the public key can now only **insert**. The live lessons read de-identified views with no free text and no timestamps. Only the PI's secret service-role key can read the raw tables, and it is used only in `scripts/export_supabase.py` on her own machine.
20. **Could demographics identify someone in a small group?** Yes, for example the only director with 20+ years on a call of 15. ✅ Small-cell suppression (n < 5) in the live Simpson's-paradox scene and the report's by-level table. 🔵 v3 collects years of experience in bands (0–3, 4–9, 10–15, 16+), not exact years.
21. **Does the host log IP addresses?** GitHub Pages and Supabase keep server logs that may include IP addresses. These are not in the study tables, and the consent text is accurate ("not … in the study data"). 🟡 Don't download or analyse those logs.
22. **What goes into the public GitHub repository?** The course requires raw and cleaned data in the repo, which is public. ✅ Full exports (with free text) are now git-ignored and stay on the PI's machine. The export writes `*_deidentified.csv` copies with no free text and no withdrawn participants for the repo, and the cleaned files never contain free text.
23. **How long is data kept?** 🟡 Proposed: delete raw free text once the report is final, and delete the Supabase project at the end of the course. The SQL to do this is in `supabase/schema.sql`. Keep only the de-identified files.
24. **Where is data stored, and who else can access it?** In one Supabase project owned by the PI. ✅ There is now one store only. The Streamlit lab no longer collects or stores anything, and the website's demo mode shows a visible "not study data" warning.

### E. Data quality and integrity

25. **Is there one source of truth?** ✅ Yes. The SNOW portal is the only collection instrument, Supabase is the only store, and the Python pipeline, report and live lessons all read from it.
26. **How do you know people noticed the banners?** ✅ Two manipulation-check questions in the final survey ("Did you see a message about ServiceNow / AI?"), with pass rates reported in `results.json`. 🟡 Pre-register whether non-noticers are analysed as randomised (intention-to-treat, recommended) or also excluded in a sensitivity analysis.
27. **Are completion times valid?** Times include reading and any tab-switching, and devices differ (a phone vs a laptop). 🔵 v3 records a coarse device class and uses the per-person *median* time; the 30-minute walk-away rule stays.
28. **Attention?** 🔵 v3 adds one instructed-response item ("please select 3 for this question").
29. **Bots or spam inserts?** The public key can insert anything that passes the table constraints. Risk is low for a short session with an unlisted link. 🟡 Use a fresh `?session=` label per session, and drop rows whose session label you didn't use.
30. **Demo-mode contamination?** ✅ Demo data stays in the browser and is never exported; the portal warns visibly.

### F. Third parties

31. **Does the portal impersonate ServiceNow?** It is a look-alike with no logos and no login, and it carries a "not affiliated with ServiceNow, Inc." note on every page. ✅ 🟡 Don't describe it to participants as the real product.
32. **Is the angry email attributable to a real person or company?** No: "Dana, AV Operations" at a reserved `.example` domain is fictional. ✅

### G. Analysis

33. **Multiple comparisons?** Holm across H1/H2 is already planned ✅. In v3, Holm across the three confirmatory factor tests 🔵.
34. **Is the sample large enough?** At ~20–40 people on one call, the study can only detect large effects. Say so in advance and treat this session as a pilot. 🟡 The planned recruitment target is 68.
35. **Stopping rule?** 🟡 Fix it in advance: analyse after the scheduled session(s), and don't keep collecting until p < .05.

---

## 4. Risk register and mitigations

| ID | Risk | Likelihood | Severity | Mitigation | Status |
|---|---|---|---|---|---|
| P1 | Anyone could read all raw rows, including free text, with the public key | High (it was open) | Moderate | Insert-only tables for the public key; de-identified views for the lessons; secret key only for the export | ✅ Done |
| P2 | Personal information typed into tickets or comments | Medium | Moderate | Consent warning; automatic scrubbing of emails and numbers; free text never displayed, never in public files; manual redaction before analysis | ✅ / 🟡 |
| P3 | Re-identification from demographics in small groups | Medium | Low–moderate | Suppress cells with n < 5; v3 uses experience bands | ✅ / 🔵 |
| P4 | Raw data published in a public repository | High (the course requires it) | Moderate | Full exports git-ignored; commit de-identified copies only | ✅ |
| P5 | Data kept longer than needed | Medium | Low | Delete free text after the report; delete the project after the course | 🟡 |
| D1 | Distress or embarrassment from the planted error and angry email | Medium | Low | Debrief states it was fictional; v3 email is factual, not blaming; withdrawal offered | ✅ / 🔵 |
| D2 | Participants feel deceived about the banners | Medium | Low | Full debrief with each participant's own condition; withdrawal after debrief | ✅ |
| V1 | Felt pressure to take part on a work call | Medium | Low | Explicit voluntariness in consent and spoken script; watching is fine; no attendance tracking | ✅ / 🟡 |
| Q1 | Two data instruments splitting the data | Was certain | Moderate (validity) | Streamlit collector removed; one portal, one database | ✅ |
| Q2 | Confounded AI manipulation (warning + confidence + accuracy) | Certain in v2 | High (validity) | v3 makes them independent factors | 🔵 |
| Q3 | Scenario confounded with platform | Certain in v2 | Moderate (validity) | v3 scenario counterbalancing | 🔵 |
| Q4 | Banners not noticed | Medium | Moderate (validity) | Manipulation checks, reported in results | ✅ |
| Q5 | Duplicate or bot submissions | Low–medium | Low | One session label per session; one-per-browser guard in v3; cleaning rules | 🟡 / 🔵 |
| Q6 | Underpowered for anything but large effects | High | Moderate (inference) | Pre-registered as a pilot; report effect sizes and CIs; sensitivity table | 🟡 |
| B1 | Brand confusion with ServiceNow | Low | Low | Disclaimer on every page; no logos or login | ✅ |

---

## 5. Conditions before running the live session

1. 🟡 Pre-register hypotheses, exclusions, stopping rule and analysis (one page on AsPredicted is enough).
2. ✅ Contact route (Teams) is on the consent and debrief screens.
3. 🟡 Set up Supabase with the **updated** `supabase/schema.sql`, put only the anon key in the site, and keep the service-role key off GitHub.
4. 🟡 Use a fresh session label for each session (`?session=pathfinders-oct28`).
5. 🟡 Read the voluntariness statement aloud at the start, and keep the reveal (page 4 onwards) until everyone has finished.
6. 🟡 After the session: export, check the free text for identifiers, commit only the `*_deidentified.csv` files, and follow the retention plan.

---

## 6. A cleaner experimental design (v3, proposed)

**Goal:** separate the three things v2 bundles together (what people are *told*, what they are *shown*, and how good the AI actually *is*), and remove the scenario confound. It keeps the same session length and the same six tickets.

### Factors (all between subjects, each an independent 50/50 coin flip)

| Factor | Levels | What changes |
|---|---|---|
| **A. ServiceNow framing** | Praise banner · **neutral** banner | Before the ServiceNow set: "ServiceNow’s single pane of glass is incredibly efficient." vs an equal-length neutral line ("Reminder: describe each request in your own words.") |
| **B. AI framing** | Hallucination warning · **neutral** banner | Before the AI set: the current warning vs an equal-length neutral line |
| **C. AI error** | Planted error · no error | On the meeting-room ticket the agent fills in the wrong room and cart, vs filling it in correctly |

The **AI confidence score is shown to everyone** (held constant), so it can't masquerade as an effect of B. If confidence display is itself a question of interest, add it later as a fourth factor; don't bundle it.

**Within subjects:** platform (ServiceNow vs AI agent), with set order randomised as now.

**Scenario counterbalancing:** two matched scenario sets per ticket type (e.g. access: *expense lockout* vs *MFA reset*; software: *Tableau* vs *Figma*; facilities: *boardroom AV* vs *meeting-room camera*). A fourth coin flip decides which set goes with which platform, so neither platform always gets the easier scenarios. The planted error goes on whichever **facilities** ticket lands on the AI side.

This is a 2 × 2 × 2 between-subjects design (8 cells) crossed with platform within subjects. Because every factor is its own coin flip, each main effect is estimated from **all** participants, so the required sample doesn't grow eightfold.

### Hypotheses (confirmatory, Holm-corrected as one family of three)

- **H1 (A):** praise raises ServiceNow efficiency ratings.
- **H2 (B):** the warning lowers AI efficiency ratings, now isolated from AI accuracy and confidence.
- **H3 (C):** a planted error lowers AI ratings and raises frustration, with the **catch rate** reported as the behavioural outcome.
- **Exploratory:** A×platform and B×C (does a warning raise the catch rate? This is the "does warning people make them check?" question), set order, job level (n ≥ 5 cells only), manipulation-check compliance.
- **Manipulation and performance checks:** the AI is faster (paired); banner-noticing rates.

### Measures

- Per ticket: efficiency (1–10, primary), frustration with this ticket (1–10), time, errors, abandonment, caught/not caught (C only).
- Final survey: NPS, AI trust, preference, two manipulation checks, one attention item.
- Demographics (optional, coarse): job level, role, **years in bands**, device class (phone / computer) recorded automatically.
- Free text is still typed (it makes the tickets realistic) but is scrubbed, never displayed, never published, and deleted after the analysis.

### Procedures

- **The email (C):** factual and firm, without blame. *"The technician went to Meeting room 7C as the ticket said, but the camera there is fine. The cart reference CART-6091 doesn't exist. We've re-queued the request for 3A."* It is labelled in the debrief as fictional.
- **One participation per browser:** the portal remembers completion and offers "view the lessons" in place of a new run. A facilitator override stays available.
- **Randomisation** in the browser with a cryptographic random generator, as now. The pre-registration states that allocation is simple randomisation, with balance checked afterwards.
- **Consent, debrief and withdrawal** as implemented today, plus the contact email.

### Analysis plan

- Unit: the participant. Per-person mean rating per platform.
- **Primary model:** `efficiency ~ platform * (A + B + C) + set_order + (1 | participant)`, with the confirmatory contrasts being A within ServiceNow, B within AI, and C within AI, Holm-corrected. One-sided Mann–Whitney tests on per-person means serve as robustness checks.
- **Analysis population:** analyse everyone as randomised (intention-to-treat). Sensitivity analysis excludes people who failed the attention item or both manipulation checks.
- **Exclusions:** fixed in advance, as in the current cleaning rules, plus withdrawals and the attention item for sensitivity.
- **Sample size:** each confirmatory test at α = 0.05/3 per Holm's first step; d = 0.8 needs about 33 per level, so about 66 analysable and **~74 recruited**. With 20–40 people per session, run it twice or treat one session as a pilot and say so.
- **Report** effect sizes with 95% CIs for every test, not just p-values.

### What v3 would change in the code

| Area | Change |
|---|---|
| `site/src/data/design.js` | Scenario sets A/B per ticket type; factor C; neutral banners; years bands |
| `site/src/pages/portal.js` | Four coin flips; confidence shown to all; softened email; attention item; device class; one-per-browser guard |
| `supabase/schema.sql` | Columns `scenario_set`, `ai_error_arm`, `attention_ok`, `device`; `years_band` in place of `years_experience` |
| `lab/`, `scripts/` | Mirror the design; mixed-model primary analysis; Holm across three tests |
| Lessons | Relabel the AI scenes for the three separate factors |

---

## 7. Changes already made to the live system today

- **One collection point:** the Streamlit lab's simulator, live-data options and CSV storage are removed. It is now a textbook running on benchmark data, linking to the portal.
- **Privacy:**
  - insert-only raw tables for the public key, de-identified views for the lessons, and the secret key used only by the export;
  - polling in place of realtime, since the public key can no longer read raw rows;
  - free text scrubbed before saving, dropped from cleaned data, and git-ignored in raw exports, with de-identified copies for the repo;
  - small-cell suppression.
- **Consent and debrief:** fuller consent (voluntary, 18+, what is recorded, deferred explanation, withdrawal), a demo-mode warning, a debrief that names the fictional email, a participant code, and a **withdraw my data** button honoured everywhere.
- **Validity:** two manipulation-check questions, with pass rates in `results.json`.

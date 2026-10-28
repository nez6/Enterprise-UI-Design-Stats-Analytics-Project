// Page 1: a ServiceNow-style Service Portal and the data-collection instrument.
//
// Each participant files six noisy tickets in two sets (random order):
//   ServiceNow set (tests 1-3): identical effort each: four mandatory fields, a description,
//                               and a Shopping Cart checkout whose code is in a KB article.
//   AI agent set   (tests 4-6): the agent reads your description and fills in the same fields
//                               and the cart; you review and submit.
// Coin flip 1 (snow_primed): positive ServiceNow banner.
// Coin flip 2 (ai_primed, "the AI team"): hallucination warning + the agent's confidence shown
//   + an agent that is always right. Everyone else: no banner, no confidence, and on the AV
//   ticket the agent fills in the wrong room and cart. It submits anyway, and unless they
//   caught it, an angry email arrives from the AV team.
// After every ticket: frustration and efficiency ratings. At the end: NPS, trust, preference.

import { AI, AI_ERROR_TESTS, AI_WRONG, ANSWERS, BANNERS, CATEGORIES, FIELDS, JOB_LEVELS, JOB_ROLES, LEGACY, TESTS } from '../data/design.js';
import { addFeedback, addSubmission, addWithdrawal, MODE } from '../data/store.js';
import { SESSION, refresh } from '../data/context.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const incNumber = () => `INC${String(10000 + Math.floor(rand() * 89999)).padStart(7, '0')}`;
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Participant state survives a refresh (sessionStorage) so a reload mid-study doesn't lose progress.
const KEY = 'snowlab.participant.v3';
let P = load();
let task = null;
let root;

function load() { try { return JSON.parse(sessionStorage.getItem(KEY)) || null; } catch { return null; } }
function save() { try { sessionStorage.setItem(KEY, JSON.stringify(P)); } catch { /* ignore */ } }

export function renderPortal(container) { root = container; draw(); }

function draw() {
  if (!P) return drawHome();
  if (P.idx < 6) {
    if (P.phase === 'intro') return drawSetIntro();
    if (P.phase === 'feedback') return drawTicketFeedback();
    return drawTask();
  }
  if (!P.surveyDone) return drawFinalSurvey();
  return drawDone();
}

const currentTest = () => P.order[P.idx];
const bannerFor = (workflow) => (workflow === AI ? P.aiPrimed : P.snowPrimed) ? BANNERS[workflow] : null;
const bannerHtml = (b, big = false) => (b ? `<div class="priming-banner ${b.tone}" style="${big ? 'font-size:20px' : ''}"><span>${b.tone === 'positive' ? '📣' : '⚠️'}</span><span>${b.text}</span></div>` : '');

// ---------------------------------------------------------------------------
// Home: scenario, consent, optional demographics
// ---------------------------------------------------------------------------
function drawHome() {
  root.innerHTML = `
    <section class="p-hero">
      <h1>How can we help?</h1>
      <p>Pathfinder Service Portal · it’s 4:45 PM on a Friday</p>
      <div class="p-search"><input aria-label="Search" placeholder="Search knowledge, catalog and tickets" disabled><span>⌕</span></div>
    </section>
    ${MODE === 'demo' ? '<div class="alert error"><b>Demo mode.</b> This copy isn’t connected to the shared study database, so tickets stay in this browser and are <b>not</b> study data.</div>' : ''}
    <div class="p-grid">
      <div class="card">
        <h2>Your Friday-afternoon shift</h2>
        <p class="muted">You’re a project lead at a fast-growing company with <b>six urgent IT requests</b> to log before the end of the day.
        You’ll file three in the classic <b>ServiceNow catalog</b> and three with the new <b>AI agent</b>. Describe each problem <b>in your own words</b>, just as you would at work.</p>
        <div class="catalog" style="margin:16px 0 20px">
          <div class="tile"><b>ServiceNow catalog</b><span class="muted">Password · Software · Boardroom AV</span></div>
          <div class="tile"><b>✨ AI agent</b><span class="muted">MFA · Software install · Room camera</span></div>
        </div>
        <form id="start">
          <div class="row2">
            <div class="field"><label for="years">Years of work experience <span class="hint">(optional)</span></label><input id="years" type="number" min="0" max="25" placeholder="e.g. 6"></div>
            <div class="field"><label for="level">Job level <span class="hint">(optional)</span></label>
              <select id="level"><option value="">Prefer not to say</option>${JOB_LEVELS.map((l) => `<option>${l}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label for="role">Job role <span class="hint">(optional)</span></label>
            <select id="role"><option value="">Prefer not to say</option>${JOB_ROLES.map((l) => `<option>${l}</option>`).join('')}</select></div>
          <div class="consent-box">
            <b>About this study.</b> This is a teaching exercise run by Natalie Zachariah for a statistics course and the AI Pathfinders session.
            It takes about 8–10 minutes. Taking part is <b>voluntary</b>: you can watch without taking part, skip any optional question, or stop at any time with no consequence.
            We record your ticket timings, your ratings, what you type into tickets, and any optional demographics. We do <b>not</b> record your name, email or IP address in the study data.
            Results are shown to the group only as charts, and small groups are hidden. Some details of the study will only be explained at the end.
            You’ll then get a participant code and can withdraw your data. Please don’t type personal or confidential information.
            Questions? Message <b>Natalie Zachariah on Teams</b>.
          </div>
          <label style="display:flex;gap:10px;align-items:flex-start;font-size:14px;margin:6px 0 16px">
            <input id="consent" type="checkbox" style="margin-top:4px">
            <span>I’m 18 or older, I’ve read the above, and I agree to take part.</span>
          </label>
          <div id="start-err"></div>
          <button class="btn primary" type="submit">Start my shift →</button>
        </form>
      </div>
      <aside class="card">
        <h3>About this portal</h3>
        <ul class="side-list">
          <li><span>Session</span><b>${esc(SESSION)}</b></li>
          <li><span>Takes about</span><b>8–10 min</b></li>
          <li><span>Data</span><b>${MODE === 'supabase' ? 'Shared with the class' : 'Demo (this browser)'}</b></li>
        </ul>
        <p class="muted" style="margin-top:14px">After your shift, the lesson pages turn everyone’s tickets into statistics and AI lessons, live.</p>
      </aside>
    </div>
    <p class="disclaimer">A ServiceNow-style training simulation for teaching statistics. Not affiliated with or endorsed by ServiceNow, Inc.</p>`;

  root.querySelector('#start').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!root.querySelector('#consent').checked) {
      root.querySelector('#start-err').innerHTML = '<div class="alert error">Please tick the consent box to start.</div>';
      return;
    }
    const yrs = root.querySelector('#years').value, aiFirst = rand() < 0.5;
    P = {
      id: `P-${Math.floor(rand() * 0xffffff).toString(16).toUpperCase().padStart(6, '0')}`,
      years: yrs === '' ? null : Math.max(0, Math.min(25, Number(yrs))),
      level: root.querySelector('#level').value || null,
      role: root.querySelector('#role').value || null,
      snowPrimed: rand() < 0.5 ? 1 : 0, aiPrimed: rand() < 0.5 ? 1 : 0,
      setOrder: aiFirst ? 'ai_first' : 'legacy_first', order: aiFirst ? [4, 5, 6, 1, 2, 3] : [1, 2, 3, 4, 5, 6],
      idx: 0, phase: 'intro', log: [], surveyDone: false,
    };
    save(); draw();
  });
}

// ---------------------------------------------------------------------------
// Set intro (where the banner is first shown)
// ---------------------------------------------------------------------------
function drawSetIntro() {
  const wf = TESTS[currentTest()].workflow, part = P.idx < 3 ? 1 : 2;
  root.innerHTML = `
    <div style="padding-top:28px"></div>
    <div class="card" style="max-width:760px;margin:0 auto">
      <p class="p-breadcrumb">Part ${part} of 2</p>
      <h2>${wf === AI ? '✨ Meet the AI agent' : 'The ServiceNow catalog'}</h2>
      <p class="muted" style="margin:8px 0 18px">${wf === AI
        ? 'For the next three requests, describe the problem and the AI agent built into the portal will fill in the whole ticket for you, including the shopping cart. Check its work, then submit.'
        : 'For the next three requests, use the standard catalog forms. Fill in the required fields, then check out through the Service Catalog Shopping Cart using the reference code in each ticket’s KB article.'}</p>
      ${bannerHtml(bannerFor(wf), true)}
      <button class="btn primary" id="go">Start part ${part} →</button>
    </div>`;
  root.querySelector('#go').addEventListener('click', () => { P.phase = 'task'; save(); draw(); });
}

// ---------------------------------------------------------------------------
// Ticket shell
// ---------------------------------------------------------------------------
function shell(t, bodyHtml) {
  const meta = TESTS[t];
  root.innerHTML = `
    <div style="padding-top:20px"></div>
    <div class="progress">${[0, 1, 2, 3, 4, 5].map((i) => `<span class="${i < P.idx ? 'done' : i === P.idx ? 'now' : ''}"></span>`).join('')}</div>
    ${bannerHtml(bannerFor(meta.workflow))}
    <div class="p-grid">
      <div class="card">
        <div class="p-breadcrumb">Home › ${meta.workflow === AI ? '✨ AI agent' : 'Service Catalog'} › ${meta.category}</div>
        <div class="p-record-head">
          <div><h2>${meta.name}</h2><span class="p-number">${task.number} · Ticket ${P.idx + 1} of 6</span></div>
          <span class="state-chip">${task.state || 'New'}</span>
        </div>
        <div id="alerts"></div>
        ${bodyHtml}
      </div>
      <aside class="card">
        <h3>Your situation</h3>
        <p style="margin:0 0 12px">${meta.prompt}</p>
        <p class="muted" style="margin:0 0 16px">Describe it in your own words. Typos are fine; real tickets are messy.</p>
        <hr style="border:0;border-top:1px solid var(--p-line);margin:16px 0">
        <button class="btn ghost" id="abandon" type="button">🏳️ Abandon ticket / I give up</button>
      </aside>
    </div>
    <p class="disclaimer">A ServiceNow-style training simulation. Not affiliated with ServiceNow, Inc.</p>`;
  root.querySelector('#abandon').addEventListener('click', () => finishTask({ rageQuit: true }));
}

function alertMsg(html, kind = 'error') {
  const a = root.querySelector('#alerts');
  if (a) a.innerHTML = `<div class="alert ${kind}">${html}</div>`;
  a?.scrollIntoView({ block: 'nearest' });
}

function drawTask() {
  const t = currentTest();
  if (!task || task.t !== t) task = { t, start: performance.now(), errors: 0, number: incNumber(), text: '', chosen: TESTS[t].category, aiCat: null, aiConf: null };
  return TESTS[t].workflow === AI ? drawAgentForm(t) : drawLegacy(t);
}

function finishTask({ rageQuit = false } = {}) {
  task.seconds = Math.round((performance.now() - task.start) / 100) / 10;
  task.rageQuit = rageQuit ? 1 : 0;
  P.phase = 'feedback'; P.pending = { ...task };
  save(); draw();
}

// Field markup shared by both sets. `values` pre-fills (AI agent); `aiHint` labels a field as AI-filled.
function fieldHtml(i, [label, kind, opts], value = '', aiHint = false) {
  const hint = aiHint ? ' <span class="hint">filled by AI</span>' : '';
  const input = kind === 'select'
    ? `<select id="f${i}"><option value="">-- None --</option>${opts.map((o) => `<option ${o === value ? 'selected' : ''}>${o}</option>`).join('')}</select>`
    : `<input id="f${i}" placeholder="${opts}" value="${esc(value)}">`;
  return `<div class="field"><label><span class="req">*</span>${label}${hint}</label>${input}</div>`;
}

const FILLER = 'In accordance with the Unified Request Fulfilment Framework (URFF) and subject to the governance provisions of Annex 14(c), all service interactions shall be classified, triaged and routed through the appropriate assignment group as defined in the Configuration Management Database, except where superseded by regional addenda, change-freeze windows or ad-hoc executive exceptions logged in the Exception Register (see KB0009921, KB0011004 and the deprecated KB0003318). SLA clocks commence upon validated categorisation rather than submission, and partially completed records are auto-archived after 72 business hours.';

const kbArticle = (meta) => `
  <div class="kb" style="margin-top:10px">
    <p><b>1.1 Scope.</b> ${FILLER}</p>
    <p><b>1.2 Submission.</b> Pursuant to the platform consolidation initiative, discrete request forms no longer transmit records directly.
    Requesters must add the item to the Service Catalog Shopping Cart by entering the cart reference code ${meta.cart} in the Cart Reference field
    and proceeding to checkout, after which the record is created in a pending-approval state. ${FILLER}</p>
  </div>`;

// ---------------------------------------------------------------------------
// ServiceNow set: the same effort for every ticket
// ---------------------------------------------------------------------------
function drawLegacy(t) {
  const meta = TESTS[t], fields = FIELDS[meta.type];
  shell(t, `
    <form id="ticket">
      <div class="row2">${fieldHtml(0, fields[0])}${fieldHtml(1, fields[1])}</div>
      <div class="row2">${fieldHtml(2, fields[2])}${fieldHtml(3, fields[3])}</div>
      <div class="field"><label><span class="req">*</span>Describe the issue in your own words</label><textarea id="desc" placeholder="What’s happening?"></textarea></div>
      <p class="muted">ℹ️ Requests are submitted through the Service Catalog Shopping Cart. Your cart reference is in the knowledge article below.</p>
      <details class="kb-link">
        <summary>📎 ${meta.kb}: Request Fulfilment Procedures (Rev. 47)</summary>
        ${kbArticle(meta)}
        <div class="field" style="margin-top:8px"><label><span class="req">*</span>Cart Reference</label><input id="code" placeholder="CART-…"></div>
        <button class="btn primary" type="submit">🛒 Proceed to Checkout</button>
      </details>
    </form>`);
  root.querySelector('#ticket').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = (id) => root.querySelector(id).value.trim();
    if (['#f0', '#f1', '#f2', '#f3', '#desc'].some((id) => !v(id))) { task.errors++; return alertMsg('The following mandatory fields are not filled in. Please complete them and check out again.'); }
    if (meta.type === 'software' && !/^CC-\d{4}$/i.test(v('#f1'))) { task.errors++; return alertMsg('Invalid cost center. Expected the format CC-#### (for example CC-4410).'); }
    if (v('#code').toUpperCase() !== meta.cart) { task.errors++; return alertMsg('Checkout failed: invalid cart reference. Please consult the knowledge article.'); }
    task.text = v('#desc');
    finishTask();
  });
}

// ---------------------------------------------------------------------------
// AI agent set: the agent fills in every field and the cart
// ---------------------------------------------------------------------------
function drawAgentForm(t) {
  const meta = TESTS[t], fields = FIELDS[meta.type], aiTeam = P.aiPrimed === 1;
  const inject = !aiTeam && AI_ERROR_TESTS.includes(t);
  shell(t, `
    <div class="ai-panel">
      <div class="ai-head">✨ AI agent</div>
      <div class="field" style="margin:0"><label for="desc">Describe what you need, in your own words</label>
        <textarea id="desc" placeholder="e.g. my laptop won’t charge and I have a demo in an hour"></textarea></div>
      <div class="actions" style="margin-top:10px"><button class="btn primary" id="fill" type="button">✨ Fill in my ticket</button><span class="muted" id="thinking"></span></div>
    </div>
    <form id="ticket" style="display:none;margin-top:18px">
      <div class="ai-note" id="note"></div>
      <div class="row2">
        <div class="field"><label>Category <span class="hint">filled by AI</span></label><select id="cat">${CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Short description <span class="hint">filled by AI</span></label><input id="short"></div>
      </div>
      <div id="aifields"></div>
      <div class="field"><label>Cart Reference <span class="hint">filled by AI</span></label><input id="code"></div>
      <div class="actions"><button class="btn primary" type="submit">Submit</button><span class="muted">Change anything the AI got wrong.</span></div>
    </form>`);
  const $ = (id) => root.querySelector(id);
  $('#fill').addEventListener('click', () => {
    const text = $('#desc').value.trim();
    if (!text) { task.errors++; return alertMsg('Tell the AI agent what you need first.'); }
    task.text = text;
    $('#thinking').textContent = 'Reading your request…';
    $('#fill').disabled = true;
    setTimeout(() => {
      const answer = (label, fallback) => (inject && AI_WRONG[t][label]) || ANSWERS[t][label] || fallback;
      const vals = fields.map(([label, , , correct]) => answer(label, correct));
      $('#aifields').innerHTML = `<div class="row2">${fieldHtml(0, fields[0], vals[0], true)}${fieldHtml(1, fields[1], vals[1], true)}</div>
        <div class="row2">${fieldHtml(2, fields[2], vals[2], true)}${fieldHtml(3, fields[3], vals[3], true)}</div>`;
      $('#cat').value = meta.category;
      $('#short').value = text.length > 70 ? `${text.slice(0, 67)}…` : text;
      $('#code').value = inject ? AI_WRONG[t].cart : meta.cart;
      task.aiCat = meta.category;
      task.aiConf = Math.round((0.88 + rand() * 0.09) * 100) / 100;
      task.injected = inject ? 1 : 0;
      $('#note').innerHTML = aiTeam
        ? `✨ The AI agent filled this in with <b>${Math.round(task.aiConf * 100)}% confidence</b>. Review it, then submit.`
        : '✨ The AI agent filled in your ticket. Review it, then submit.';
      $('#thinking').textContent = ''; $('#fill').disabled = false; $('#fill').textContent = '↻ Re-fill from my description';
      $('#ticket').style.display = 'block';
    }, 700);
  });
  $('#ticket').addEventListener('submit', (e) => {
    e.preventDefault();
    task.chosen = $('#cat').value;
    if (task.chosen !== task.aiCat) task.errors++;           // a category correction counts as a fix-up
    if (task.injected) {
      // Caught = the participant fixed the room the agent got wrong before submitting.
      const roomIdx = fields.findIndex(([label]) => label === 'Room');
      const room = norm($(`#f${roomIdx}`).value);
      task.caught = room.includes('3a') && !room.includes('7c') ? 1 : 0;
      if (task.caught) task.errors++;
    }
    task.state = 'Assigned';
    finishTask();                                             // AI tickets always submit, right or wrong
  });
}

// ---------------------------------------------------------------------------
// Ratings after each ticket, final survey, debrief
// ---------------------------------------------------------------------------
function scaleHtml(id, lo, hi, loLabel, hiLabel) {
  const n = hi - lo + 1;
  return `<div class="scale ${n === 11 ? 'eleven' : ''}" data-scale="${id}">${Array.from({ length: n }, (_, i) => `<button type="button" data-v="${lo + i}">${lo + i}</button>`).join('')}</div>
    <div class="scale-ends"><span>${loLabel}</span><span>${hiLabel}</span></div>`;
}
function wireScales(values) {
  root.querySelectorAll('[data-scale]').forEach((s) => s.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    s.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on');
    values[s.dataset.scale] = Number(b.dataset.v);
  })));
}

// The consequence of an uncaught AI error. A fictional internal email; no real person or company.
function angryEmail(r) {
  return `
    <div class="email">
      <div class="email-head">
        <div><b>AV Operations</b> &lt;av-ops@pathfinder-corp.example&gt;</div>
        <div class="muted">To: you · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        <div class="email-subj">RE: ${esc(r.number)}: Meeting room camera. WRONG ROOM. Again.</div>
      </div>
      <div class="email-body">
        <p>Hi,</p>
        <p>We just sent a technician to <b>Meeting room 7C</b> because that’s what your ticket said. There is nothing wrong with the camera in 7C.
        Your cart reference <b>CART-6091</b> doesn’t exist either, so the request has been sitting in a queue nobody owns.</p>
        <p>Your client call in 3A starts in ten minutes. We’ve re-queued it, but it’s now behind 14 other tickets on a Friday afternoon.</p>
        <p><b>Please check your tickets before you submit them.</b> We can’t fix the room you didn’t tell us about.</p>
        <p>Dana<br>AV Operations</p>
      </div>
    </div>`;
}

function drawTicketFeedback() {
  const t = currentTest(), r = P.pending, values = {}, meta = TESTS[t];
  const email = r.injected && !r.caught && !r.rageQuit;
  const status = r.rageQuit ? `<div class="alert error">Ticket abandoned after <b>${r.seconds}s</b>.</div>`
    : email ? `<div class="alert success"><b>${r.number}</b> submitted in <b>${r.seconds}s</b>.</div><div class="alert error">📧 <b>1 new email</b> about this ticket arrived a few minutes later:</div>${angryEmail(r)}`
    : r.injected && r.caught ? `<div class="alert success"><b>${r.number}</b> submitted in <b>${r.seconds}s</b>. You caught the AI agent’s mistake (wrong room) before submitting, and AV went straight to 3A.</div>`
    : `<div class="alert success"><b>${r.number}</b> submitted in <b>${r.seconds}s</b>.</div>`;
  root.innerHTML = `
    <div style="padding-top:20px"></div>
    <div class="progress">${[0, 1, 2, 3, 4, 5].map((i) => `<span class="${i <= P.idx ? 'done' : ''}"></span>`).join('')}</div>
    <div class="card" style="max-width:760px;margin:0 auto">
      ${status}
      <h2>Quick pulse check</h2>
      <p class="muted">Two taps. Your honest reaction is the data.</p>
      <div class="field"><label>How frustrated are you with this ticket?</label>${scaleHtml('frustration', 1, 10, '1 · not at all', '10 · extremely')}</div>
      <div class="field"><label>How efficient was ${meta.workflow === AI ? 'the AI agent' : 'ServiceNow'} for this request?</label>${scaleHtml('efficiency', 1, 10, '1 · useless', '10 · flawless')}</div>
      <div id="alerts"></div>
      <button class="btn primary" id="next">${P.idx === 5 ? 'Finish shift →' : 'Next ticket →'}</button>
    </div>`;
  wireScales(values);
  root.querySelector('#next').addEventListener('click', async (e) => {
    if (!values.frustration || !values.efficiency) return alertMsg('Please pick a number on both scales.');
    const ai = meta.workflow === AI;
    const row = {
      participant_id: P.id, source: 'live', submitted_at: new Date().toISOString(), session_label: SESSION,
      years_experience: P.years, job_level: P.level, job_role: P.role,
      snow_primed: P.snowPrimed, ai_primed: P.aiPrimed, set_order: P.setOrder,
      test_num: t, position: P.idx + 1, test_name: meta.name, ticket_type: meta.type, workflow: meta.workflow, primed: ai ? P.aiPrimed : P.snowPrimed,
      completion_time: r.seconds, error_count: r.errors, rage_quit: r.rageQuit, frustration: values.frustration, efficiency: values.efficiency,
      ticket_text: (r.text || '').slice(0, 500), chosen_category: r.rageQuit ? null : r.chosen,
      ai_category: ai ? r.aiCat : null, ai_confidence: ai ? r.aiConf : null,
      ai_correct: ai && r.aiCat && !r.rageQuit ? (r.aiCat === r.chosen ? 1 : 0) : null,
      ai_error_injected: ai && r.aiCat ? (r.injected ? 1 : 0) : null,
      ai_error_caught: r.injected && !r.rageQuit ? r.caught : null,
    };
    e.target.disabled = true;
    try { await addSubmission(row); } catch (err) {
      e.target.disabled = false;
      return alertMsg(`Couldn’t save your answer (${esc(err.message)}). Check your connection and press the button again.`);
    }
    P.log.push({ number: r.number, name: meta.name, workflow: meta.workflow, seconds: r.seconds, rageQuit: r.rageQuit, email });
    P.idx += 1; P.pending = null; task = null;
    P.phase = P.idx === 3 ? 'intro' : 'task';
    save(); refresh(); draw(); window.scrollTo(0, 0);
  });
}

function drawFinalSurvey() {
  const values = {};
  root.innerHTML = `
    <div style="padding-top:20px"></div>
    <div class="card" style="max-width:720px;margin:0 auto">
      <h2>Last step: your verdict</h2>
      <p class="muted">This feedback goes to the platform owner (that’s the class).</p>
      <div class="field"><label>How likely are you to recommend the ServiceNow catalog to a colleague?</label>${scaleHtml('nps', 0, 10, '0 · not at all', '10 · extremely likely')}</div>
      <div class="field"><label>How much would you trust the AI agent with your next ticket?</label>${scaleHtml('ai_trust', 1, 10, '1 · not at all', '10 · completely')}</div>
      <div class="field"><label>Next time, which would you rather use?</label>
        <div class="chips"><button class="chip" type="button" data-p="0">ServiceNow catalog</button><button class="chip" type="button" data-p="1">✨ AI agent</button></div></div>
      <div class="field"><label>Before the ServiceNow tickets, did you see a message about ServiceNow?</label>
        <div class="chips" data-mc="mc_snow"><button class="chip" type="button" data-v="yes">Yes</button><button class="chip" type="button" data-v="no">No</button><button class="chip" type="button" data-v="unsure">Not sure</button></div></div>
      <div class="field"><label>Before the AI-agent tickets, did you see a message about AI?</label>
        <div class="chips" data-mc="mc_ai"><button class="chip" type="button" data-v="yes">Yes</button><button class="chip" type="button" data-v="no">No</button><button class="chip" type="button" data-v="unsure">Not sure</button></div></div>
      <div class="field"><label for="comment">What should the platform team fix first? <span class="hint">(optional, no personal info)</span></label><textarea id="comment" maxlength="400"></textarea></div>
      <div id="alerts"></div>
      <button class="btn primary" id="send">Submit feedback</button>
    </div>`;
  wireScales(values);
  root.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('[data-p]').forEach((x) => x.classList.remove('on')); b.classList.add('on'); values.prefer = Number(b.dataset.p);
  }));
  root.querySelectorAll('[data-mc]').forEach((g) => g.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    g.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); values[g.dataset.mc] = b.dataset.v;
  })));
  root.querySelector('#send').addEventListener('click', async (e) => {
    if (values.nps === undefined || !values.ai_trust || values.prefer === undefined || !values.mc_snow || !values.mc_ai) return alertMsg('Please answer every question except the optional comment.');
    e.target.disabled = true;
    try {
      await addFeedback({ participant_id: P.id, session_label: SESSION, snow_primed: P.snowPrimed, ai_primed: P.aiPrimed, job_level: P.level,
        nps_servicenow: values.nps, ai_trust: values.ai_trust, prefer_ai: values.prefer, mc_snow: values.mc_snow, mc_ai: values.mc_ai, comment: root.querySelector('#comment').value.trim().slice(0, 400) || null });
    } catch (err) {
      e.target.disabled = false;
      return alertMsg(`Couldn’t save your feedback (${esc(err.message)}). Please try again.`);
    }
    P.surveyDone = true; save(); refresh(); draw();
  });
}

function drawDone() {
  const med = (wf) => { const xs = P.log.filter((l) => l.workflow === wf && !l.rageQuit).map((l) => l.seconds).sort((a, b) => a - b); return xs.length ? xs[Math.floor(xs.length / 2)] : null; };
  const gotEmail = P.log.some((l) => l.email);
  root.innerHTML = `
    <div style="padding-top:20px"></div>
    <div class="p-grid">
      <div class="card">
        <h2>🏁 Shift complete, thank you</h2>
        <div class="alert info" style="margin-top:12px"><b>What was really going on.</b> This was an experiment with two coin flips.
        The first decided whether you saw a <i>positive</i> banner about ServiceNow: you ${P.snowPrimed ? '<b>did</b>' : '<b>didn’t</b>'}.
        The second put you ${P.aiPrimed
          ? 'on the <b>AI team</b>: you were warned that AI hallucinates and shown its confidence, and its answers were in fact always right.'
          : 'on the <b>no-warning team</b>: you saw no warning and no confidence score, and on the meeting-room ticket the agent quietly filled in the wrong room and cart code.'}
        ${!P.aiPrimed ? (gotEmail ? ' It slipped through, hence the angry email.' : ' You caught it before submitting.') : ''}
        The question: do warnings, confidence scores and mistakes change how efficient a system <i>feels</i>, compared with what the stopwatch says? Please don’t tell people who haven’t done it yet.</div>
        <div class="stat-row">
          <div><b>${med(LEGACY) ?? '–'}s</b><span>your median ServiceNow ticket</span></div>
          <div><b>${med(AI) ?? '–'}s</b><span>your median AI-agent ticket</span></div>
        </div>
        <p class="muted">The email from “AV Operations” was fictional, and so were the room mix-up and the cart codes. Nobody was actually sent to the wrong room.</p>
        <div class="consent-box">
          <b>Your participant code: <span class="p-number" style="font-size:15px">${esc(P.id)}</span></b><br>
          Now that you know what the study was about, you can withdraw. Your tickets and survey will be excluded from every chart and from the analysis.
          You can also message Natalie Zachariah on Teams with this code to withdraw later, until the analysis is finished.
          <div class="actions" style="margin-top:10px"><button class="btn danger" id="withdraw" type="button" ${P.withdrawn ? 'disabled' : ''}>${P.withdrawn ? 'Your data has been withdrawn' : 'Withdraw my data'}</button><span id="wd-msg" class="muted"></span></div>
        </div>
        <p>Otherwise, head to <a href="#/noise"><b>page 2</b></a> and watch everyone’s tickets turn into statistics.</p>
        <button class="btn secondary" id="again" type="button">Start a new participant on this device</button>
      </div>
      <aside class="card">
        <h3>Your tickets</h3>
        <ul class="side-list">${P.log.map((l) => `<li><span>${esc(l.number)}<br><span class="muted">${l.workflow === AI ? '✨ ' : ''}${esc(l.name)}${l.email ? ' · 📧' : ''}</span></span><b>${l.rageQuit ? 'abandoned' : `${l.seconds}s`}</b></li>`).join('')}</ul>
      </aside>
    </div>`;
  root.querySelector('#again').addEventListener('click', () => { P = null; task = null; sessionStorage.removeItem(KEY); draw(); });
  root.querySelector('#withdraw').addEventListener('click', async (e) => {
    if (!confirm('Withdraw all of your tickets and survey answers from this study?')) return;
    e.target.disabled = true;
    try { await addWithdrawal(P.id, SESSION); } catch (err) {
      e.target.disabled = false; root.querySelector('#wd-msg').textContent = `Couldn’t withdraw (${err.message}). Please try again or email your code.`; return;
    }
    P.withdrawn = true; save(); refresh(); draw();
  });
}

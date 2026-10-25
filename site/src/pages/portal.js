// Page 1: a ServiceNow-style Service Portal and the data-collection instrument.
//
// Each participant files six noisy tickets in two sets (random order):
//   ServiceNow set (tests 1-3): classic catalog forms, ending in a documentation hunt.
//   AI agent set   (tests 4-6): an AI agent built into the form reads your description
//                               and fills the ticket in; you review and submit.
// Independent coin flips decide whether the positive ServiceNow banner and the negative
// AI banner are shown. After every ticket: frustration and efficiency ratings. At the end:
// NPS for ServiceNow, trust in the AI agent, and which one they'd rather use.

import { AI, BANNERS, CART_CODE, CATEGORIES, JOB_LEVELS, JOB_ROLES, LEGACY, TESTS } from '../data/design.js';
import { classify } from '../data/classifier.js';
import { addFeedback, addSubmission, MODE } from '../data/store.js';
import { SESSION, refresh } from '../data/context.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const incNumber = () => `INC${String(10000 + Math.floor(rand() * 89999)).padStart(7, '0')}`;
const GROUPS = {
  'Access & Passwords': 'Identity & Access Mgmt', Software: 'Software Asset Mgmt', 'Network & VPN': 'Network Operations',
  Hardware: 'End User Computing', 'Facilities & AV': 'Workplace & AV', 'Incident / Outage': 'Major Incident Team',
};

// Participant state survives a refresh (sessionStorage) so a reload mid-study doesn't lose progress.
const KEY = 'snowlab.participant.v2';
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
          <label style="display:flex;gap:10px;align-items:flex-start;font-size:14px;margin:6px 0 16px">
            <input id="consent" type="checkbox" style="margin-top:4px">
            <span>I agree to take part. My tickets, timings and ratings are recorded <b>anonymously</b> and shown to the group as class data.
            I won’t type personal or confidential information, and I can stop at any time.</span>
          </label>
          <div id="start-err"></div>
          <button class="btn primary" type="submit">Start my shift →</button>
        </form>
      </div>
      <aside class="card">
        <h3>About this portal</h3>
        <ul class="side-list">
          <li><span>Session</span><b>${esc(SESSION)}</b></li>
          <li><span>Takes about</span><b>6–8 min</b></li>
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
        ? 'For the next three requests, describe the problem and the AI agent built into the portal will read it and fill in the ticket for you. Check its work, then submit.'
        : 'For the next three requests, use the standard catalog forms. Fill in the required fields and submit.'}</p>
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
        <button class="btn ${t === 3 ? 'danger' : 'ghost'}" id="abandon" type="button">🏳️ Abandon ticket / I give up</button>
      </aside>
    </div>
    <p class="disclaimer">A ServiceNow-style training simulation. Not affiliated with ServiceNow, Inc.</p>`;
  root.querySelector('#abandon').addEventListener('click', () => finishTask({ rageQuit: true }));
}

function alertMsg(html, kind = 'error') {
  const a = root.querySelector('#alerts');
  if (a) a.innerHTML = `<div class="alert ${kind}">${html}</div>`;
}

function drawTask() {
  const t = currentTest();
  if (!task || task.t !== t) task = { t, start: performance.now(), errors: 0, number: incNumber(), text: '', chosen: TESTS[t].category, aiCat: null, aiConf: null };
  if (t === 1 || t === 2) return drawLegacyForm(t);
  if (t === 3) return drawDocHunt();
  return drawAgentForm(t);
}

function finishTask({ rageQuit = false } = {}) {
  task.seconds = Math.round((performance.now() - task.start) / 100) / 10;
  task.rageQuit = rageQuit ? 1 : 0;
  P.phase = 'feedback'; P.pending = { ...task };
  save(); draw();
}

// ---------------------------------------------------------------------------
// ServiceNow set: catalog forms and the documentation hunt
// ---------------------------------------------------------------------------
function drawLegacyForm(t) {
  const fields = t === 1 ? `
      <div class="row2">
        <div class="field"><label><span class="req">*</span>Requested for</label><input id="f1" placeholder="Your name or employee ID"></div>
        <div class="field"><label><span class="req">*</span>Application</label>
          <select id="f2"><option value="">-- None --</option><option>Expense system</option><option>HR portal</option><option>Email</option><option>Single sign-on</option></select></div>
      </div>
      <div class="row2">
        <div class="field"><label><span class="req">*</span>Urgency</label>
          <select id="f3"><option value="">-- None --</option><option>1 - High</option><option>2 - Medium</option><option>3 - Low</option></select></div>
        <div class="field"><label><span class="req">*</span>Assignment group</label>
          <select id="f4"><option value="">-- None --</option>${Object.values(GROUPS).map((g) => `<option>${g}</option>`).join('')}</select><span class="hint">Not sure? Pick your best guess.</span></div>
      </div>`
    : `
      <div class="row2">
        <div class="field"><label><span class="req">*</span>Software</label>
          <select id="f1"><option value="">-- None --</option><option>Tableau Desktop</option><option>Figma</option><option>Adobe Creative Cloud</option><option>JetBrains All Products</option></select></div>
        <div class="field"><label><span class="req">*</span>Cost center</label><input id="f2" placeholder="CC-0000"><span class="hint">Format CC-#### (four digits)</span></div>
      </div>
      <div class="row2">
        <div class="field"><label><span class="req">*</span>Approving manager</label>
          <select id="f3"><option value="">-- None --</option><option>Direct manager</option><option>Department head</option><option>Finance partner</option></select></div>
        <div class="field"><label><span class="req">*</span>Licence term</label>
          <select id="f4"><option value="">-- None --</option><option>30 days</option><option>12 months</option><option>Perpetual</option></select></div>
      </div>`;
  shell(t, `
    <form id="ticket">
      ${fields}
      <div class="field"><label><span class="req">*</span>Describe the issue in your own words</label><textarea id="desc" placeholder="What’s happening?"></textarea></div>
      <div class="actions"><button class="btn primary" type="submit">${t === 1 ? 'Submit' : 'Order Now'}</button></div>
    </form>`);
  root.querySelector('#ticket').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = (id) => root.querySelector(id).value.trim();
    if (['#f1', '#f2', '#f3', '#f4', '#desc'].some((id) => !v(id))) { task.errors++; return alertMsg('The following mandatory fields are not filled in. Please complete them and resubmit.'); }
    if (t === 2 && !/^CC-\d{4}$/i.test(v('#f2'))) { task.errors++; return alertMsg('Invalid cost center. Expected the format CC-#### (for example CC-4410).'); }
    task.text = v('#desc');
    finishTask();
  });
}

const FILLER = 'In accordance with the Unified Request Fulfilment Framework (URFF) and subject to the governance provisions of Annex 14(c), all service interactions shall be classified, triaged and routed through the appropriate assignment group as defined in the Configuration Management Database, except where superseded by regional addenda, change-freeze windows or ad-hoc executive exceptions logged in the Exception Register (see KB0009921, KB0011004 and the deprecated KB0003318). SLA clocks commence upon validated categorisation rather than submission, and partially completed records are auto-archived after 72 business hours.';

function drawDocHunt() {
  shell(3, `
    <div class="row2">
      <div class="field"><label><span class="req">*</span>Request type</label>
        <select id="f1"><option value="">-- None --</option><option>Facilities</option><option>AV / Conferencing</option><option>General inquiry</option></select></div>
      <div class="field"><label><span class="req">*</span>Room</label><input id="f2" placeholder="e.g. Boardroom 4B"></div>
    </div>
    <div class="field"><label><span class="req">*</span>Describe the issue in your own words</label><textarea id="desc"></textarea></div>
    <p class="muted">ℹ️ For your convenience, submission has been streamlined. See the documentation below.</p>
    <div class="kb">${[1, 2, 3, 4].map((i) => `<p><b>§${i}.</b> ${FILLER}</p>`).join('')}</div>
    <details class="kb-link">
      <summary>📎 KB0012847: Unified Request Fulfilment Procedures (Rev. 47)</summary>
      <div class="kb" style="margin-top:10px">
        <p><b>1.1 Scope.</b> ${FILLER}</p>
        <p><b>1.2 Submission.</b> Pursuant to the platform consolidation initiative, discrete request forms no longer transmit records directly.
        Requesters must add the item to the Service Catalog Shopping Cart by entering the cart reference code ${CART_CODE} in the Cart Reference field
        below and proceeding to checkout, after which the record is created in a pending-approval state. ${FILLER}</p>
        <p><b>1.3 Exceptions.</b> ${FILLER}</p>
      </div>
      <div class="field" style="margin-top:8px"><label>Cart Reference</label><input id="code" placeholder="CART-…"></div>
      <button class="btn primary" type="button" id="checkout">🛒 Proceed to Checkout</button>
    </details>`);
  root.querySelector('#checkout').addEventListener('click', () => {
    const v = (id) => root.querySelector(id).value.trim();
    if (v('#code').toUpperCase() !== CART_CODE) { task.errors++; return alertMsg('Checkout failed: invalid cart reference. Please consult the documentation.'); }
    if (!v('#f1') || !v('#f2') || !v('#desc')) { task.errors++; return alertMsg('Checkout failed: the request form above is incomplete.'); }
    task.text = v('#desc');
    finishTask();
  });
}

// ---------------------------------------------------------------------------
// AI agent set: the agent reads your words and fills the form in
// ---------------------------------------------------------------------------
function drawAgentForm(t) {
  shell(t, `
    <div class="ai-panel">
      <div class="ai-head">✨ AI agent</div>
      <div class="field" style="margin:0"><label for="desc">Describe what you need, in your own words</label>
        <textarea id="desc" placeholder="e.g. my laptop won’t charge and I have a demo in an hour"></textarea></div>
      <div class="actions" style="margin-top:10px"><button class="btn primary" id="fill" type="button">✨ Fill in my ticket</button><span class="muted" id="thinking"></span></div>
    </div>
    <form id="ticket" style="display:none;margin-top:18px">
      <div class="ai-note" id="conf"></div>
      <div class="row2">
        <div class="field"><label>Category <span class="hint">filled by AI</span></label><select id="cat">${CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Priority <span class="hint">filled by AI</span></label><select id="pri"><option>2 - High</option><option>3 - Moderate</option><option>4 - Low</option></select></div>
      </div>
      <div class="row2">
        <div class="field"><label>Assignment group <span class="hint">filled by AI</span></label><input id="grp" readonly></div>
        <div class="field"><label>Short description <span class="hint">filled by AI</span></label><input id="short"></div>
      </div>
      <div class="actions"><button class="btn primary" type="submit">Submit</button><span class="muted">Change anything the AI got wrong.</span></div>
    </form>`);
  const $ = (id) => root.querySelector(id);
  $('#cat').addEventListener('change', () => { $('#grp').value = GROUPS[$('#cat').value]; });
  $('#fill').addEventListener('click', () => {
    const text = $('#desc').value.trim();
    if (!text) { task.errors++; return alertMsg('Tell the AI agent what you need first.'); }
    task.text = text;
    $('#thinking').textContent = 'Reading your request…';
    $('#fill').disabled = true;
    setTimeout(() => {
      const r = classify(text);
      task.aiCat = r.top.category; task.aiConf = r.top.p;
      $('#cat').value = r.top.category; $('#grp').value = GROUPS[r.top.category];
      $('#pri').value = /urgent|asap|now|client|minutes|today|down/i.test(text) ? '2 - High' : '3 - Moderate';
      $('#short').value = text.length > 70 ? `${text.slice(0, 67)}…` : text;
      $('#conf').innerHTML = `✨ The AI agent filled this in with <b>${Math.round(r.top.p * 100)}% confidence</b>. Review it, then submit.`;
      $('#thinking').textContent = ''; $('#fill').disabled = false; $('#fill').textContent = '↻ Re-fill from my description';
      $('#ticket').style.display = 'block';
    }, 700);
  });
  $('#ticket').addEventListener('submit', (e) => {
    e.preventDefault();
    task.chosen = $('#cat').value;
    if (task.chosen !== task.aiCat) task.errors++;   // a correction counts as one fix-up
    task.state = 'Assigned';
    finishTask();
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

function drawTicketFeedback() {
  const t = currentTest(), r = P.pending, values = {}, meta = TESTS[t];
  root.innerHTML = `
    <div style="padding-top:20px"></div>
    <div class="progress">${[0, 1, 2, 3, 4, 5].map((i) => `<span class="${i <= P.idx ? 'done' : ''}"></span>`).join('')}</div>
    <div class="card" style="max-width:720px;margin:0 auto">
      <div class="alert ${r.rageQuit ? 'error' : 'success'}">${r.rageQuit ? `Ticket abandoned after <b>${r.seconds}s</b>.` : `<b>${r.number}</b> submitted in <b>${r.seconds}s</b>.`}</div>
      <h2>Quick pulse check</h2>
      <p class="muted">Two taps. Your honest reaction is the data.</p>
      <div class="field"><label>How frustrated are you right now?</label>${scaleHtml('frustration', 1, 10, '1 · calm', '10 · rage')}</div>
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
    };
    e.target.disabled = true;
    try { await addSubmission(row); } catch (err) {
      e.target.disabled = false;
      return alertMsg(`Couldn’t save your answer (${esc(err.message)}). Check your connection and press the button again.`);
    }
    P.log.push({ number: r.number, name: meta.name, workflow: meta.workflow, seconds: r.seconds, rageQuit: r.rageQuit });
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
      <div class="field"><label for="comment">What should the platform team fix first? <span class="hint">(optional, no personal info)</span></label><textarea id="comment" maxlength="400"></textarea></div>
      <div id="alerts"></div>
      <button class="btn primary" id="send">Submit feedback</button>
    </div>`;
  wireScales(values);
  root.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('[data-p]').forEach((x) => x.classList.remove('on')); b.classList.add('on'); values.prefer = Number(b.dataset.p);
  }));
  root.querySelector('#send').addEventListener('click', async (e) => {
    if (values.nps === undefined || !values.ai_trust || values.prefer === undefined) return alertMsg('Please answer all three questions.');
    e.target.disabled = true;
    try {
      await addFeedback({ participant_id: P.id, session_label: SESSION, snow_primed: P.snowPrimed, ai_primed: P.aiPrimed, job_level: P.level,
        nps_servicenow: values.nps, ai_trust: values.ai_trust, prefer_ai: values.prefer, comment: root.querySelector('#comment').value.trim().slice(0, 400) || null });
    } catch (err) {
      e.target.disabled = false;
      return alertMsg(`Couldn’t save your feedback (${esc(err.message)}). Please try again.`);
    }
    P.surveyDone = true; save(); refresh(); draw();
  });
}

function drawDone() {
  const med = (wf) => { const xs = P.log.filter((l) => l.workflow === wf && !l.rageQuit).map((l) => l.seconds).sort((a, b) => a - b); return xs.length ? xs[Math.floor(xs.length / 2)] : null; };
  const seen = [P.snowPrimed ? 'the <b>positive ServiceNow</b> banner' : null, P.aiPrimed ? 'the <b>negative AI</b> banner' : null].filter(Boolean);
  root.innerHTML = `
    <div style="padding-top:20px"></div>
    <div class="p-grid">
      <div class="card">
        <h2>🏁 Shift complete, thank you</h2>
        <div class="alert info" style="margin-top:12px"><b>What was really going on.</b> This was an experiment. Two independent coin flips decided whether you saw a
        <i>positive</i> banner about ServiceNow and a <i>negative</i> banner about the AI agent. You saw ${seen.length ? seen.join(' and ') : 'neither banner'}.
        The question: do those words change how efficient a system <i>feels</i>, even when the stopwatch says otherwise? Please don’t tell people who haven’t done it yet.</div>
        <div class="stat-row">
          <div><b>${med(LEGACY) ?? '–'}s</b><span>your median ServiceNow ticket</span></div>
          <div><b>${med(AI) ?? '–'}s</b><span>your median AI-agent ticket</span></div>
        </div>
        <p>Now head to <a href="#/noise"><b>page 2</b></a> and watch everyone’s tickets turn into statistics.</p>
        <button class="btn secondary" id="again" type="button">Start a new participant on this device</button>
      </div>
      <aside class="card">
        <h3>Your tickets</h3>
        <ul class="side-list">${P.log.map((l) => `<li><span>${esc(l.number)}<br><span class="muted">${l.workflow === AI ? '✨ ' : ''}${esc(l.name)}</span></span><b>${l.rageQuit ? 'abandoned' : `${l.seconds}s`}</b></li>`).join('')}</ul>
      </aside>
    </div>`;
  root.querySelector('#again').addEventListener('click', () => { P = null; task = null; sessionStorage.removeItem(KEY); draw(); });
}

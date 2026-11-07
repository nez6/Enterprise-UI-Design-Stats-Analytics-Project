// Page 7: the real class data from one finished session, as a starting point for the analysis.
//
// Privacy (docs/IRB_REVIEW.md): this page only reads the de-identified views, so it has no free
// text. Random participant codes are replaced with P01, P02... because they double as withdrawal
// codes. Demographics are never shown per row, and groups under 5 are merged.
// Anyone can insert rows through the public key, so nothing stored as text is ever rendered:
// labels come from design.js, and job levels are matched against its fixed list.

import * as d3 from 'd3';
import { ARCHIVE_SESSION, loadArchive } from '../data/context.js';
import { WALKAWAY_SECONDS, perPerson } from '../data/clean.js';
import { AI, JOB_LEVELS, LABEL, LEGACY, TESTS } from '../data/design.js';
import { mean, median, sd } from '../stats/core.js';
import { C, axes, callout, el, f2, frame, hero, legend, pct, scene, statGrid, tip } from '../viz/common.js';

const COLOR = { [LEGACY]: C.blue, [AI]: C.yellow };
const MIN_CELL = 5;
const yesNo = (x) => (x ? 'Yes' : 'No');

function table(parent, head, body, numericFrom = 1) {
  const cls = (i) => (i >= numericFrom ? ' class="num"' : '');
  const wrap = parent.appendChild(el('div', { class: 'viz table-scroll' }));
  wrap.innerHTML = `<table class="ltable">
    <thead><tr>${head.map((h, i) => `<th${cls(i)}>${h}</th>`).join('')}</tr></thead>
    <tbody>${body.map((row) => `<tr>${row.map((c, i) => `<td${cls(i)}>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
  return wrap;
}

export function renderData(root) {
  hero(root, {
    kicker: 'Analysis · Session data',
    title: 'The class data',
    lede: `What people actually did in the <b>${ARCHIVE_SESSION}</b> session, loaded from the study database. Everything here is description: look at the data first, then test it.`,
    chapters: ['Real participants', 'Same rules as the analysis pipeline', 'De-identified'],
  });
  const body = root.appendChild(el('div', {}, '<div class="empty">Loading the session data…</div>'));
  loadArchive().then((data) => {
    if (!body.isConnected) return;
    body.innerHTML = '';
    if (!data.raw.length) { body.innerHTML = `<div class="empty">No tickets found for session “${ARCHIVE_SESSION}”.</div>`; return; }
    whoIsIn(body, data);
    times(body, data);
    ratings(body, data);
    questions(body, data);
    survey(body, data);
    browse(body, data);
  }).catch((err) => {
    console.warn('Session data unavailable:', err.message);
    if (body.isConnected) body.innerHTML = '<div class="empty">The session data couldn’t be loaded. The database may be paused or unreachable. Try again shortly.</div>';
  });
}

// ---------------------------------------------------------------------------
// Who is in the analysis, and who dropped out
// ---------------------------------------------------------------------------
function whoIsIn(root, { raw, clean }) {
  const s = scene(root, {
    title: 'Who is in the analysis',
    story: 'The cleaning rules were fixed before the session. Each row below shows who remains after that rule.',
  });
  const stats = s.appendChild(el('div'));
  const all = new Set(raw.map((r) => r.participant_id)).size;
  const kept = new Set(clean.rows.map((r) => r.participant_id)).size;
  statGrid(stats, [[all, 'people started'], [raw.length, 'tickets filed'], [kept, 'people analysed'], [clean.feedback.length, 'surveys from them']]);
  table(s, ['Rule', 'People left', 'Tickets left'], clean.funnel.map((f) => [f.rule, f.participants, f.rows]));

  const first = new Map();
  raw.forEach((r) => first.set(r.participant_id, r.set_order));
  const orderRow = (key, label) => {
    const ids = [...first].filter(([, o]) => o === key).map(([id]) => id);
    const out = ids.filter((id) => clean.reasons.has(id)).length;
    return [label, ids.length, ids.length - out, out, ids.length ? pct(out / ids.length) : '–'];
  };
  table(s, ['First set', 'Started', 'Analysed', 'Excluded', 'Excluded share'], [orderRow('ai_first', 'AI-assisted first'), orderRow('legacy_first', 'Classic first')]);
  callout(s, '<b>Check this before trusting the comparison.</b> Compare the excluded share across the two rows. If people tend to leave when they reach the classic catalog, the people who remain may like it more than those who left, and the cleaned data would understate how bad it feels.');
}

// ---------------------------------------------------------------------------
// Completion times
// ---------------------------------------------------------------------------
function times(root, { raw, clean }) {
  const s = scene(root, {
    title: 'How long each ticket took',
    story: 'Every ticket is one dot, on a log scale because a few very long tickets would flatten everything else. <b>Hollow dots</b> belong to people the rules excluded.',
  });
  const box = s.appendChild(el('div', { class: 'viz' }));
  const f = frame(box, { height: 400, margin: { top: 20, right: 24, bottom: 46, left: 160 } });
  const maxT = Math.max(d3.max(raw, (r) => r.completion_time), WALKAWAY_SECONDS);
  const x = d3.scaleLog().domain([Math.min(4, d3.min(raw, (r) => r.completion_time)), maxT * 1.15]).range([0, f.w]);
  const ids = Object.keys(TESTS).map(Number).filter((n) => raw.some((r) => r.test_num === n));
  const y = d3.scaleBand().domain(ids).range([0, f.h]).padding(0.2);
  axes(f, x, d3.scaleLinear().range([f.h, 0]), { xLabel: 'Completion time (seconds, log scale)', yTicks: 0 });
  f.g.select('.axis').call(d3.axisBottom(x).tickValues([5, 10, 30, 60, 120, 300, 600, 1800, 3600, 9000].filter((v) => v >= x.domain()[0] && v <= x.domain()[1])).tickFormat((v) => (v < 60 ? `${v}s` : `${Math.round(v / 60)}m`)));
  f.g.selectAll('.ylab').data(ids).join('text').attr('class', 'lbl muted').attr('x', -12)
    .attr('y', (n) => y(n) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text((n) => TESTS[n].short);
  f.g.append('line').attr('x1', x(WALKAWAY_SECONDS)).attr('x2', x(WALKAWAY_SECONDS)).attr('y1', 0).attr('y2', f.h).attr('stroke', C.muted).attr('stroke-dasharray', '4 4');
  f.g.append('text').attr('class', 'lbl muted').attr('x', x(WALKAWAY_SECONDS)).attr('y', -6).attr('text-anchor', 'middle').text('30 min rule');

  const keptIds = new Set(clean.rows.map((r) => r.participant_id));
  const jitter = d3.randomLcg(11);
  const t = tip();
  f.g.selectAll('circle').data(raw.filter((r) => TESTS[r.test_num])).join('circle')
    .attr('cx', (d) => x(d.completion_time)).attr('cy', (d) => y(d.test_num) + y.bandwidth() * (0.15 + 0.7 * jitter())).attr('r', 4.5)
    .attr('fill', (d) => (keptIds.has(d.participant_id) ? COLOR[TESTS[d.test_num].workflow] : 'none')).attr('fill-opacity', 0.75)
    .attr('stroke', (d) => COLOR[TESTS[d.test_num].workflow]).attr('stroke-width', 1.5)
    .on('mousemove', (ev, d) => t.show(`${TESTS[d.test_num].name}: <b>${Math.round(d.completion_time)}s</b>${d.rage_quit ? ' · abandoned' : ''}${keptIds.has(d.participant_id) ? '' : ' · person excluded'}`, ev))
    .on('mouseleave', t.hide);
  legend(s, [[LABEL[LEGACY], COLOR[LEGACY]], [LABEL[AI], COLOR[AI]]]);

  table(s, ['Ticket', 'Tickets', 'Median time', 'Mean efficiency', 'Mean frustration', 'Mean errors', 'Abandoned'],
    ids.map((n) => {
      const r = clean.rows.filter((d) => d.test_num === n);
      if (!r.length) return [TESTS[n].name, 0, '–', '–', '–', '–', '–'];
      return [TESTS[n].name, r.length, `${Math.round(median(r.map((d) => d.completion_time)))}s`, f2(mean(r.map((d) => d.efficiency))),
        f2(mean(r.map((d) => d.frustration))), f2(mean(r.map((d) => d.error_count))), d3.sum(r, (d) => d.rage_quit)];
    }));
  s.appendChild(el('p', { class: 'data-note' }, 'The table uses analysed people only. Ratings run from 1 to 10.'));
}

// ---------------------------------------------------------------------------
// Rating distributions
// ---------------------------------------------------------------------------
function ratings(root, { clean }) {
  const s = scene(root, {
    title: 'How people rated the tickets',
    story: 'Look at the whole shape before relying on an average. A mean can hide a split between people who loved a ticket and people who hated it.',
  });
  const grid = s.appendChild(el('div', { class: 'data-grid' }));
  const t = tip();
  const peak = d3.max([LEGACY, AI].flatMap((w) => ['efficiency', 'frustration'].flatMap((k) => d3.range(1, 11).map((v) => clean.rows.filter((r) => r.workflow === w && r[k] === v).length)))) || 1;
  [['efficiency', 'Efficiency rating'], ['frustration', 'Frustration rating']].forEach(([key, name]) => {
    [LEGACY, AI].forEach((w) => {
      const rows = clean.rows.filter((r) => r.workflow === w);
      const box = grid.appendChild(el('div', { class: 'viz' }, `<div class="data-chart-title">${name} · ${LABEL[w]}</div>`));
      const f = frame(box, { width: 440, height: 220, margin: { top: 10, right: 10, bottom: 42, left: 36 } });
      const x = d3.scaleBand().domain(d3.range(1, 11)).range([0, f.w]).padding(0.12);
      const y = d3.scaleLinear().domain([0, peak]).nice().range([f.h, 0]);
      axes(f, x, y, { xLabel: `${name} (1–10)`, yTicks: 4 });
      f.g.selectAll('.bar').data(d3.range(1, 11).map((v) => ({ v, n: rows.filter((r) => r[key] === v).length }))).join('rect').attr('class', 'bar')
        .attr('x', (d) => x(d.v)).attr('width', x.bandwidth()).attr('y', (d) => y(d.n)).attr('height', (d) => f.h - y(d.n)).attr('rx', 2).attr('fill', COLOR[w])
        .on('mousemove', (ev, d) => t.show(`Rated ${d.v}: <b>${d.n}</b> tickets`, ev)).on('mouseleave', t.hide);
    });
  });
}

// ---------------------------------------------------------------------------
// The study's questions, per person
// ---------------------------------------------------------------------------
function questions(root, { clean }) {
  const s = scene(root, {
    title: 'A first look at the study questions',
    story: 'The person is the unit of analysis, so each person’s tickets are averaged first. These are descriptive numbers with <b>no significance tests yet</b>.',
  });
  const people = perPerson(clean.rows);
  const row = (label, xs) => [label, xs.length, xs.length ? f2(mean(xs)) : '–', xs.length ? f2(median(xs)) : '–', xs.length > 1 ? f2(sd(xs)) : '–'];
  const pick = (key, arm, val) => people.filter((p) => p[arm] === val).map((p) => p[key]);
  table(s, ['Comparison', 'People', 'Mean', 'Median', 'SD'], [
    row('H1 · Classic efficiency, praise banner', pick('sn_eff', 'snow_primed', 1)),
    row('H1 · Classic efficiency, no banner', pick('sn_eff', 'snow_primed', 0)),
    row('H2 · AI efficiency, AI team (warned)', pick('ai_eff', 'ai_primed', 1)),
    row('H2 · AI efficiency, other team', pick('ai_eff', 'ai_primed', 0)),
    row('Paired · AI minus classic efficiency', people.map((p) => p.ai_eff - p.sn_eff)),
    row('Paired · AI minus classic frustration', people.map((p) => p.ai_frust - p.sn_frust)),
    row('Paired · AI ÷ classic time (geometric means)', people.map((p) => p.ai_time / p.sn_time)),
  ]);
  callout(s, '<b>Read H2 with care.</b> The two AI groups differ in three ways at once: the warning, the displayed confidence, and whether the agent made a planted error. A difference here can’t be credited to the warning alone. The ticket scenarios also differ between platforms, so the paired rows may partly reflect easier scenarios.');
}

// ---------------------------------------------------------------------------
// Final survey
// ---------------------------------------------------------------------------
function survey(root, { clean }) {
  const s = scene(root, { title: 'What people said at the end', story: 'Final survey answers from the people in the analysis, followed by whether they noticed the messages.' });
  const fb = clean.feedback;
  if (!fb.length) { s.appendChild(el('div', { class: 'empty' }, 'No surveys from analysed participants yet.')); return; }
  const stats = s.appendChild(el('div'));
  const nums = (key) => fb.map((f) => f[key]).filter((v) => Number.isFinite(v));
  const nps = nums('nps_servicenow');
  const score = nps.length ? Math.round(100 * (nps.filter((v) => v >= 9).length - nps.filter((v) => v <= 6).length) / nps.length) : null;
  const prefer = nums('prefer_ai');
  const trust = nums('ai_trust');
  statGrid(stats, [
    [fb.length, 'surveys'],
    [prefer.length ? pct(mean(prefer)) : '–', 'prefer the AI-assisted catalog'],
    [trust.length ? f2(mean(trust)) : '–', 'mean AI trust (1–10)'],
    [score === null ? '–' : (score > 0 ? `+${score}` : score), 'NPS for the classic catalog'],
  ]);

  const check = (key, arm, label) => [1, 0].map((v) => {
    const g = fb.filter((f) => f[arm] === v);
    const n = (a) => g.filter((f) => f[key] === a).length;
    return [`${label} · ${v ? 'shown' : 'not shown'}`, g.length, n('yes'), n('no'), n('unsure')];
  });
  table(s, ['Did you see the message?', 'People', 'Yes', 'No', 'Unsure'], [...check('mc_snow', 'snow_primed', 'ServiceNow praise banner'), ...check('mc_ai', 'ai_primed', 'AI warning')]);

  const levels = new Map();
  clean.rows.forEach((r) => levels.set(r.participant_id, r.job_level));
  const counts = JOB_LEVELS.map((l) => [l, [...levels.values()].filter((v) => v === l).length]);
  const shown = counts.filter(([, n]) => n >= MIN_CELL);
  // Small groups are merged with "not stated" so they can't be worked out by subtraction.
  const rest = levels.size - d3.sum(shown, ([, n]) => n);
  table(s, ['Job level', 'People'], [...shown, ...(rest ? [['Smaller groups and not stated', rest < MIN_CELL ? `under ${MIN_CELL}` : rest]] : [])]);
}

// ---------------------------------------------------------------------------
// Every ticket
// ---------------------------------------------------------------------------
function browse(root, { raw, clean }) {
  const s = scene(root, {
    title: 'Every ticket',
    story: 'The row-level data, for your own checks. Person numbers are for this page only and aren’t the participants’ codes. Typed descriptions and demographics aren’t included.',
  });
  const codes = new Map();
  raw.forEach((r) => { if (!codes.has(r.participant_id)) codes.set(r.participant_id, `P${String(codes.size + 1).padStart(2, '0')}`); });
  const COLS = ['Person', 'Ticket', 'Platform', 'Order', 'Seconds', 'Errors', 'Abandoned', 'Frustration', 'Efficiency', 'Praise banner', 'AI team', 'Excluded because'];
  const all = raw.filter((r) => TESTS[r.test_num]).map((r) => ({
    excluded: clean.reasons.has(r.participant_id) || !clean.rows.some((k) => k.participant_id === r.participant_id),
    platform: TESTS[r.test_num].workflow,
    cells: [codes.get(r.participant_id), TESTS[r.test_num].name, LABEL[TESTS[r.test_num].workflow], Number(r.position) || '', Number(r.completion_time), Number(r.error_count),
      yesNo(r.rage_quit), Number(r.frustration), Number(r.efficiency), yesNo(r.snow_primed), yesNo(r.ai_primed), clean.reasons.get(r.participant_id) || ''],
  })).sort((a, b) => a.cells[0].localeCompare(b.cells[0]) || a.cells[3] - b.cells[3]);

  const bar = s.appendChild(el('div', { class: 'controls' }, `
    <label>People <select id="d-who"><option value="all">Everyone</option><option value="kept">Analysed only</option><option value="out">Excluded only</option></select></label>
    <label>Platform <select id="d-plat"><option value="all">Both</option><option value="${LEGACY}">${LABEL[LEGACY]}</option><option value="${AI}">${LABEL[AI]}</option></select></label>
    <button class="btn ghost" id="d-csv" type="button">Download these rows (CSV)</button>
    <span class="data-note" id="d-count" aria-live="polite"></span>`));
  const holder = s.appendChild(el('div'));
  const visible = () => {
    const who = bar.querySelector('#d-who').value, plat = bar.querySelector('#d-plat').value;
    return all.filter((r) => (who === 'all' || (who === 'out') === r.excluded) && (plat === 'all' || r.platform === plat));
  };
  const draw = () => {
    const rows = visible();
    holder.innerHTML = '';
    bar.querySelector('#d-count').textContent = `${rows.length} tickets`;
    table(holder, COLS, rows.map((r) => r.cells), 99).classList.add('table-tall');
  };
  bar.querySelector('#d-who').addEventListener('change', draw);
  bar.querySelector('#d-plat').addEventListener('change', draw);
  bar.querySelector('#d-csv').addEventListener('click', () => {
    const q = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
    const csv = [COLS, ...visible().map((r) => r.cells)].map((row) => row.map(q).join(',')).join('\n');
    const a = el('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `${ARCHIVE_SESSION}-tickets.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  });
  draw();
}

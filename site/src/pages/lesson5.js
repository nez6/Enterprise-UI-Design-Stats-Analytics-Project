// Page 6: How LLMs work, why they hallucinate, how to measure trust, and a statistically
// grounded playbook for putting AI into ServiceNow.

import * as d3 from 'd3';
import { AI, JOB_LEVELS, LEGACY } from '../data/design.js';
import { HALLUCINATED, chaosClassify } from '../data/classifier.js';
import { onData } from '../data/context.js';
import { mean, median, rng, softmax } from '../stats/core.js';
import { C, axes, callout, controls, el, emptyNote, f2, frame, hero, pct, scene, statGrid } from '../viz/common.js';
import { participants } from './lesson3.js';

export function renderLesson5(root) {
  hero(root, {
    kicker: 'Lesson 5 · AI',
    title: 'LLMs, Trust & the Playbook',
    lede: 'Large language models are probability distributions over the next word, the same distributions we’ve been drawing all session. Understand that, and hallucination, confidence and trust stop being mysteries. Then: how to put AI into ServiceNow and prove it works.',
    chapters: ['Probability distributions', 'Softmax & temperature', 'Calibration', 'Responsible AI', 'Implementation playbook'],
  });
  nextToken(root);
  temperature(root);
  calibration(root);
  gap(root);
  playbook(root);
  closing(root);
}

// ---------------------------------------------------------------------------
// Scene 1: next-token prediction
// ---------------------------------------------------------------------------
const TOKENS = ['charge', 'turn', 'connect', 'boot', 'sleep', 'stop', 'explode', 'sing', 'apologise'];
const LOGITS = [3.1, 2.8, 2.0, 1.7, 0.8, 0.6, -1.2, -2.6, -3.2];

function nextToken(root) {
  const s = scene(root, {
    title: 'An LLM is a next-word probability machine',
    story: 'Give a language model <b>“My laptop won’t …”</b> and it doesn’t “know” the answer. It produces a score (a <b>logit</b>) for every word it knows, turns the scores into probabilities with <b>softmax</b>, and <b>samples</b> one. Then it repeats, one word at a time. Everything you’ve learned about distributions applies. <span style="color:var(--l-muted)">(Illustrative numbers.)</span>',
    formula: String.raw`P(w_i \mid \text{context}) = \frac{e^{z_i / T}}{\sum_j e^{z_j / T}}`,
  });
  const ctl = controls(s, `<label>Temperature T <input type="range" id="t" min="0.1" max="3" step="0.05" value="1"><b id="tv"></b></label><button class="lbtn hot" id="sample">Sample 20 completions</button>`);
  const f = frame(s, { height: 330, margin: { top: 16, right: 60, bottom: 30, left: 110 } });
  const samplesEl = el('div', { class: 'callout' }, 'Press <b>Sample</b> to let the model write.'); s.appendChild(samplesEl);
  const y = d3.scaleBand().domain(TOKENS).range([0, f.h]).padding(0.2), x = d3.scaleLinear().domain([0, 1]).range([0, f.w]);
  f.g.selectAll('.tl').data(TOKENS).join('text').attr('class', 'lbl').attr('x', -10).attr('y', (t) => y(t) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text((t) => `“${t}”`);
  const bars = f.g.selectAll('.b').data(TOKENS).join('rect').attr('x', 0).attr('y', (t) => y(t)).attr('height', y.bandwidth()).attr('rx', 3);
  const vals = f.g.selectAll('.v').data(TOKENS).join('text').attr('class', 'lbl').attr('dy', '0.35em').attr('y', (t) => y(t) + y.bandwidth() / 2);
  let probs = [];
  const update = () => {
    const T = +ctl.querySelector('#t').value; ctl.querySelector('#tv').textContent = T.toFixed(2);
    probs = softmax(LOGITS, T);
    bars.data(probs).transition().duration(250).attr('width', (p) => x(p)).attr('fill', (_, i) => (i >= 6 ? C.red : C.blue));
    vals.data(probs).transition().duration(250).attr('x', (p) => x(p) + 6).text((p) => pct(p));
  };
  const r = rng(21);
  ctl.querySelector('#t').addEventListener('input', update);
  ctl.querySelector('#sample').addEventListener('click', () => {
    const words = Array.from({ length: 20 }, () => { let u = r.random(); for (let i = 0; i < probs.length; i++) { u -= probs[i]; if (u <= 0) return i; } return probs.length - 1; });
    samplesEl.innerHTML = words.map((i) => `<span style="display:inline-block;margin:2px 8px 2px 0;color:${i >= 6 ? 'var(--red)' : 'var(--l-ink)'}">My laptop won’t <b>${TOKENS[i]}</b>${i >= 6 ? ' ⚠️' : ''}</span>`).join('');
  });
  update();
  callout(s, 'Low temperature: the model nearly always picks the top word, which is safe but repetitive. High temperature: it flattens the distribution and gives absurd words a real chance. A <b>hallucination</b> is often just a low-probability sample, delivered in the same confident tone as a likely one.', 'ai');
}

// ---------------------------------------------------------------------------
// Scene 2: Nova 2.0, the chaos agent, as a temperature demo
// ---------------------------------------------------------------------------
function temperature(root) {
  const s = scene(root, {
    title: 'Meet Nova 2.0: the same agent, turned up too hot',
    story: 'This is the AI agent from the portal with one change: it <b>samples</b> its answer at a temperature instead of always taking the most likely category, and its vocabulary includes some invented categories. Turn up the heat and ask it to route a ticket 200 times.',
  });
  const ctl = controls(s, `
    <label style="flex:1">Ticket <input type="text" id="txt" style="min-width:260px;flex:1" value="vpn keeps dropping when i work from home"></label>
    <label>Temperature <input type="range" id="temp" min="0.2" max="5" step="0.1" value="3"><b id="tempv"></b></label>
    <button class="lbtn hot" id="ask">Ask Nova 200×</button>`);
  const box = s.appendChild(el('div', { class: 'viz' }));
  const out = el('div'); s.appendChild(out);
  const r = rng(13);
  const run = () => {
    const T = +ctl.querySelector('#temp').value; ctl.querySelector('#tempv').textContent = T.toFixed(1);
    const text = ctl.querySelector('#txt').value;
    const counts = d3.rollup(Array.from({ length: 200 }, () => chaosClassify(text, r.random, T).category), (v) => v.length, (c) => c);
    const dataArr = [...counts].sort((a, b) => b[1] - a[1]);
    box.innerHTML = '';
    const f = frame(box, { height: 40 + dataArr.length * 34, margin: { top: 10, right: 60, bottom: 20, left: 270 } });
    const y = d3.scaleBand().domain(dataArr.map((d) => d[0])).range([0, f.h]).padding(0.2), x = d3.scaleLinear().domain([0, 200]).range([0, f.w]);
    f.g.selectAll('.l').data(dataArr).join('text').attr('class', 'lbl').attr('x', -10).attr('y', (d) => y(d[0]) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end')
      .attr('fill', (d) => (HALLUCINATED.includes(d[0]) ? C.red : C.ink)).text((d) => d[0]);
    f.g.selectAll('rect').data(dataArr).join('rect').attr('x', 0).attr('y', (d) => y(d[0])).attr('height', y.bandwidth()).attr('rx', 3)
      .attr('fill', (d) => (HALLUCINATED.includes(d[0]) ? C.red : C.teal)).attr('width', 0).transition().duration(500).attr('width', (d) => x(d[1]));
    f.g.selectAll('.n').data(dataArr).join('text').attr('class', 'lbl').attr('dy', '0.35em').attr('y', (d) => y(d[0]) + y.bandwidth() / 2).attr('x', (d) => x(d[1]) + 6).text((d) => d[1]);
    const hall = d3.sum(dataArr.filter((d) => HALLUCINATED.includes(d[0])), (d) => d[1]) / 200;
    statGrid(out, [[pct(dataArr[0][1] / 200), `most common answer: ${dataArr[0][0]}`, C.teal], [pct(hall), 'invented categories', C.red], [dataArr.length, 'different answers to one question']]);
  };
  ctl.querySelector('#ask').addEventListener('click', run);
  ctl.querySelector('#temp').addEventListener('input', run);
  run();
  callout(s, 'Production AI agents should run <b>cold</b> for decisions (routing, classification) and only warmer for creative text. Asking the same question several times and checking whether the answers agree is a cheap, effective hallucination detector.', 'ai');
}

// ---------------------------------------------------------------------------
// Scene 3: calibration
// ---------------------------------------------------------------------------
function calibration(root) {
  const s = scene(root, {
    title: 'Calibration: does “90% confident” mean 90% right?',
    story: 'The AI agent showed you a confidence number on every ticket. Group the tickets by that number and check how often it was actually right. A <b>calibrated</b> model sits on the diagonal. Below the line means <b>overconfident</b>, the dangerous kind.',
    formula: String.raw`\text{ECE} = \sum_{b} \frac{n_b}{N}\,\big|\,\text{accuracy}_b - \text{confidence}_b\,\big|`,
  });
  const box = s.appendChild(el('div', { class: 'viz' }));
  const out = el('div'); s.appendChild(out);
  onData(({ rows }) => {
    box.innerHTML = '';
    const d = rows.filter((r) => r.workflow === AI && Number.isFinite(r.ai_confidence) && r.ai_category && r.chosen_category);
    if (d.length < 10) return emptyNote(box, 'Need AI-agent tickets with confidence scores.');
    const edges = [0, 0.4, 0.55, 0.7, 0.85, 1.01];
    const bins = edges.slice(0, -1).map((lo, i) => {
      const b = d.filter((r) => r.ai_confidence >= lo && r.ai_confidence < edges[i + 1]);
      return { lo, hi: Math.min(1, edges[i + 1]), n: b.length, conf: b.length ? mean(b.map((r) => r.ai_confidence)) : null, acc: b.length ? mean(b.map((r) => (r.ai_category === r.chosen_category ? 1 : 0))) : null };
    }).filter((b) => b.n > 0);
    const f = frame(box, { height: 380, margin: { top: 20, right: 30, bottom: 46, left: 60 } });
    const x = d3.scaleLinear().domain([0, 1]).range([0, f.w]), y = d3.scaleLinear().domain([0, 1]).range([f.h, 0]);
    axes(f, x, y, { xLabel: 'stated confidence', yLabel: 'actual accuracy', xFormat: d3.format('.0%'), yFormat: d3.format('.0%') });
    f.g.append('line').attr('x1', x(0)).attr('y1', y(0)).attr('x2', x(1)).attr('y2', y(1)).attr('stroke', C.ink2).attr('stroke-dasharray', '6 5');
    f.g.append('text').attr('class', 'lbl muted').attr('x', x(0.62)).attr('y', y(0.68)).attr('transform', `rotate(-${Math.atan(f.h / f.w) * 57.3},${x(0.62)},${y(0.68)})`).text('perfectly calibrated');
    const rMax = d3.max(bins, (b) => b.n);
    f.g.selectAll('line.gap').data(bins).join('line').attr('x1', (b) => x(b.conf)).attr('x2', (b) => x(b.conf)).attr('y1', (b) => y(b.conf)).attr('y2', (b) => y(b.acc)).attr('stroke', C.red).attr('stroke-width', 2);
    f.g.selectAll('circle').data(bins).join('circle').attr('cx', (b) => x(b.conf)).attr('cy', (b) => y(b.acc)).attr('r', (b) => 5 + 12 * Math.sqrt(b.n / rMax))
      .attr('fill', C.yellow).attr('fill-opacity', 0.8).attr('stroke', C.surface).attr('stroke-width', 2);
    const ece = d3.sum(bins, (b) => (b.n / d.length) * Math.abs(b.acc - b.conf));
    statGrid(out, [[pct(mean(d.map((r) => r.ai_confidence))), 'average confidence', C.yellow], [pct(mean(d.map((r) => (r.ai_category === r.chosen_category ? 1 : 0)))), 'average accuracy', C.teal], [pct(ece), 'calibration error (ECE)', C.red]]);
  });
  const note = callout(s, '');
  onData(({ rows }) => {
    const d = rows.filter((r) => r.workflow === AI && Number.isFinite(r.ai_confidence) && r.ai_category && r.chosen_category);
    if (d.length < 10) { note.innerHTML = '<span class="tag">Where AI comes in</span>Never show users a confidence score you haven’t checked against reality.'; return; }
    const gapPts = mean(d.map((r) => (r.ai_category === r.chosen_category ? 1 : 0))) - mean(d.map((r) => r.ai_confidence));
    const verdict = gapPts > 0.03 ? 'Here the agent is <i>under</i>-confident: it’s right more often than its number says (naive Bayes probabilities are rough). Large language models are often the reverse.'
      : gapPts < -0.03 ? 'Here the agent is <i>over</i>-confident: it sounds surer than it is. That’s the pattern that makes hallucinations convincing.'
      : 'Here the agent is roughly calibrated, which is rarer than you’d hope.';
    note.innerHTML = `<span class="tag">Where AI comes in</span>${verdict} Either way, <b>never show users a confidence score you haven’t checked against reality</b>.`;
  });
}

// ---------------------------------------------------------------------------
// Scene 4: the perception-performance gap (the experiment's headline)
// ---------------------------------------------------------------------------
function gap(root) {
  const s = scene(root, {
    title: 'The perception–performance gap',
    story: 'Here’s the whole experiment on one chart. Left to right is <b>performance</b> (typical seconds per ticket, so faster is further left). Bottom to top is <b>perception</b> (mean efficiency rating). Each arrow shows what a banner did to the same system. If perception followed performance, the AI would sit in the top-left, and banners wouldn’t move anything.',
  });
  const box = s.appendChild(el('div', { class: 'viz' }));
  const out = el('div'); s.appendChild(out);
  onData(({ rows, feedback }) => {
    box.innerHTML = '';
    const cell = (w, p) => { const d = rows.filter((r) => r.workflow === w && Boolean(r.primed) === p); return d.length ? { w, p, t: median(d.map((r) => r.completion_time)), e: mean(d.map((r) => r.efficiency)), n: d.length } : null; };
    const pts = [LEGACY, AI].flatMap((w) => [cell(w, false), cell(w, true)]);
    if (pts.some((p) => !p)) return emptyNote(box, 'Need tickets from every platform × banner combination.');
    const f = frame(box, { height: 400, margin: { top: 24, right: 40, bottom: 50, left: 60 } });
    const x = d3.scaleLog().domain([d3.min(pts, (p) => p.t) * 0.7, d3.max(pts, (p) => p.t) * 1.4]).range([0, f.w]);
    const y = d3.scaleLinear().domain([1, 10]).range([f.h, 0]);
    axes(f, x, y, { xLabel: 'median seconds per ticket (log scale, faster ←)', yLabel: 'mean efficiency rating', xFormat: d3.format('~s') });
    const svg = f.svg;
    svg.append('defs').append('marker').attr('id', 'arrow').attr('viewBox', '0 0 10 10').attr('refX', 9).attr('refY', 5).attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
      .append('path').attr('d', 'M0,0 L10,5 L0,10 z').attr('fill', C.yellow);
    [LEGACY, AI].forEach((w) => {
      const a = pts.find((p) => p.w === w && !p.p), b = pts.find((p) => p.w === w && p.p), color = w === AI ? C.teal : C.blue;
      f.g.append('line').attr('x1', x(a.t)).attr('y1', y(a.e)).attr('x2', x(a.t)).attr('y2', y(a.e)).attr('stroke', C.yellow).attr('stroke-width', 3).attr('marker-end', 'url(#arrow)')
        .transition().duration(1000).attr('x2', x(b.t)).attr('y2', y(b.e));
      [[a, 'no banner'], [b, w === AI ? 'saw warning' : 'saw praise']].forEach(([p, lab]) => {
        f.g.append('circle').attr('cx', x(p.t)).attr('cy', y(p.e)).attr('r', 9).attr('fill', color).attr('stroke', C.surface).attr('stroke-width', 2);
        f.g.append('text').attr('class', 'lbl').attr('x', x(p.t) + 14).attr('y', y(p.e)).attr('dy', '0.35em').text(`${w}: ${lab}`);
      });
    });
    const fb = feedback.filter((q) => q.prefer_ai === 0 || q.prefer_ai === 1);
    const pref = (g) => { const d = fb.filter((q) => Boolean(q.ai_primed) === g); return d.length ? mean(d.map((q) => q.prefer_ai)) : NaN; };
    const nps = (g) => { const d = feedback.filter((q) => Number.isFinite(q.nps_servicenow) && Boolean(q.snow_primed) === g).map((q) => q.nps_servicenow); return d.length ? Math.round(100 * (d.filter((v) => v >= 9).length - d.filter((v) => v <= 6).length) / d.length) : NaN; };
    const sn = pts.filter((p) => p.w === LEGACY), ai = pts.filter((p) => p.w === AI);
    statGrid(out, [
      [`${(d3.mean(sn, (p) => p.t) / d3.mean(ai, (p) => p.t)).toFixed(1)}×`, 'AI agent speed advantage', C.teal],
      [`${(sn[1].e - sn[0].e) >= 0 ? '+' : ''}${f2(sn[1].e - sn[0].e)}`, 'praise banner → ServiceNow rating', C.blue],
      [`${(ai[1].e - ai[0].e) >= 0 ? '+' : ''}${f2(ai[1].e - ai[0].e)}`, 'warning banner → AI rating', C.red],
      [Number.isFinite(pref(false)) ? `${pct(pref(false))} vs ${pct(pref(true))}` : '–', 'choose AI next time: unwarned vs warned'],
      [Number.isFinite(nps(false)) ? `${nps(false)} vs ${nps(true)}` : '–', 'ServiceNow NPS: no praise vs praise'],
    ]);
  });
  callout(s, 'The lesson for an AI rollout: <b>the narrative people hear before they use it changes what they report afterwards</b>, sometimes by more than the product changes. Measure behaviour (time, completion, overrides), run the messaging as an experiment, and never let a satisfaction survey be your only scorecard.', 'ai');
}

// ---------------------------------------------------------------------------
// Scene 5: the implementation playbook
// ---------------------------------------------------------------------------
function playbook(root) {
  const s = scene(root, {
    title: 'The playbook: putting AI into ServiceNow, and proving it works',
    story: 'Every stage below uses a tool from this session. Together they turn “we bought an AI feature” into “we can show what it did, for whom, and how sure we are.”',
  });
  s.appendChild(el('div', { class: 'roadmap' }, [
    ['1 · Baseline', 'Measure today’s median and tail resolution time, abandonment and CSAT per ticket type before anything changes.', 'Lesson 1: medians, IQR, skew'],
    ['2 · Pilot as an experiment', 'Randomise who gets the AI agent and what they’re told about it. Size the pilot with a power analysis first.', 'Lesson 3: power, randomisation'],
    ['3 · Grade the model', 'Confusion matrix by category, precision at your base rates, calibration of its confidence, and override rates.', 'Lessons 2 & 4: Bayes, metrics'],
    ['4 · Roll out with guardrails', 'Run decisions at low temperature, keep a one-click human fallback, and let agents correct the AI so it learns.', 'Lesson 5: temperature, trust'],
    ['5 · Monitor & audit', 'Track drift, accuracy and override rates by group with confidence intervals and chi-square audits. Report the posterior, not the press release.', 'Lessons 2–4: χ², CIs, Bayes'],
  ].map(([h, p, t]) => `<div class="stage"><h4>${h}</h4><p>${p}</p><span class="tool">${t}</span></div>`).join('')));
  const out = el('div'); s.appendChild(out);
  onData(({ rows, feedback }) => {
    const pp = participants(rows).filter((p) => p.sn_time && p.ai_time);
    const aiRows = rows.filter((r) => r.workflow === AI && (r.ai_correct === 0 || r.ai_correct === 1));
    statGrid(out, [
      [pp.length ? `${(1 / Math.exp(mean(pp.map((p) => Math.log(p.ai_time / p.sn_time))))).toFixed(1)}×` : '–', 'faster tickets with AI', C.teal],
      [aiRows.length ? pct(mean(aiRows.map((r) => r.ai_correct))) : '–', 'AI category kept by users', C.yellow],
      [feedback.length ? pct(mean(feedback.filter((q) => q.prefer_ai !== null).map((q) => q.prefer_ai))) : '–', 'would choose AI next time', C.blue],
      [feedback.length ? f2(mean(feedback.filter((q) => Number.isFinite(q.ai_trust)).map((q) => q.ai_trust))) : '–', 'trust in AI agent (1–10)'],
    ]);
  });
}

// ---------------------------------------------------------------------------
// Scene 6: closing
// ---------------------------------------------------------------------------
function closing(root) {
  const s = scene(root, {
    title: 'What an AI leader does differently',
    story: 'Anyone can buy an AI feature. The job is making it <b>measurably</b> better for people, and being honest when it isn’t.',
  });
  s.appendChild(el('div', { class: 'stat-grid' }, [
    ['Start from a baseline', 'If you can’t say what “before” looked like, you can’t claim an “after”.'],
    ['Run rollouts as experiments', 'Randomise, power it, and pre-register what success means.'],
    ['Report uncertainty', 'Confidence intervals and posteriors, not single numbers.'],
    ['Design for trust', 'Calibrated confidence, easy overrides, and honest messaging, because framing moves ratings.'],
    ['Audit for everyone', 'Check accuracy and adoption by group. Simpson’s paradox hides in averages.'],
  ].map(([k, v]) => `<div class="stat"><div class="v" style="font-size:20px">${k}</div><div style="color:var(--l-ink2);font-size:14px;margin-top:6px">${v}</div></div>`).join('')));
  callout(s, '<b>Natalie Zachariah</b> · Built this lab to show how statistics turns AI from a bet into a measurable programme.');
}

export { JOB_LEVELS };

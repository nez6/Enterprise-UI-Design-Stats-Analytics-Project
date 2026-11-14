// Page 3: Bayes' theorem, from geometry to the Virtual Agent's brain to trust in AI.

import * as d3 from 'd3';
import { CATEGORIES } from '../data/design.js';
import { classify, tokenize } from '../data/classifier.js';
import { onData } from '../data/context.js';
import { betaInv, betaPdf } from '../stats/core.js';
import { C, callout, controls, el, emptyNote, frame, hero, pct, scene, statGrid, tex } from '../viz/common.js';

export function renderLesson2(root) {
  hero(root, {
    kicker: 'Lesson 2 · Probability & Bayes',
    title: 'Bayes’ Theorem: How the Virtual Agent Thinks',
    lede: 'Every AI that routes a ticket is quietly asking one question: given these words, which team is most likely? Bayes’ theorem is how you answer it, and how you decide whether to trust the answer.',
    chapters: ['Conditional probability', 'Bayes’ theorem', 'Base rates', 'Naive Bayes classifier', 'Ch 11 · Bayesian updating'],
  });
  geometry(root);
  baseRates(root);
  agentBrain(root);
  trust(root);
}

// ---------------------------------------------------------------------------
// Scene 1: Bayes as area
// ---------------------------------------------------------------------------
function geometry(root) {
  const s = scene(root, {
    title: 'Bayes’ theorem is just area',
    story: 'The agent sees the word <b>“down”</b>. Is it an outage? Draw every possible ticket as a square. Split it by how common outages are (the <b style="color:var(--blue)">prior</b>), then shade the tickets that say “down” (the <b style="color:var(--yellow)">likelihood</b>). Now <b>only look at the shaded area</b>. The outage share of that area is the answer.',
    formula: String.raw`P(\text{outage}\mid\text{"down"}) = \frac{P(\text{"down"}\mid\text{outage})\,P(\text{outage})}{P(\text{"down"}\mid\text{outage})P(\text{outage}) + P(\text{"down"}\mid\text{other})P(\text{other})}`,
  });
  const ctl = controls(s, `
    <label>P(outage) <input type="range" id="pr" min="0.02" max="0.6" step="0.01" value="0.17"><b id="prv"></b></label>
    <label>P(“down” | outage) <input type="range" id="l1" min="0.05" max="1" step="0.01" value="0.6"><b id="l1v"></b></label>
    <label>P(“down” | other) <input type="range" id="l0" min="0.01" max="0.6" step="0.01" value="0.05"><b id="l0v"></b></label>`);
  const row = s.appendChild(el('div', { class: 'viz-row' }));
  const f = frame(row.appendChild(el('div', { class: 'viz' })), { width: 560, height: 420, margin: { top: 30, right: 20, bottom: 30, left: 20 } });
  const side = row.appendChild(el('div', { class: 'viz' }));
  const S = Math.min(f.w, f.h);
  const g = f.g.append('g').attr('transform', `translate(${(f.w - S) / 2},0)`);
  const colA = g.append('rect').attr('fill', C.blue).attr('fill-opacity', 0.18).attr('stroke', C.blue);
  const colB = g.append('rect').attr('fill', C.muted).attr('fill-opacity', 0.12).attr('stroke', C.muted);
  const hiA = g.append('rect').attr('fill', C.yellow).attr('fill-opacity', 0.85);
  const hiB = g.append('rect').attr('fill', C.yellow).attr('fill-opacity', 0.45);
  const lA = g.append('text').attr('class', 'lbl').attr('y', -10).attr('fill', C.blue);
  const lB = g.append('text').attr('class', 'lbl muted').attr('y', -10);
  const update = () => {
    const pr = +ctl.querySelector('#pr').value, l1 = +ctl.querySelector('#l1').value, l0 = +ctl.querySelector('#l0').value;
    ctl.querySelector('#prv').textContent = pct(pr); ctl.querySelector('#l1v').textContent = pct(l1); ctl.querySelector('#l0v').textContent = pct(l0);
    const wA = S * pr, t = 400;
    colA.transition().duration(t).attr('x', 0).attr('y', 0).attr('width', wA).attr('height', S);
    colB.transition().duration(t).attr('x', wA).attr('y', 0).attr('width', S - wA).attr('height', S);
    hiA.transition().duration(t).attr('x', 0).attr('y', S * (1 - l1)).attr('width', wA).attr('height', S * l1);
    hiB.transition().duration(t).attr('x', wA).attr('y', S * (1 - l0)).attr('width', S - wA).attr('height', S * l0);
    lA.attr('x', 4).text('outages'); lB.attr('x', wA + 6).text('everything else');
    const num = pr * l1, den = num + (1 - pr) * l0, post = num / den;
    side.innerHTML = `
      <p class="kicker" style="color:var(--yellow)">Posterior</p>
      <div style="font-family:var(--serif);font-size:56px;font-weight:600;color:var(--yellow);line-height:1">${pct(post)}</div>
      <p style="color:var(--l-ink2)">of tickets that say “down” are outages.</p>
      <div class="formula" style="font-size:16px">${tex(String.raw`\frac{${l1.toFixed(2)}\times${pr.toFixed(2)}}{${l1.toFixed(2)}\times${pr.toFixed(2)} + ${l0.toFixed(2)}\times${(1 - pr).toFixed(2)}} = ${post.toFixed(2)}`, true)}</div>
      <p style="color:var(--l-ink2);font-size:14px">Bright yellow = outages that say “down”. Faded yellow = other tickets that say “down”. The posterior is bright ÷ (bright + faded).</p>`;
  };
  ctl.querySelectorAll('input').forEach((i) => i.addEventListener('input', update));
  update();
}

// ---------------------------------------------------------------------------
// Scene 2: base-rate fallacy (responsible AI)
// ---------------------------------------------------------------------------
function baseRates(root) {
  const s = scene(root, {
    title: 'The alarm that cries wolf',
    story: 'An AI model flags <b>“critical outage”</b>. It catches 95% of real outages and wrongly flags only 10% of normal tickets. Sounds great. But if real outages are rare, most of its alarms are false. Here are <b>1,000 tickets</b>.',
  });
  const ctl = controls(s, `<label>Real outage rate <input type="range" id="br" min="0.005" max="0.3" step="0.005" value="0.02"><b id="brv"></b></label>
    <label>Sensitivity <input type="range" id="se" min="0.5" max="1" step="0.01" value="0.95"><b id="sev"></b></label>
    <label>False-alarm rate <input type="range" id="fa" min="0.01" max="0.3" step="0.01" value="0.1"><b id="fav"></b></label>`);
  const f = frame(s, { width: 900, height: 330, margin: { top: 10, right: 10, bottom: 10, left: 10 } });
  const cols = 50, size = f.w / cols;
  const cells = f.g.selectAll('rect').data(d3.range(1000)).join('rect')
    .attr('x', (i) => (i % cols) * size + 1).attr('y', (i) => Math.floor(i / cols) * size * 0.78 + 1)
    .attr('width', size - 3).attr('height', size * 0.78 - 3).attr('rx', 2);
  const out = el('div'); s.appendChild(out);
  s.appendChild(el('div', { class: 'legend' }, `<span><i style="background:${C.red}"></i>Real outage, flagged</span><span><i style="background:${C.purple}"></i>Real outage, missed</span><span><i style="background:${C.yellow}"></i>False alarm</span><span><i style="background:#2f343c"></i>Normal, not flagged</span>`));
  const update = () => {
    const br = +ctl.querySelector('#br').value, se = +ctl.querySelector('#se').value, fa = +ctl.querySelector('#fa').value;
    ctl.querySelector('#brv').textContent = `${(br * 100).toFixed(1)}%`; ctl.querySelector('#sev').textContent = pct(se); ctl.querySelector('#fav').textContent = pct(fa);
    const pos = Math.round(1000 * br), tp = Math.round(pos * se), fp = Math.round((1000 - pos) * fa);
    cells.transition().duration(300).attr('fill', (i) => (i < tp ? C.red : i < pos ? C.purple : i < pos + fp ? C.yellow : '#2f343c'));
    statGrid(out, [[tp + fp, 'alarms raised'], [tp, 'real outages caught', C.red], [fp, 'false alarms', C.yellow], [pct(tp / Math.max(1, tp + fp)), 'P(real | alarm)']]);
  };
  ctl.querySelectorAll('input').forEach((i) => i.addEventListener('input', update));
  update();
  callout(s, 'Before deploying any AI classifier in ServiceNow, ask for <b>precision at your base rate</b>, not just “accuracy”. A 95%-sensitive outage detector that pages the on-call engineer for every alert would mostly wake people up for nothing, and they’d learn to ignore it.', 'ai');
}

// ---------------------------------------------------------------------------
// Scene 3: inside the Virtual Agent (naive Bayes)
// ---------------------------------------------------------------------------
function agentBrain(root) {
  const s = scene(root, {
    title: 'Inside the Virtual Agent',
    story: 'The AI agent that filled in your tickets is a <b>naive Bayes classifier</b>. It starts with a prior for each team, multiplies in how typical each word is for that team, and normalises. “Naive” because it pretends words are independent. Type a ticket and watch each word push the probabilities around.',
    formula: String.raw`P(c\mid w_1,\dots,w_k) \;\propto\; P(c)\prod_{j=1}^{k} P(w_j\mid c)`,
  });
  const ctl = controls(s, `<label style="flex:1">Ticket text <input type="text" id="txt" style="flex:1;min-width:280px" value="my vpn keeps dropping, cant reach the network drive"></label>`);
  const row = s.appendChild(el('div', { class: 'viz-row' }));
  const barsBox = row.appendChild(el('div', { class: 'viz' })), heatBox = row.appendChild(el('div', { class: 'viz' }));
  const fb = frame(barsBox, { width: 560, height: 300, margin: { top: 10, right: 60, bottom: 30, left: 150 } });
  const y = d3.scaleBand().domain(CATEGORIES).range([0, fb.h]).padding(0.25), x = d3.scaleLinear().domain([0, 1]).range([0, fb.w]);
  fb.g.selectAll('.cl').data(CATEGORIES).join('text').attr('class', 'lbl muted').attr('x', -10).attr('y', (c) => y(c) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text((c) => c);
  const bars = fb.g.selectAll('.b').data(CATEGORIES).join('rect').attr('x', 0).attr('y', (c) => y(c)).attr('height', y.bandwidth()).attr('rx', 3);
  const vals = fb.g.selectAll('.v').data(CATEGORIES).join('text').attr('class', 'lbl').attr('dy', '0.35em').attr('y', (c) => y(c) + y.bandwidth() / 2);
  const update = () => {
    const text = ctl.querySelector('#txt').value, r = classify(text);
    const p = Object.fromEntries(r.ranked.map((d) => [d.category, d.p]));
    bars.transition().duration(350).attr('width', (c) => x(p[c])).attr('fill', (c) => (c === r.top.category ? C.yellow : C.blue));
    vals.transition().duration(350).attr('x', (c) => x(p[c]) + 6).text((c) => pct(p[c]));
    const all = tokenize(text);
    heatBox.innerHTML = `<p class="kicker" style="color:var(--teal)">What each word votes for</p>` + (r.words.length
      ? `<table class="ltable"><tr><th>word</th><th>strongest vote</th><th class="num">boost</th></tr>${r.words.map((w, j) => {
        const lls = CATEGORIES.map((c) => r.perWord[c][j]), best = lls.indexOf(Math.max(...lls)), avg = d3.mean(lls);
        return `<tr><td><b>${w.replace(/</g, '&lt;')}</b></td><td>${CATEGORIES[best]}</td><td class="num">×${Math.exp(lls[best] - avg).toFixed(1)}</td></tr>`;
      }).join('')}</table>`
      : '<p class="empty">No known words yet. Try “password”, “vpn”, “laptop” or “outage”.</p>')
      + (all.length > r.words.length ? `<p style="color:var(--l-muted);font-size:13px">Ignored (never seen in training): ${all.filter((w) => !r.words.includes(w)).map((w) => w.replace(/</g, '&lt;')).join(', ')}</p>` : '');
  };
  ctl.querySelector('#txt').addEventListener('input', update);
  update();
  callout(s, 'Modern ticket-routing AI (and large language models) use far richer features than single words, but the logic is the same: <b>prior × evidence → posterior</b>. When the training data has never seen your words, the prior dominates. That’s why an AI trained on last year’s tickets struggles with a brand-new system.', 'ai');
}

// ---------------------------------------------------------------------------
// Scene 4: trust as a posterior
// ---------------------------------------------------------------------------
function trust(root) {
  const s = scene(root, {
    title: 'Trust is a posterior, not a press release',
    story: 'The vendor says the AI agent is <b>90% accurate</b>. That’s your prior. Each ticket where you kept or corrected its category is evidence. With a Beta prior, Bayes’ theorem has a one-line answer, and you can watch your belief move as the class’s real tickets come in.',
    formula: String.raw`\theta \sim \text{Beta}(a,b) \;\xrightarrow{\;k \text{ right out of } n\;}\; \theta \mid \text{data} \sim \text{Beta}(a+k,\; b+n-k)`,
  });
  const ctl = controls(s, `
    <label>Evidence from <select id="which"><option value="all">Everyone</option><option value="warned">People who saw the AI warning</option><option value="unwarned">People who didn’t</option></select></label>
    <label>Vendor claim <input type="range" id="pm" min="0.5" max="0.99" step="0.01" value="0.9"><b id="pmv"></b></label>
    <label>Prior strength <input type="range" id="ps" min="2" max="200" value="30"><b id="psv"></b></label>
    <button class="lbtn hot" id="play">▶ Replay the evidence</button>`);
  const f = frame(s, { height: 360 });
  const out = el('div'); s.appendChild(out);
  const x = d3.scaleLinear().domain([0, 1]).range([0, f.w]);
  let y = d3.scaleLinear().range([f.h, 0]);
  f.g.append('g').attr('class', 'axis').attr('transform', `translate(0,${f.h})`).call(d3.axisBottom(x).tickFormat(d3.format('.0%')));
  f.g.append('text').attr('class', 'lbl muted').attr('x', f.w / 2).attr('y', f.h + 38).attr('text-anchor', 'middle').text('θ = the agent’s true accuracy');
  const priorP = f.g.append('path').attr('fill', 'none').attr('stroke', C.muted).attr('stroke-width', 2).attr('stroke-dasharray', '6 5');
  const postP = f.g.append('path').attr('fill', C.yellow).attr('fill-opacity', 0.15).attr('stroke', C.yellow).attr('stroke-width', 3);
  const lab = f.g.append('text').attr('class', 'lbl').attr('fill', C.yellow);
  s.appendChild(el('div', { class: 'legend' }, `<span><i style="background:${C.muted}"></i>Prior (vendor claim)</span><span><i style="background:${C.yellow}"></i>Posterior after the evidence</span>`));
  const xs = d3.range(0.001, 0.999, 0.004);
  const line = (a, b) => d3.line().x((v) => x(v)).y((v) => y(betaPdf(v, a, b)))(xs);
  let evidence = [], anim = null;

  const draw = (k, n, animate = true) => {
    const pm = +ctl.querySelector('#pm').value, ps = +ctl.querySelector('#ps').value, a0 = pm * ps, b0 = (1 - pm) * ps;
    ctl.querySelector('#pmv').textContent = pct(pm); ctl.querySelector('#psv').textContent = ps;
    const a = a0 + k, b = b0 + n - k;
    const peak = Math.max(d3.max(xs, (v) => betaPdf(v, a0, b0)), d3.max(xs, (v) => betaPdf(v, a, b)));
    y = d3.scaleLinear().domain([0, peak * 1.1]).range([f.h, 0]);
    priorP.attr('d', line(a0, b0));
    (animate ? postP.transition().duration(120) : postP).attr('d', line(a, b));
    const m = a / (a + b);
    lab.attr('x', x(m)).attr('y', y(betaPdf(m, a, b)) - 10).attr('text-anchor', 'middle').text(`${pct(m)}`);
    statGrid(out, [[`${k} / ${n}`, 'routed correctly'], [pct(pm), 'prior belief', C.muted], [pct(m), 'posterior mean', C.yellow],
      [`${pct(betaInv(0.025, a, b))}–${pct(betaInv(0.975, a, b))}`, '95% credible interval']]);
  };
  const full = () => draw(d3.sum(evidence), evidence.length, false);
  ctl.querySelectorAll('input').forEach((i) => i.addEventListener('input', full));
  ctl.querySelector('#which').addEventListener('change', () => { load(); full(); });
  ctl.querySelector('#play').addEventListener('click', () => {
    clearInterval(anim); let i = 0;
    anim = setInterval(() => { i = Math.min(evidence.length, i + Math.max(1, Math.ceil(evidence.length / 60))); draw(d3.sum(evidence.slice(0, i)), i); if (i >= evidence.length) clearInterval(anim); }, 60);
  });
  let rowsCache = [];
  const load = () => {
    const which = ctl.querySelector('#which').value;
    evidence = rowsCache.filter((r) => (r.ai_correct === 0 || r.ai_correct === 1) && (which === 'all' || (which === 'warned') === Boolean(r.ai_primed))).map((r) => Number(r.ai_correct));
  };
  onData(({ rows }) => { rowsCache = rows; load(); if (!rows.length) emptyNote(out); full(); });
  callout(s, 'A strong prior (high strength) is a vendor you trust a lot: it takes many failures to change your mind. Now compare the people who saw the hallucination warning with those who didn’t. If warned users overrule the agent more often, <b>even when it was right</b>, their “evidence” makes the agent look worse than it is. Measuring AI accuracy through users’ corrections measures their trust too.', 'ai');
}

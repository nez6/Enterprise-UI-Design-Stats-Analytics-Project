// Page 5: From regression to machine learning. OLS (Ch. 12), logistic regression (Ch. 10),
// classification metrics, overfitting, Simpson's paradox, and grading the AI agent.

import * as d3 from 'd3';
import { AI, CATEGORIES, JOB_LEVELS, LEGACY } from '../data/design.js';
import { onData } from '../data/context.js';
import { logistic, mean, ols, rng, roc } from '../stats/core.js';
import { C, SERIES, axes, callout, controls, el, emptyNote, f2, fmtP, frame, hero, pct, scene, statGrid } from '../viz/common.js';
import { participants } from './lesson3.js';

export function renderLesson4(root) {
  hero(root, {
    kicker: 'Lesson 4 · Models',
    title: 'From Regression to Machine Learning',
    lede: 'A regression line is the simplest machine-learning model there is. Fit it, add more inputs, bend it into a probability, test it on data it hasn’t seen, and you’ve covered the core of how AI is trained and judged.',
    chapters: ['Ch 10 · Regression', 'Ch 6 · Class balancing', 'Ch 12 · Model evaluation', 'Cross-validation', 'Simpson’s paradox'],
  });
  squares(root);
  multiple(root);
  logit(root);
  balancing(root);
  overfit(root);
  simpson(root);
  confusion(root);
  rocScene(root);
}

// ---------------------------------------------------------------------------
// Scene 1: least squares, drawn as squares
// ---------------------------------------------------------------------------
function squares(root) {
  const s = scene(root, {
    title: 'Least squares, literally',
    story: 'Each dot is a ServiceNow ticket: how long it took, and how frustrated the person felt. Any line makes errors (residuals). Square each one and add up the area. <b>Drag the two yellow handles</b> to make the total area as small as you can, then press <b>Snap to best fit</b> to see the line OLS finds.',
    formula: String.raw`\hat y = \beta_0 + \beta_1 x, \qquad \min_{\beta_0,\beta_1} \sum_i (y_i - \hat y_i)^2`,
  });
  const ctl = controls(s, `<button class="lbtn hot" id="snap">Snap to best fit</button><button class="lbtn" id="resetL">Reset line</button>`);
  const f = frame(s, { height: 420, margin: { top: 20, right: 30, bottom: 46, left: 56 } });
  const out = el('div'); s.appendChild(out);
  let pts = [], fit = null, line = { a: 5, b: 0 };
  const x = d3.scaleLinear().range([0, f.w]), y = d3.scaleLinear().domain([0, 11]).range([f.h, 0]);
  const gAx = f.g.append('g'), gSq = f.g.append('g'), gPts = f.g.append('g'), gLine = f.g.append('g');
  const handles = [0.15, 0.85];

  function draw(animate = false) {
    const xd = x.domain(), yAt = (xv) => line.a + line.b * xv;
    const sq = gSq.selectAll('rect').data(pts).join('rect').attr('fill', C.red).attr('fill-opacity', 0.16).attr('stroke', C.red).attr('stroke-opacity', 0.5);
    (animate ? sq.transition().duration(800) : sq)
      .attr('x', (p) => x(p.x)).attr('y', (p) => y(Math.max(p.y, yAt(p.x))))
      .attr('width', (p) => Math.abs(y(p.y) - y(yAt(p.x)))).attr('height', (p) => Math.abs(y(p.y) - y(yAt(p.x))));
    const l = gLine.selectAll('line').data([0]).join('line').attr('stroke', C.yellow).attr('stroke-width', 3);
    (animate ? l.transition().duration(800) : l).attr('x1', x(xd[0])).attr('x2', x(xd[1])).attr('y1', y(yAt(xd[0]))).attr('y2', y(yAt(xd[1])));
    const hx = handles.map((h) => xd[0] + h * (xd[1] - xd[0]));
    const hs = gLine.selectAll('circle').data(hx).join('circle').attr('r', 9).attr('fill', C.yellow).attr('stroke', C.surface).attr('stroke-width', 2).style('cursor', 'ns-resize');
    (animate ? hs.transition().duration(800) : hs).attr('cx', (v) => x(v)).attr('cy', (v) => y(yAt(v)));
    hs.call(d3.drag().on('drag', (ev, v) => {
      const i = hx.indexOf(v), yNew = y.invert(ev.y), other = hx[1 - i], yOther = yAt(other);
      line.b = (yNew - yOther) / (v - other); line.a = yNew - line.b * v; draw();
    }));
    const sse = d3.sum(pts, (p) => (p.y - yAt(p.x)) ** 2);
    statGrid(out, [[sse.toFixed(0), 'your total squared error', C.red], [fit ? fit.sse.toFixed(0) : '–', 'smallest possible (OLS)', C.yellow],
      [f2(line.b * 60), 'slope: frustration per extra minute'], [fit ? f2(fit.r2) : '–', 'R² of the best line']]);
  }

  ctl.querySelector('#snap').addEventListener('click', () => { if (fit) { line = { a: fit.beta[0], b: fit.beta[1] }; draw(true); } });
  ctl.querySelector('#resetL').addEventListener('click', () => { line = { a: d3.mean(pts, (p) => p.y) || 5, b: 0 }; draw(true); });

  onData(({ rows }) => {
    const r = rng(3), d = rows.filter((q) => q.workflow === LEGACY && q.completion_time < 600);
    pts = r.shuffle(d).slice(0, 70).map((q) => ({ x: q.completion_time, y: q.frustration + (r.random() - 0.5) * 0.4 }));
    gAx.selectAll('*').remove();
    if (pts.length < 5) { fit = null; return emptyNote(f.box); }
    x.domain([0, d3.max(pts, (p) => p.x) * 1.05]);
    gAx.append('g').attr('class', 'axis').attr('transform', `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(6).tickFormat((v) => `${v}s`));
    gAx.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5));
    gAx.append('text').attr('class', 'lbl muted').attr('x', f.w / 2).attr('y', f.h + 38).attr('text-anchor', 'middle').text('completion time');
    gAx.append('text').attr('class', 'lbl muted').attr('transform', 'rotate(-90)').attr('x', -f.h / 2).attr('y', -40).attr('text-anchor', 'middle').text('frustration (jittered)');
    gPts.selectAll('circle').data(pts).join('circle').attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y)).attr('r', 4.5).attr('fill', C.blue).attr('stroke', C.surface).attr('stroke-width', 1.5);
    fit = ols(pts.map((p) => [p.x]), pts.map((p) => p.y));
    line = { a: d3.mean(pts, (p) => p.y), b: 0 };
    draw();
  });
}

// ---------------------------------------------------------------------------
// Scene 2: multiple regression
// ---------------------------------------------------------------------------
function multiple(root) {
  const s = scene(root, {
    title: 'More inputs: what actually drives frustration?',
    story: 'Real outcomes have many causes. Multiple regression estimates each one <b>holding the others fixed</b>. Each dot is a coefficient: how many frustration points that factor adds. The bar is its 95% confidence interval. If the bar crosses zero, we can’t rule out “no effect”.',
    formula: String.raw`\text{frustration} = \beta_0 + \beta_1 \ln(\text{time}) + \beta_2\,\text{errors} + \beta_3\,\text{AI} + \beta_4\,\text{banner} + \beta_5\,\text{years} + \varepsilon`,
  });
  const box = s.appendChild(el('div', { class: 'viz' }));
  onData(({ rows }) => {
    box.innerHTML = '';
    const d = rows.filter((r) => Number.isFinite(r.years_experience) && r.years_experience !== null);
    if (d.length < 20) return emptyNote(box);
    const names = ['ln(time)', 'errors', 'AI agent', 'saw banner', 'years experience'];
    let m;
    try { m = ols(d.map((r) => [Math.log(r.completion_time), r.error_count, r.workflow === AI ? 1 : 0, r.primed, r.years_experience]), d.map((r) => r.frustration), names); } catch (e) { return emptyNote(box, e.message); }
    const coefs = m.names.slice(1).map((n, i) => ({ n, b: m.beta[i + 1], lo: m.beta[i + 1] - 1.96 * m.se[i + 1], hi: m.beta[i + 1] + 1.96 * m.se[i + 1], p: m.p[i + 1] }));
    const f = frame(box, { height: 300, margin: { top: 16, right: 30, bottom: 44, left: 140 } });
    const x = d3.scaleLinear().domain(d3.extent(coefs.flatMap((c) => [c.lo, c.hi, 0]))).nice().range([0, f.w]);
    const y = d3.scaleBand().domain(coefs.map((c) => c.n)).range([0, f.h]).padding(0.4);
    axes(f, x, d3.scaleLinear().range([f.h, 0]), { xLabel: 'change in frustration (points)', yTicks: 0 });
    f.g.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', f.h).attr('stroke', C.ink2).attr('stroke-dasharray', '4 4');
    f.g.selectAll('.yl').data(coefs).join('text').attr('class', 'lbl muted').attr('x', -10).attr('y', (c) => y(c.n) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text((c) => c.n);
    const yy = (c) => y(c.n) + y.bandwidth() / 2;
    f.g.selectAll('.ci').data(coefs).join('line').attr('y1', yy).attr('y2', yy).attr('x1', (c) => x(c.lo)).attr('x2', (c) => x(c.hi)).attr('stroke', (c) => (c.p < 0.05 ? C.yellow : C.muted)).attr('stroke-width', 3);
    f.g.selectAll('.pt').data(coefs).join('circle').attr('cy', yy).attr('cx', (c) => x(c.b)).attr('r', 7).attr('fill', (c) => (c.p < 0.05 ? C.yellow : C.muted)).attr('stroke', C.surface).attr('stroke-width', 2);
    box.appendChild(el('div', {}, `<table class="ltable" style="margin-top:10px"><tr><th>Predictor</th><th class="num">β</th><th class="num">SE</th><th class="num">t</th><th class="num">p</th></tr>
      ${m.names.map((n, i) => `<tr><td>${n}</td><td class="num">${f2(m.beta[i])}</td><td class="num">${f2(m.se[i])}</td><td class="num">${f2(m.t[i])}</td><td class="num">${fmtP(m.p[i])}</td></tr>`).join('')}
      </table><p style="color:var(--l-ink2);font-size:13px">R² = ${f2(m.r2)} · n = ${d.length} tickets (rows from the same person aren’t independent, so treat p-values as approximate)</p>`));
  });
}

// ---------------------------------------------------------------------------
// Scene 3: logistic regression and the confusion matrix
// ---------------------------------------------------------------------------
function logit(root) {
  const s = scene(root, {
    title: 'Bending the line into a probability',
    story: 'At the end you chose: ServiceNow or the AI agent next time? That’s a yes/no outcome, so we squeeze the line through a <b>sigmoid</b> to get a probability. The x-axis is how much faster the AI was <i>for you</i>. Then pick a <b>threshold</b>: above it we predict “prefers AI”. Moving the threshold trades one kind of mistake for another. That trade-off is the whole of classification.',
    formula: String.raw`P(\text{prefers AI}) = \sigma(\beta_0 + \beta_1\,\text{speed-up} + \beta_2\,\text{warned}) = \frac{1}{1+e^{-(\beta_0 + \beta_1 x_1 + \beta_2 x_2)}}`,
  });
  const ctl = controls(s, `<label>Threshold <input type="range" id="th" min="0.05" max="0.95" step="0.01" value="0.5"><b id="thv"></b></label>`);
  const row = s.appendChild(el('div', { class: 'viz-row' }));
  const curveBox = row.appendChild(el('div', { class: 'viz' })), cmBox = row.appendChild(el('div', { class: 'viz' }));
  const out = el('div'); s.appendChild(out);
  let model = null, data = [];
  const draw = () => {
    const th = +ctl.querySelector('#th').value; ctl.querySelector('#thv').textContent = th.toFixed(2);
    curveBox.innerHTML = ''; cmBox.innerHTML = '';
    if (!model) return emptyNote(curveBox, 'Need final-survey answers with both preferences represented.');
    const f = frame(curveBox, { width: 560, height: 340 });
    const x = d3.scaleLinear().domain(d3.extent(data, (d) => d.x)).nice().range([0, f.w]), y = d3.scaleLinear().domain([0, 1]).range([f.h, 0]);
    axes(f, x, y, { xLabel: 'speed-up: ln(ServiceNow time ÷ AI time)', yLabel: 'P(prefers AI)', yFormat: d3.format('.0%') });
    const r = rng(9);
    f.g.selectAll('circle').data(data).join('circle').attr('cx', (d) => x(d.x)).attr('cy', (d) => y(d.y === 1 ? 0.97 - r.random() * 0.05 : 0.03 + r.random() * 0.05)).attr('r', 3.5)
      .attr('fill', (d) => (d.w ? C.yellow : C.blue)).attr('fill-opacity', 0.6);
    const xs = d3.range(x.domain()[0], x.domain()[1], (x.domain()[1] - x.domain()[0]) / 100);
    [[0, C.blue], [1, C.yellow]].forEach(([w, c]) => f.g.append('path').attr('d', d3.line().x((v) => x(v)).y((v) => y(model.predict([v, w])))(xs)).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 3));
    f.g.append('line').attr('x1', 0).attr('x2', f.w).attr('y1', y(th)).attr('y2', y(th)).attr('stroke', C.red).attr('stroke-dasharray', '6 4');
    curveBox.appendChild(el('div', { class: 'legend' }, `<span><i style="background:${C.blue}"></i>No AI warning</span><span><i style="background:${C.yellow}"></i>Saw AI warning</span><span><i style="background:${C.red}"></i>threshold</span>`));
    let tp = 0, fp = 0, tn = 0, fn = 0;
    data.forEach((d) => { const pred = model.predict([d.x, d.w]) >= th ? 1 : 0; if (pred && d.y) tp++; else if (pred) fp++; else if (d.y) fn++; else tn++; });
    cmBox.innerHTML = `<p class="kicker" style="color:var(--teal)">Confusion matrix</p>
      <table class="ltable"><tr><th></th><th class="num">Predicted AI</th><th class="num">Predicted ServiceNow</th></tr>
      <tr><td>Actually chose AI</td><td class="num" style="color:var(--teal)"><b>${tp}</b> TP</td><td class="num" style="color:var(--red)">${fn} FN</td></tr>
      <tr><td>Actually chose ServiceNow</td><td class="num" style="color:var(--red)">${fp} FP</td><td class="num" style="color:var(--teal)"><b>${tn}</b> TN</td></tr></table>
      <p style="color:var(--l-ink2);font-size:13px;margin-top:12px">Warning odds ratio: <b style="color:var(--yellow)">${f2(model.oddsRatio[2])}</b> (${fmtP(model.p[2])}). Below 1 means the warning made people less likely to choose the AI, at the same speed-up.</p>`;
    statGrid(out, [[pct((tp + tn) / data.length), 'accuracy'], [tp + fp ? pct(tp / (tp + fp)) : '–', 'precision', C.teal], [tp + fn ? pct(tp / (tp + fn)) : '–', 'recall', C.teal], [f2(model.oddsRatio[1]), 'odds ratio per unit speed-up']]);
  };
  ctl.querySelector('#th').addEventListener('input', draw);
  onData(({ rows, feedback }) => {
    const pp = new Map(participants(rows).map((p) => [p.id, p]));
    data = feedback.map((fb) => ({ fb, p: pp.get(fb.participant_id) })).filter(({ fb, p }) => p && p.sn_time && p.ai_time && (fb.prefer_ai === 0 || fb.prefer_ai === 1))
      .map(({ fb, p }) => ({ x: Math.log(p.sn_time / p.ai_time), w: Number(p.ai_primed), y: Number(fb.prefer_ai) }));
    model = null;
    if (data.length >= 10 && new Set(data.map((d) => d.y)).size === 2) {
      try { model = logistic(data.map((d) => [d.x, d.w]), data.map((d) => d.y), ['speed-up', 'warned']); } catch { model = null; }
    }
    draw();
  });
  callout(s, 'Every AI classifier in ServiceNow (routing, priority, “is this a major incident?”) ships with a threshold someone chose. <b>Precision</b> is how often its “yes” is right; <b>recall</b> is how many real yeses it catches. Choosing the threshold is a business decision, not a technical one.', 'ai');
}

// ---------------------------------------------------------------------------
// Scene 4: overfitting
// ---------------------------------------------------------------------------
function overfit(root) {
  const s = scene(root, {
    title: 'Memorising vs learning: overfitting',
    story: 'Fit a curve to <b style="color:var(--blue)">training</b> people, then check it on <b style="color:var(--yellow)">test</b> people it has never seen. <b style="color:var(--teal)">Cross-validation</b> estimates test error using only the training data, by rotating which fifth is held out. Turn up the complexity: training error always falls, but past a point the curve starts chasing noise and <b>test error rises</b>. Every AI model, from regression to GPT, lives on this curve.',
    formula: String.raw`\text{test error} = \text{bias}^2 + \text{variance} + \text{irreducible noise}`,
  });
  const ctl = controls(s, `<label>Polynomial degree <input type="range" id="deg" min="1" max="12" value="1"><b id="degv"></b></label><button class="lbtn" id="resplit">New random split</button>`);
  const row = s.appendChild(el('div', { class: 'viz-row' }));
  const fitBox = row.appendChild(el('div', { class: 'viz' })), errBox = row.appendChild(el('div', { class: 'viz' }));
  let all = [], train = [], test = [], seed = 1;
  const poly = (xv, k) => Array.from({ length: k }, (_, j) => xv ** (j + 1));
  const fitDeg = (k) => { try { return ols(train.map((p) => poly(p.x, k)), train.map((p) => p.y)); } catch { return null; } };
  const pred = (m, xv, k) => m.beta[0] + poly(xv, k).reduce((acc, v, j) => acc + v * m.beta[j + 1], 0);
  const rmse = (m, set, k) => Math.sqrt(d3.mean(set, (p) => (p.y - pred(m, p.x, k)) ** 2));
  const split = () => { const r = rng(seed); const sh = r.shuffle(all); const cut = Math.round(sh.length * 0.6); train = sh.slice(0, cut); test = sh.slice(cut); };
  const draw = () => {
    const k = +ctl.querySelector('#deg').value; ctl.querySelector('#degv').textContent = k;
    fitBox.innerHTML = ''; errBox.innerHTML = '';
    if (all.length < 20) return emptyNote(fitBox);
    const f = frame(fitBox, { width: 560, height: 320 });
    const x = d3.scaleLinear().domain([-1.05, 1.05]).range([0, f.w]), y = d3.scaleLinear().domain([1, 10]).range([f.h, 0]).clamp(true);
    axes(f, x, y, { xLabel: 'years of experience (rescaled)', yLabel: 'mean efficiency rating' });
    f.g.selectAll('.tr').data(train).join('circle').attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y)).attr('r', 4).attr('fill', C.blue).attr('fill-opacity', 0.7);
    f.g.selectAll('.te').data(test).join('circle').attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y)).attr('r', 4).attr('fill', 'none').attr('stroke', C.yellow).attr('stroke-width', 1.5);
    const m = fitDeg(k);
    if (m) f.g.append('path').attr('d', d3.line().x((v) => x(v)).y((v) => y(pred(m, v, k)))(d3.range(-1, 1.001, 0.01))).attr('fill', 'none').attr('stroke', C.red).attr('stroke-width', 3);
    // 5-fold cross-validation on the training people only: the honest way to pick complexity.
    const folds = 5, cv = (kk) => d3.mean(d3.range(folds), (fi) => {
      const tr = train.filter((_, i) => i % folds !== fi), va = train.filter((_, i) => i % folds === fi);
      try { const mm = ols(tr.map((p) => poly(p.x, kk)), tr.map((p) => p.y)); return rmse(mm, va, kk); } catch { return NaN; }
    });
    const e = d3.range(1, 13).map((kk) => { const mm = fitDeg(kk); return mm ? { k: kk, tr: rmse(mm, train, kk), te: rmse(mm, test, kk), cv: cv(kk) } : null; }).filter(Boolean);
    const g = frame(errBox, { width: 420, height: 320 });
    const ex = d3.scaleLinear().domain([1, 12]).range([0, g.w]), ey = d3.scaleLinear().domain([0, Math.min(4, d3.max(e, (q) => Math.max(q.tr, q.te)) * 1.1)]).range([g.h, 0]).clamp(true);
    axes(g, ex, ey, { xLabel: 'complexity (degree)', yLabel: 'error (RMSE)' });
    [['tr', C.blue], ['te', C.yellow], ['cv', C.teal]].forEach(([key, c]) => g.g.append('path').attr('d', d3.line().defined((q) => Number.isFinite(q[key])).x((q) => ex(q.k)).y((q) => ey(q[key]))(e)).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 2.5).attr('stroke-dasharray', key === 'cv' ? '6 4' : null));
    const best = e.filter((q) => Number.isFinite(q.cv)).reduce((a2, q) => (q.cv < a2.cv ? q : a2));
    g.g.append('circle').attr('cx', ex(best.k)).attr('cy', ey(best.cv)).attr('r', 6).attr('fill', C.teal);
    g.g.append('line').attr('x1', ex(k)).attr('x2', ex(k)).attr('y1', 0).attr('y2', g.h).attr('stroke', C.red).attr('stroke-dasharray', '4 4');
    errBox.appendChild(el('div', { class: 'legend' }, `<span><i style="background:${C.blue}"></i>training error</span><span><i style="background:${C.teal}"></i>5-fold cross-validation (● = its pick)</span><span><i style="background:${C.yellow}"></i>test error</span>`));
  };
  ctl.querySelector('#deg').addEventListener('input', draw);
  ctl.querySelector('#resplit').addEventListener('click', () => { seed++; split(); draw(); });
  onData(({ rows }) => {
    const pp = d3.rollups(rows.filter((r) => r.years_experience !== null && Number.isFinite(r.years_experience)), (rs) => ({ yrs: rs[0].years_experience, eff: mean(rs.map((r) => r.efficiency)) }), (r) => r.participant_id).map(([, v]) => v);
    const r = rng(2), pick = r.shuffle(pp).slice(0, 60);
    all = pick.map((p) => ({ x: p.yrs / 12.5 - 1, y: p.eff }));
    split(); draw();
  });
}

// ---------------------------------------------------------------------------
// Scene 5: Simpson's paradox
// ---------------------------------------------------------------------------
function simpson(root) {
  const s = scene(root, {
    title: 'Simpson’s paradox: the trend that flips',
    story: 'Does experience make people rate the systems more generously? Look at everyone together, then <b>split by job level</b>. A trend in the whole group can reverse inside every subgroup, because seniority drives both experience and ratings.',
  });
  const ctl = controls(s, `<label><input type="checkbox" id="split"> Split by job level</label>`);
  const box = s.appendChild(el('div', { class: 'viz' }));
  const out = el('div'); s.appendChild(out);
  let pp = [];
  const draw = () => {
    box.innerHTML = '';
    if (pp.length < 10) return emptyNote(box, 'Need at least ten participants who shared their experience and level.');
    const split = ctl.querySelector('#split').checked;
    const f = frame(box, { height: 380 });
    const x = d3.scaleLinear().domain([0, 25]).range([0, f.w]), y = d3.scaleLinear().domain(d3.extent(pp, (p) => p.eff)).nice().range([f.h, 0]);
    axes(f, x, y, { xLabel: 'years of experience', yLabel: 'mean efficiency rating' });
    const col = (p) => (split ? (pp.filter((q) => q.level === p.level).length >= 5 ? SERIES[JOB_LEVELS.indexOf(p.level)] : C.muted) : C.blue);
    f.g.selectAll('circle').data(pp).join('circle').attr('cx', (p) => x(p.yrs)).attr('cy', (p) => y(p.eff)).attr('r', 4).attr('fill', col).attr('fill-opacity', 0.65);
    const fitLine = (set, color, width, dash) => {
      if (set.length < 3 || new Set(set.map((p) => p.yrs)).size < 2) return null;
      const m = ols(set.map((p) => [p.yrs]), set.map((p) => p.eff)), xe = d3.extent(set, (p) => p.yrs);
      f.g.append('line').attr('x1', x(xe[0])).attr('x2', x(xe[1])).attr('y1', y(m.beta[0] + m.beta[1] * xe[0])).attr('y2', y(m.beta[0] + m.beta[1] * xe[1]))
        .attr('stroke', color).attr('stroke-width', width).attr('stroke-dasharray', dash || null);
      return m.beta[1];
    };
    const slopes = [['Everyone', fitLine(pp, split ? C.ink2 : C.ink, split ? 2 : 4, split ? '6 5' : null)]];
    // Privacy: never show a group of fewer than 5 people on its own.
    const shown = JOB_LEVELS.filter((l) => pp.filter((p) => p.level === l).length >= 5);
    if (split) JOB_LEVELS.forEach((l, i) => { if (shown.includes(l)) slopes.push([l, fitLine(pp.filter((p) => p.level === l), SERIES[i], 3.5)]); });
    if (split && shown.length < JOB_LEVELS.length) box.appendChild(el('p', { class: 'empty' }, 'Job levels with fewer than 5 people are hidden to protect anonymity.'));
    if (split) box.appendChild(el('div', { class: 'legend' }, JOB_LEVELS.map((l, i) => `<span><i style="background:${SERIES[i]}"></i>${l}</span>`).join('') + `<span><i style="background:${C.ink2}"></i>Everyone (dashed)</span>`));
    statGrid(out, slopes.filter(([, b]) => b !== null).map(([n, b]) => [`${b > 0 ? '+' : ''}${b.toFixed(2)}`, `slope: ${n}`, b > 0 ? C.teal : C.red]));
  };
  ctl.querySelector('#split').addEventListener('change', draw);
  onData(({ rows }) => {
    pp = d3.rollups(rows.filter((r) => r.job_level && r.years_experience !== null && Number.isFinite(r.years_experience)),
      (rs) => ({ yrs: rs[0].years_experience, level: rs[0].job_level, eff: mean(rs.map((r) => r.efficiency)) }), (r) => r.participant_id).map(([, v]) => v);
    draw();
  });
  callout(s, 'Before you report an AI adoption metric “across the company”, split it by the groups that differ in how they were exposed to it. Aggregates can tell the opposite story to every team in them.', 'ai');
}

// ---------------------------------------------------------------------------
// Scene 6: grading the AI agent
// ---------------------------------------------------------------------------
function confusion(root) {
  const s = scene(root, {
    title: 'Grading the AI agent',
    story: 'Rows are the category you finally submitted; columns are what the AI agent guessed. Everything on the diagonal is a hit. Off-diagonal cells show <b>which mistakes it makes</b>, which tells you what training data it needs next.',
  });
  const box = s.appendChild(el('div', { class: 'viz' }));
  const out = el('div'); s.appendChild(out);
  onData(({ rows }) => {
    box.innerHTML = '';
    const d = rows.filter((r) => r.workflow === AI && r.ai_category && r.chosen_category);
    if (d.length < 5) return emptyNote(box, 'Need AI-agent tickets.');
    const cats = CATEGORIES.filter((c) => d.some((r) => r.ai_category === c || r.chosen_category === c));
    const f = frame(box, { height: 60 + cats.length * 56, margin: { top: 60, right: 20, bottom: 10, left: 170 } });
    const x = d3.scaleBand().domain(cats).range([0, f.w]).padding(0.06), y = d3.scaleBand().domain(cats).range([0, f.h]).padding(0.06);
    const cells = cats.flatMap((a) => cats.map((p) => ({ a, p, n: d.filter((r) => r.chosen_category === a && r.ai_category === p).length })));
    const max = d3.max(cells, (c) => c.n) || 1;
    f.g.selectAll('rect').data(cells).join('rect').attr('x', (c) => x(c.p)).attr('y', (c) => y(c.a)).attr('width', x.bandwidth()).attr('height', y.bandwidth()).attr('rx', 4)
      .attr('fill', (c) => (c.a === c.p ? C.teal : C.red)).attr('fill-opacity', (c) => (c.n ? 0.15 + 0.85 * (c.n / max) : 0.04));
    f.g.selectAll('.n').data(cells.filter((c) => c.n)).join('text').attr('class', 'lbl').attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('x', (c) => x(c.p) + x.bandwidth() / 2).attr('y', (c) => y(c.a) + y.bandwidth() / 2).text((c) => c.n);
    f.g.selectAll('.rl').data(cats).join('text').attr('class', 'lbl muted').attr('x', -10).attr('y', (c) => y(c) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text((c) => c);
    f.g.selectAll('.cl').data(cats).join('text').attr('class', 'lbl muted').attr('x', (c) => x(c) + x.bandwidth() / 2).attr('y', -12).attr('text-anchor', 'middle').text((c) => c.split(' ')[0]);
    f.g.append('text').attr('class', 'lbl').attr('x', f.w / 2).attr('y', -40).attr('text-anchor', 'middle').text('AI agent guessed →');
    const acc = d.filter((r) => r.ai_category === r.chosen_category).length / d.length;
    statGrid(out, [[pct(acc), 'agent accuracy', C.teal], [d.length, 'AI-agent tickets'], [pct(mean(d.map((r) => r.ai_confidence))), 'average stated confidence', C.yellow]]);
  });
}

// ---------------------------------------------------------------------------
// Scene: class balancing (Ch. 6)
// ---------------------------------------------------------------------------
function balancing(root) {
  const s = scene(root, {
    title: 'Class balancing: when “95% accurate” means useless',
    story: 'Train a model to spot <b>major incidents</b>. Only 5% of tickets are real incidents. A model that always answers “not an incident” is <b>95% accurate</b> and catches nothing. Logistic regression trained on the raw data learns that lazy answer too. Rebalance the <b>training</b> data and watch the decision threshold move. Always test on untouched, realistic data.',
    formula: String.raw`\text{precision}=\frac{TP}{TP+FP}\qquad \text{recall}=\frac{TP}{TP+FN}\qquad F_1=\frac{2\,PR}{P+R}`,
  });
  const ctl = controls(s, `<label>Training data <select id="bal">
      <option value="none">As collected (5% incidents)</option>
      <option value="over">Oversample incidents (copy them up to 50/50)</option>
      <option value="under">Undersample normal tickets (down to 50/50)</option>
      <option value="weight">Class weights (count each incident 19×)</option></select></label>`);
  const box = s.appendChild(el('div', { class: 'viz' }));
  const out = el('div'); s.appendChild(out);
  const r = rng(31);
  const make = (n) => Array.from({ length: n }, () => { const y = r.random() < 0.05 ? 1 : 0; return { x: r.normal(y ? 1.7 : 0, 1), y }; });
  const train = make(1400), test = make(1400);
  const update = () => {
    const how = ctl.querySelector('#bal').value, pos = train.filter((d) => d.y), neg = train.filter((d) => !d.y);
    let set = train;
    if (how === 'over' || how === 'weight') set = [...neg, ...Array.from({ length: neg.length }, (_, i) => pos[i % pos.length])];
    if (how === 'under') set = [...pos, ...r.shuffle(neg).slice(0, pos.length)];
    const m = logistic(set.map((d) => [d.x]), set.map((d) => d.y));
    const cut = -m.beta[0] / m.beta[1];                        // where P(incident) = 0.5
    let tp = 0, fp = 0, tn = 0, fn = 0;
    test.forEach((d) => { const p = d.x >= cut; if (p && d.y) tp++; else if (p) fp++; else if (d.y) fn++; else tn++; });
    box.innerHTML = '';
    const f = frame(box, { height: 300 });
    const x = d3.scaleLinear().domain([-4, 5.5]).range([0, f.w]);
    const binsN = d3.bin().domain(x.domain()).thresholds(45)(test.filter((d) => !d.y).map((d) => d.x));
    const binsP = d3.bin().domain(x.domain()).thresholds(45)(test.filter((d) => d.y).map((d) => d.x));
    const y = d3.scaleSqrt().domain([0, d3.max(binsN, (b) => b.length)]).range([f.h, 0]);
    axes(f, x, y, { xLabel: '“urgency score” the model sees', yLabel: 'test tickets (√ scale)', yTicks: 4 });
    [[binsN, C.blue, 0.55], [binsP, C.red, 0.9]].forEach(([bins, c, o]) => f.g.append('g').selectAll('rect').data(bins).join('rect')
      .attr('x', (b) => x(b.x0) + 0.5).attr('width', (b) => Math.max(0, x(b.x1) - x(b.x0) - 1)).attr('y', (b) => y(b.length)).attr('height', (b) => f.h - y(b.length)).attr('fill', c).attr('fill-opacity', o));
    const cx = x(Math.max(-4, Math.min(5.5, cut)));
    f.g.append('line').attr('x1', cx).attr('x2', cx).attr('y1', 0).attr('y2', f.h).attr('stroke', C.yellow).attr('stroke-width', 3);
    f.g.append('text').attr('class', 'lbl').attr('fill', C.yellow).attr('x', cx + 6).attr('y', 14).text('flag as incident →');
    box.appendChild(el('div', { class: 'legend' }, `<span><i style="background:${C.blue}"></i>normal tickets</span><span><i style="background:${C.red}"></i>real incidents (5%)</span><span><i style="background:${C.yellow}"></i>learned threshold</span>`));
    const prec = tp + fp ? tp / (tp + fp) : 0, rec = tp / (tp + fn), f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
    statGrid(out, [[pct((tp + tn) / test.length), 'accuracy'], [pct(1 - test.filter((d) => d.y).length / test.length), '“always say no” accuracy', C.muted],
      [pct(rec), 'recall: incidents caught', C.red], [pct(prec), 'precision: flags that were real', C.teal], [f2(f1), 'F1']]);
  };
  ctl.querySelector('#bal').addEventListener('change', update);
  update();
  callout(s, 'Rebalancing trades precision for recall; it doesn’t create information. <b>SMOTE</b> (in the <code>imbalanced-learn</code> library) synthesises new minority examples between existing ones instead of copying them. Whatever you do, <b>rebalance only the training set</b>: the test set must look like the real world, or your metrics will lie.', 'ai');
}

// ---------------------------------------------------------------------------
// Scene: ROC curve and AUC (Ch. 12)
// ---------------------------------------------------------------------------
function rocScene(root) {
  const s = scene(root, {
    title: 'ROC and AUC: judging a model across every threshold',
    story: 'A threshold picks one point on a trade-off. The <b>ROC curve</b> shows them all: for every possible threshold, how many real positives you catch (true-positive rate) against how many negatives you wrongly flag (false-positive rate). The area under the curve (<b>AUC</b>) is the chance a random positive scores higher than a random negative: <b>0.5 is a coin flip, 1.0 is perfect</b>. Compare the incident detector with the AI agent’s displayed confidence.',
    formula: String.raw`\text{AUC} = P(\text{score}_{+} > \text{score}_{-}) = \frac{U}{n_{+}\,n_{-}}`,
  });
  const ctl = controls(s, `<label>Model <select id="rocsrc"><option value="incident">Incident detector: urgency score → real incident</option><option value="agent">AI agent: displayed confidence → its category was kept</option></select></label>
    <label>Threshold <input type="range" id="th" min="0" max="1" step="0.01" value="0.5"><b id="thv"></b></label>`);
  const box = s.appendChild(el('div', { class: 'viz' }));
  const out = el('div'); s.appendChild(out);
  const r = rng(31);
  const incident = Array.from({ length: 1400 }, () => { const y = r.random() < 0.05 ? 1 : 0; return { s: 1 / (1 + Math.exp(-r.normal(y ? 1.7 : 0, 1))), y }; });
  let agent = [];
  const draw = () => {
    const src = ctl.querySelector('#rocsrc').value, data = src === 'incident' ? incident : agent;
    const th = +ctl.querySelector('#th').value; ctl.querySelector('#thv').textContent = pct(th);
    box.innerHTML = '';
    const ok = data.length > 5 && new Set(data.map((d) => d.y)).size === 2;
    if (!ok) return emptyNote(box, 'Need tickets where people both kept and changed the AI’s category.');
    const res = roc(data.map((d) => d.s), data.map((d) => d.y));
    const f = frame(box, { width: 560, height: 420, margin: { top: 20, right: 30, bottom: 46, left: 56 } });
    const x = d3.scaleLinear().domain([0, 1]).range([0, f.w]), y = d3.scaleLinear().domain([0, 1]).range([f.h, 0]);
    axes(f, x, y, { xLabel: 'false-positive rate', yLabel: 'true-positive rate', xFormat: d3.format('.0%'), yFormat: d3.format('.0%') });
    f.g.append('line').attr('x1', x(0)).attr('y1', y(0)).attr('x2', x(1)).attr('y2', y(1)).attr('stroke', C.muted).attr('stroke-dasharray', '6 5');
    f.g.append('path').attr('d', d3.area().x((p) => x(p.fpr)).y0(f.h).y1((p) => y(p.tpr)).curve(d3.curveStepAfter)(res.curve)).attr('fill', C.teal).attr('fill-opacity', 0.15);
    f.g.append('path').attr('d', d3.line().x((p) => x(p.fpr)).y((p) => y(p.tpr)).curve(d3.curveStepAfter)(res.curve)).attr('fill', 'none').attr('stroke', C.teal).attr('stroke-width', 3);
    const P = data.filter((d) => d.y).length, N = data.length - P;
    const tpr = data.filter((d) => d.y && d.s >= th).length / P, fpr = data.filter((d) => !d.y && d.s >= th).length / N;
    f.g.append('circle').attr('cx', x(fpr)).attr('cy', y(tpr)).attr('r', 9).attr('fill', C.yellow).attr('stroke', C.surface).attr('stroke-width', 2);
    statGrid(out, [[f2(res.auc), 'AUC', res.auc > 0.65 ? C.teal : C.red], [pct(tpr), 'true-positive rate at threshold'], [pct(fpr), 'false-positive rate at threshold', C.red]]);
  };
  ctl.querySelectorAll('select, input').forEach((i) => i.addEventListener('input', draw));
  onData(({ rows }) => {
    agent = rows.filter((q) => q.workflow === AI && Number.isFinite(q.ai_confidence) && (q.ai_correct === 0 || q.ai_correct === 1)).map((q) => ({ s: q.ai_confidence, y: q.ai_correct }));
    draw();
  });
  callout(s, 'The incident detector’s score carries real information, so its curve bows towards the top-left. The agent’s displayed confidence was always 88–97% whether or not people kept its answer, so its AUC sits near 0.5: <b>a confidence number that predicts nothing</b>. Before you show users an AI confidence score, check its AUC and calibration.', 'ai');
}

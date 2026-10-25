// Page 2: The Shape of Noise. Descriptive statistics (Ch. 1-2) and the Central Limit Theorem.

import * as d3 from 'd3';
import { AI, LEGACY, TESTS } from '../data/design.js';
import { onData } from '../data/context.js';
import { describe, mean, median, normPdf, rng, sd } from '../stats/core.js';
import { C, axes, callout, controls, el, emptyNote, f2, frame, hero, scene, statGrid, tex, tip } from '../viz/common.js';

export function renderLesson1(root) {
  hero(root, {
    kicker: 'Lesson 1 · Describing data',
    title: 'The Shape of Noise',
    lede: 'Every ticket you filed is a data point. Before any model or AI, we need to see the data: where it piles up, how far it spreads, and why one long tail can fool an average.',
    chapters: ['Ch 1 · Data & distributions', 'Ch 2 · Centre, spread, shape', 'Sampling distributions', 'Central Limit Theorem'],
  });
  stream(root);
  balance(root);
  shape(root);
  clt(root);
}

// ---------------------------------------------------------------------------
// Scene 1: every ticket as a dot
// ---------------------------------------------------------------------------
function stream(root) {
  const s = scene(root, {
    title: 'Every ticket is a dot',
    story: 'Each dot is one ticket, placed by how long it took. The <b>AI agent</b> rows sit far to the left. The <b>ServiceNow</b> rows sit further right, and the documentation hunt doesn’t just shift, it <b>stretches</b>. That stretch is the noise this whole course is about.',
  });
  const stats = el('div'); s.appendChild(stats);
  const box = s.appendChild(el('div', { class: 'viz' }));
  let seen = new Set();
  onData(({ rows }) => {
    box.innerHTML = '';
    if (!rows.length) return emptyNote(box);
    const f = frame(box, { height: 420, margin: { top: 16, right: 24, bottom: 46, left: 110 } });
    const x = d3.scaleLog().domain([10, d3.max(rows, (r) => r.completion_time) * 1.1]).range([0, f.w]).clamp(true);
    const y = d3.scaleBand().domain(Object.keys(TESTS)).range([0, f.h]).padding(0.25);
    axes(f, x, d3.scaleLinear().range([f.h, 0]), { xLabel: 'Completion time (seconds, log scale)', yTicks: 0 });
    f.g.select('.axis').call(d3.axisBottom(x).tickValues([10, 20, 50, 100, 200, 500, 1000, 2000].filter((v) => v <= x.domain()[1])).tickFormat((v) => `${v}s`));
    f.g.selectAll('.ylab').data(Object.entries(TESTS)).join('text').attr('class', 'lbl muted').attr('x', -10)
      .attr('y', ([k]) => y(k) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text(([, t]) => t.short);
    const r = rng(7), t = tip();
    const dots = f.g.selectAll('circle').data(rows).join('circle')
      .attr('cx', (d) => x(d.completion_time)).attr('r', rows.length > 1000 ? 2.4 : 3.5)
      .attr('fill', (d) => (d.workflow === AI ? C.teal : C.blue)).attr('fill-opacity', 0.65)
      .attr('stroke', (d) => (d.source === 'live' ? C.ink : 'none')).attr('stroke-width', 1)
      .on('mousemove', (ev, d) => t.show(`${TESTS[d.test_num].short}: <b>${d.completion_time}s</b>${d.rage_quit ? ' (abandoned)' : ''}`, ev)).on('mouseleave', t.hide);
    dots.attr('cy', (d) => y(String(d.test_num)) + y.bandwidth() * (0.15 + 0.7 * r.random()));
    // New live tickets drop in from the top.
    dots.filter((d) => d.source === 'live' && !seen.has(d.participant_id + d.test_num))
      .attr('transform', 'translate(0,-400)').transition().duration(900).ease(d3.easeBounceOut).attr('transform', null);
    seen = new Set(rows.filter((d) => d.source === 'live').map((d) => d.participant_id + d.test_num));
    const base = rows.filter((r2) => r2.workflow === LEGACY).map((r2) => r2.completion_time), chaos = rows.filter((r2) => r2.workflow === AI).map((r2) => r2.completion_time);
    statGrid(stats, [
      [new Set(rows.map((d) => d.participant_id)).size, 'participants'],
      [rows.length, 'tickets'],
      [base.length ? `${median(base).toFixed(0)}s` : '–', 'median · ServiceNow', C.blue],
      [chaos.length ? `${median(chaos).toFixed(0)}s` : '–', 'median · AI agent', C.teal],
    ]);
  });
  const lg = el('div', { class: 'legend' }, `<span><i style="background:${C.blue}"></i>ServiceNow catalog</span><span><i style="background:${C.teal}"></i>AI agent</span><span><i style="background:transparent;border:1.5px solid ${C.ink}"></i>Outlined = live ticket</span>`);
  s.appendChild(lg);
}

// ---------------------------------------------------------------------------
// Scene 2: the mean is a balance point (drag the outlier)
// ---------------------------------------------------------------------------
function balance(root) {
  const s = scene(root, {
    title: 'The mean is a balance point. The median is a halfway point.',
    story: 'Twelve documentation-hunt tickets on a see-saw. The <b style="color:var(--yellow)">mean</b> is where the beam balances; the <b style="color:var(--blue)">median</b> has half the tickets on each side. <b>Drag the slowest ticket to the right.</b> One frustrated person moves the mean a long way and the median not at all.',
    formula: String.raw`\bar{x} = \frac{1}{n}\sum_{i=1}^{n} x_i \qquad \text{median} = x_{\left(\frac{n+1}{2}\right)}`,
  });
  const vals = [95, 120, 140, 150, 170, 185, 200, 220, 240, 265, 300, 360];
  const f = frame(s, { height: 260, margin: { top: 40, right: 30, bottom: 50, left: 30 } });
  const x = d3.scaleLinear().domain([0, 1500]).range([0, f.w]);
  f.g.append('g').attr('class', 'axis').attr('transform', `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(8).tickFormat((d) => `${d}s`));
  const beamY = f.h - 80;
  const beam = f.g.append('line').attr('stroke', C.ink2).attr('stroke-width', 3).attr('x1', 0).attr('x2', f.w).attr('y1', beamY).attr('y2', beamY);
  const fulcrum = f.g.append('path').attr('fill', C.yellow);
  const medLine = f.g.append('line').attr('stroke', C.blue).attr('stroke-width', 2).attr('stroke-dasharray', '5 4').attr('y1', 0).attr('y2', beamY);
  const meanLbl = f.g.append('text').attr('class', 'lbl').attr('fill', C.yellow).attr('text-anchor', 'middle');
  const medLbl = f.g.append('text').attr('class', 'lbl').attr('fill', C.blue).attr('text-anchor', 'middle').attr('y', -12);
  const dots = f.g.selectAll('circle').data(vals.map((v, i) => ({ v, i }))).join('circle')
    .attr('r', (d) => (d.i === vals.length - 1 ? 11 : 8)).attr('cy', beamY - 12)
    .attr('fill', (d) => (d.i === vals.length - 1 ? C.red : C.teal)).attr('stroke', C.surface).attr('stroke-width', 2)
    .style('cursor', (d) => (d.i === vals.length - 1 ? 'ew-resize' : 'default'));
  const out = el('div'); s.appendChild(out);
  const update = () => {
    const xs = vals.slice(), m = mean(xs), md = median(xs);
    dots.attr('cx', (d) => x(vals[d.i]));
    fulcrum.attr('d', `M${x(m)},${beamY + 2} l-14,26 h28 z`);
    meanLbl.attr('x', x(m)).attr('y', beamY + 50).text(`mean ${m.toFixed(0)}s`);
    medLine.attr('x1', x(md)).attr('x2', x(md));
    medLbl.attr('x', x(md)).text(`median ${md.toFixed(0)}s`);
    statGrid(out, [[`${m.toFixed(0)}s`, 'mean', C.yellow], [`${md.toFixed(0)}s`, 'median', C.blue], [`${(m - md).toFixed(0)}s`, 'gap (mean − median)']]);
  };
  dots.filter((d) => d.i === vals.length - 1).call(d3.drag().on('drag', (ev) => {
    vals[vals.length - 1] = Math.max(300, Math.min(1500, x.invert(ev.x)));
    update();
  }));
  update();
  callout(s, 'This is why <b>median resolution time</b> describes the typical employee’s experience, while the <b>mean</b> tells finance how many total hours were lost. Both are “true”; they answer different questions.');
}

// ---------------------------------------------------------------------------
// Scene 3: spread and shape, per test
// ---------------------------------------------------------------------------
function shape(root) {
  const s = scene(root, {
    title: 'Spread and shape',
    story: 'Centre isn’t enough. The <b>standard deviation</b> measures typical distance from the mean; the <b>IQR</b> is the width of the middle half; <b>skewness</b> says which way the tail points. Positive skew means a long right tail, where mean > median.',
    formula: String.raw`s=\sqrt{\tfrac{1}{n-1}\textstyle\sum (x_i-\bar x)^2}\qquad \text{IQR}=Q_3-Q_1\qquad g_1=\frac{\tfrac1n\sum (x_i-\bar x)^3}{s^3}`,
  });
  const row = s.appendChild(el('div', { class: 'viz-row' }));
  const chartBox = row.appendChild(el('div', { class: 'viz' })), tableBox = row.appendChild(el('div', { class: 'viz' }));
  onData(({ rows }) => {
    chartBox.innerHTML = ''; tableBox.innerHTML = '';
    if (!rows.length) return emptyNote(chartBox);
    const d = Object.keys(TESTS).map((t) => ({ t, ...describe(rows.filter((r) => String(r.test_num) === t).map((r) => r.completion_time)) })).filter((r) => r.n > 2);
    const f = frame(chartBox, { width: 560, height: 340, margin: { top: 16, right: 20, bottom: 44, left: 96 } });
    const x = d3.scaleLinear().domain([0, d3.max(d, (r) => r.mean) * 1.15]).range([0, f.w]);
    const y = d3.scaleBand().domain(d.map((r) => r.t)).range([0, f.h]).padding(0.4);
    axes(f, x, d3.scaleLinear().range([f.h, 0]), { xLabel: 'seconds', yTicks: 0 });
    f.g.selectAll('.yl').data(d).join('text').attr('class', 'lbl muted').attr('x', -10).attr('y', (r) => y(r.t) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text((r) => TESTS[r.t].short);
    const yy = (r) => y(r.t) + y.bandwidth() / 2;
    f.g.selectAll('.bar').data(d).join('line').attr('stroke', C.muted).attr('stroke-width', 2).attr('y1', yy).attr('y2', yy).attr('x1', (r) => x(r.median)).attr('x2', (r) => x(r.median)).transition().duration(900).attr('x2', (r) => x(r.mean));
    f.g.selectAll('.md').data(d).join('circle').attr('cy', yy).attr('cx', (r) => x(r.median)).attr('r', 7).attr('fill', C.blue).attr('stroke', C.surface).attr('stroke-width', 2);
    f.g.selectAll('.mn').data(d).join('circle').attr('cy', yy).attr('r', 7).attr('fill', C.yellow).attr('stroke', C.surface).attr('stroke-width', 2).attr('cx', (r) => x(r.median)).transition().duration(900).attr('cx', (r) => x(r.mean));
    chartBox.appendChild(el('div', { class: 'legend' }, `<span><i style="background:${C.blue}"></i>median</span><span><i style="background:${C.yellow}"></i>mean</span>`));
    tableBox.innerHTML = `<table class="ltable"><tr><th>Test</th><th class="num">Median</th><th class="num">SD</th><th class="num">IQR</th><th class="num">Skew</th></tr>
      ${d.map((r) => `<tr><td>${TESTS[r.t].short}</td><td class="num">${r.median.toFixed(0)}</td><td class="num">${r.sd.toFixed(0)}</td><td class="num">${r.iqr.toFixed(0)}</td><td class="num" style="color:${r.skew > 1 ? C.yellow : 'inherit'}">${f2(r.skew)}</td></tr>`).join('')}</table>`;
  });
}

// ---------------------------------------------------------------------------
// Scene 4: the Central Limit Theorem sampling machine
// ---------------------------------------------------------------------------
function clt(root) {
  const s = scene(root, {
    title: 'The Central Limit Theorem: order out of chaos',
    story: 'Take the ugly, skewed ServiceNow ticket times. Grab <b>n</b> tickets at random and average them. Do it again, and again. The averages pile up into a <b>bell curve</b>, and its width shrinks like 1/√n, whatever shape the original data had. This one fact is why polling, A/B testing and every AI accuracy number with an error bar works.',
    formula: String.raw`\bar X_n \;\approx\; \mathcal{N}\!\left(\mu,\; \frac{\sigma^2}{n}\right) \quad\text{for large } n \qquad\Longrightarrow\qquad SE = \frac{\sigma}{\sqrt n}`,
  });
  const ctl = controls(s, `
    <label>Sample size n <input type="range" id="n" min="1" max="50" value="5"><b id="nv">5</b></label>
    <button class="lbtn" id="one">Draw 1 sample</button><button class="lbtn hot" id="many">Draw 200</button><button class="lbtn" id="reset">Reset</button>`);
  const box = s.appendChild(el('div', { class: 'viz' }));
  const out = el('div'); s.appendChild(out);
  let pop = [], means = [], n = 5, mu = 0, sigma = 1;
  const r = rng(11);

  const W = 900, H = 520;
  const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${W} ${H}`);
  const m = { l: 56, r: 24 }, iw = W - m.l - m.r;
  const top = svg.append('g').attr('transform', `translate(${m.l},20)`);   // population
  const mid = svg.append('g').attr('transform', `translate(${m.l},190)`);  // sample being drawn
  const bot = svg.append('g').attr('transform', `translate(${m.l},250)`);  // distribution of means
  const topH = 120, botH = 220;
  let x;

  function setup() {
    top.selectAll('*').remove(); bot.selectAll('*').remove(); mid.selectAll('*').remove();
    x = d3.scaleLinear().domain([0, d3.quantile(pop.slice().sort(d3.ascending), 0.98)]).range([0, iw]).clamp(true);
    const bins = d3.bin().domain(x.domain()).thresholds(40)(pop);
    const y = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.length)]).range([topH, 0]);
    top.selectAll('rect').data(bins).join('rect').attr('x', (b) => x(b.x0) + 1).attr('width', (b) => Math.max(0, x(b.x1) - x(b.x0) - 2))
      .attr('y', (b) => y(b.length)).attr('height', (b) => topH - y(b.length)).attr('fill', C.blue).attr('fill-opacity', 0.55).attr('rx', 2);
    top.append('text').attr('class', 'lbl muted').attr('x', 0).attr('y', -4).text(`Population: ${pop.length} ServiceNow ticket times (skewed)`);
    top.append('line').attr('x1', x(mu)).attr('x2', x(mu)).attr('y1', 0).attr('y2', topH).attr('stroke', C.yellow).attr('stroke-dasharray', '4 4');
    top.append('text').attr('class', 'lbl').attr('fill', C.yellow).attr('x', x(mu) + 6).attr('y', 12).text(`μ = ${mu.toFixed(0)}s`);
    bot.append('g').attr('class', 'axis').attr('transform', `translate(0,${botH})`).call(d3.axisBottom(x).ticks(8).tickFormat((d) => `${d}s`));
    bot.append('text').attr('class', 'lbl muted').attr('x', 0).attr('y', -6).text('Distribution of sample means');
    bot.append('g').attr('class', 'bars'); bot.append('path').attr('class', 'curve').attr('fill', 'none').attr('stroke', C.yellow).attr('stroke-width', 2.5);
    drawMeans();
  }

  function drawMeans() {
    const bins = d3.bin().domain(x.domain()).thresholds(60)(means);
    const binW = (x.domain()[1] - x.domain()[0]) / 60;
    const se = sigma / Math.sqrt(n), peak = Math.max(d3.max(bins, (b) => b.length) || 1, means.length * binW * normPdf(mu, mu, se));
    const y = d3.scaleLinear().domain([0, peak * 1.05]).range([botH, 0]);
    bot.select('.bars').selectAll('rect').data(bins).join('rect').attr('x', (b) => x(b.x0) + 0.5).attr('width', (b) => Math.max(0, x(b.x1) - x(b.x0) - 1))
      .attr('y', (b) => y(b.length)).attr('height', (b) => botH - y(b.length)).attr('fill', C.teal).attr('fill-opacity', 0.75);
    if (means.length > 5) {
      const xs = d3.range(x.domain()[0], x.domain()[1], (x.domain()[1] - x.domain()[0]) / 300);
      bot.select('.curve').attr('d', d3.line().x((v) => x(v)).y((v) => y(means.length * binW * normPdf(v, mu, se)))(xs));
    } else bot.select('.curve').attr('d', null);
    statGrid(out, [
      [means.length, 'samples drawn'],
      [means.length ? `${mean(means).toFixed(0)}s` : '–', 'mean of the means', C.teal],
      [`${mu.toFixed(0)}s`, 'true μ', C.yellow],
      [means.length > 1 ? `${sd(means).toFixed(1)}s` : '–', 'spread of the means', C.teal],
      [`${se.toFixed(1)}s`, 'theory: σ/√n', C.yellow],
    ]);
  }

  function sample() {
    const xs = Array.from({ length: n }, () => pop[Math.floor(r.random() * pop.length)]);
    return { xs, m: mean(xs) };
  }

  function drawOne() {
    const { xs, m: mm } = sample();
    mid.selectAll('*').remove();
    mid.selectAll('circle').data(xs).join('circle').attr('cx', (v) => x(v)).attr('cy', -40).attr('r', 5).attr('fill', C.blue)
      .transition().duration(500).attr('cy', 0)
      .transition().duration(500).attr('cx', x(mm)).attr('fill', C.teal)
      .on('end', function (_, i) { if (i === 0) { means.push(mm); drawMeans(); } });
    mid.append('text').attr('class', 'lbl').attr('x', x(mm)).attr('y', 22).attr('text-anchor', 'middle').attr('fill', C.teal).attr('opacity', 0)
      .text(`x̄ = ${mm.toFixed(0)}s`).transition().delay(900).attr('opacity', 1);
  }

  ctl.querySelector('#n').addEventListener('input', (e) => { n = Number(e.target.value); ctl.querySelector('#nv').textContent = n; means = []; drawMeans(); });
  ctl.querySelector('#one').addEventListener('click', drawOne);
  ctl.querySelector('#many').addEventListener('click', () => {
    let k = 0;
    const step = () => { for (let i = 0; i < 10; i++) means.push(sample().m); drawMeans(); if (++k < 20) requestAnimationFrame(step); };
    step();
  });
  ctl.querySelector('#reset').addEventListener('click', () => { means = []; mid.selectAll('*').remove(); drawMeans(); });

  onData(({ rows }) => {
    const legacy = rows.filter((d) => d.workflow === LEGACY).map((d) => d.completion_time);
    pop = legacy.length >= 20 ? legacy : rows.map((d) => d.completion_time);
    if (pop.length < 5) return emptyNote(box);
    mu = mean(pop); sigma = sd(pop, 0); means = [];
    setup();
  });

  callout(s, `When a vendor says their AI agent is “92% accurate”, that number is a <b>sample mean</b>. The CLT tells you its error bar: with 100 test tickets, ${tex(String.raw`SE=\sqrt{0.92\times0.08/100}\approx 2.7\%`)}, so the truth is plausibly anywhere from about 87% to 97%. <b>Ask for the n.</b>`, 'ai');
}

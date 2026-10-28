// Page 4: Did the banners work? Hypothesis testing, assumptions, power, ANOVA, post hoc and
// chi-square (Ch. 3, 4, 6, 7, 8, 9), all on the class's own two-banner experiment.

import * as d3 from 'd3';
import { AI, LEGACY } from '../data/design.js';
import { onData } from '../data/context.js';
import { chiSquareIndependence, cohensD, levene, mannWhitney, mean, normCdf, normInv, normPdf, rng, sd, shapiroWilk, tCdf, tInv, tPdf, tTest, tukeyHSD, twoProportionZ, twoWayAnova, wilcoxonSignedRank } from '../stats/core.js';
import { C, axes, callout, controls, el, emptyNote, f2, fmtP, frame, hero, pct, scene, statGrid } from '../viz/common.js';

const METRICS = {
  sn_eff: { label: 'H1 · ServiceNow efficiency rating: positive banner vs none', group: 'snow_primed', alt: 'greater' },
  ai_eff: { label: 'H2 · AI agent efficiency rating: hallucination warning vs none', group: 'ai_primed', alt: 'less' },
  ai_frust: { label: 'AI agent frustration: warning vs none', group: 'ai_primed', alt: 'greater' },
  sn_frust: { label: 'ServiceNow frustration: positive banner vs none', group: 'snow_primed', alt: 'less' },
};

const geo = (xs) => Math.exp(mean(xs.map(Math.log)));
export function participants(rows) {
  return [...d3.group(rows, (r) => r.participant_id).values()].map((rs) => {
    const sn = rs.filter((r) => r.workflow === LEGACY), ai = rs.filter((r) => r.workflow === AI);
    const m = (xs, k) => (xs.length ? mean(xs.map((r) => r[k])) : undefined);
    return {
      id: rs[0].participant_id, snow_primed: rs[0].snow_primed, ai_primed: rs[0].ai_primed, level: rs[0].job_level,
      sn_eff: m(sn, 'efficiency'), ai_eff: m(ai, 'efficiency'), sn_frust: m(sn, 'frustration'), ai_frust: m(ai, 'frustration'),
      sn_time: sn.length === 3 ? geo(sn.map((r) => r.completion_time)) : undefined, ai_time: ai.length === 3 ? geo(ai.map((r) => r.completion_time)) : undefined,
    };
  });
}

export function renderLesson3(root) {
  hero(root, {
    kicker: 'Lesson 3 · Inference',
    title: 'Did the Banners Work?',
    lede: 'Some of you saw “ServiceNow’s single pane of glass is incredibly efficient.” Some saw “AI agents are known to hallucinate.” The stopwatch didn’t care. Did your ratings? This is the question behind every A/B test of every AI rollout.',
    chapters: ['Ch 3 · Logic of hypothesis testing', 'Ch 4 · Significance & power', 'Ch 7 · Parametric tests', 'Ch 8 · Nonparametric tests', 'Ch 9 · ANOVA & post hoc'],
  });
  // Scene 1 owns the chosen comparison; scene 2 re-renders from it. The bus remembers the
  // latest groups so a listener added after the first emit still gets them.
  const state = { metric: 'sn_eff', alt: 'greater' };
  const bus = { last: null, fns: [], emit(d) { this.last = d; this.fns.forEach((f) => f(d)); }, on(f) { this.fns.push(f); if (this.last) f(this.last); } };
  permutation(root, state, bus);
  tTestScene(root, bus);
  stopwatch(root);
  power(root);
  practical(root);
  anova(root);
  chiSquare(root);
}

// ---------------------------------------------------------------------------
// Scene 1: the null world, by shuffling
// ---------------------------------------------------------------------------
function permutation(root, state, bus) {
  const s = scene(root, {
    title: 'Imagine the banner did nothing',
    story: 'If a banner had no effect, the “saw it” and “didn’t” labels would be arbitrary, and we could shuffle them without changing anything. So shuffle them. Each shuffle gives a difference that <b>pure chance</b> produces. Do it a thousand times and you’ve drawn the <b>null distribution</b>. The p-value is how often chance does at least as well as what we actually saw.',
    formula: String.raw`p = P\big(\text{difference as extreme as observed} \;\big|\; H_0 \text{ true}\big)`,
  });
  const ctl = controls(s, `
    <label>Question <select id="metric">${Object.entries(METRICS).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join('')}</select></label>
    <label>Alternative <select id="alt"><option value="greater">Banner group higher</option><option value="less">Banner group lower</option><option value="two-sided">Two-sided</option></select></label>
    <button class="lbtn" id="once">Shuffle once</button><button class="lbtn hot" id="many">Shuffle 1,000×</button>`);
  const groupsBox = s.appendChild(el('div', { class: 'viz' }));
  const nullBox = s.appendChild(el('div', { class: 'viz' }));
  const out = el('div'); s.appendChild(out);
  let data = [], nulls = [], obs = 0, labels = [], cache = [];
  const r = rng(5);

  function drawGroups(shuffled) {
    groupsBox.innerHTML = '';
    const f = frame(groupsBox, { height: 200, margin: { top: 16, right: 24, bottom: 40, left: 100 } });
    const x = d3.scaleLinear().domain(d3.extent(data, (d) => d.v)).nice().range([0, f.w]);
    const y = d3.scaleBand().domain([1, 0]).range([0, f.h]).padding(0.2);
    f.g.append('g').attr('class', 'axis').attr('transform', `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(8));
    f.g.selectAll('.gl').data([[1, 'Saw banner', C.yellow], [0, 'No banner', C.blue]]).join('text').attr('class', 'lbl').attr('x', -10)
      .attr('y', ([g]) => y(g) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('fill', ([, , c]) => c).text(([, l]) => l);
    const jitter = data.map(() => r.random());
    f.g.selectAll('circle').data(data).join('circle').attr('r', 4).attr('cx', (d) => x(d.v))
      .attr('cy', (d, i) => y(d.g) + y.bandwidth() * (0.15 + 0.7 * jitter[i])).attr('fill', (d) => (d.g ? C.yellow : C.blue)).attr('fill-opacity', 0.7)
      .transition().duration(shuffled ? 700 : 0).attr('cy', (d, i) => y(labels[i]) + y.bandwidth() * (0.15 + 0.7 * jitter[i]));
    const m1 = mean(data.filter((_, i) => labels[i] === 1).map((d) => d.v)), m0 = mean(data.filter((_, i) => labels[i] === 0).map((d) => d.v));
    [[m1, 1, C.yellow], [m0, 0, C.blue]].forEach(([m, g, c]) => f.g.append('line').attr('x1', x(m)).attr('x2', x(m)).attr('y1', y(g)).attr('y2', y(g) + y.bandwidth()).attr('stroke', c).attr('stroke-width', 3));
    return m1 - m0;
  }

  function drawNull() {
    nullBox.innerHTML = '';
    const f = frame(nullBox, { height: 260 });
    const ext = d3.extent([...nulls, obs, -obs]), pad = (ext[1] - ext[0]) * 0.1 || 1;
    const x = d3.scaleLinear().domain([ext[0] - pad, ext[1] + pad]).range([0, f.w]);
    const bins = d3.bin().domain(x.domain()).thresholds(40)(nulls);
    const y = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.length) || 1]).range([f.h, 0]);
    axes(f, x, y, { xLabel: 'Difference in means (banner − no banner) after shuffling', yLabel: 'shuffles' });
    const extreme = (v) => (state.alt === 'greater' ? v >= obs : state.alt === 'less' ? v <= obs : Math.abs(v) >= Math.abs(obs));
    f.g.selectAll('rect').data(bins).join('rect').attr('x', (b) => x(b.x0) + 1).attr('width', (b) => Math.max(0, x(b.x1) - x(b.x0) - 1))
      .attr('y', (b) => y(b.length)).attr('height', (b) => f.h - y(b.length)).attr('fill', (b) => (extreme((b.x0 + b.x1) / 2) ? C.red : C.teal)).attr('fill-opacity', 0.8);
    f.g.append('line').attr('x1', x(obs)).attr('x2', x(obs)).attr('y1', 0).attr('y2', f.h).attr('stroke', C.yellow).attr('stroke-width', 3);
    f.g.append('text').attr('class', 'lbl').attr('fill', C.yellow).attr('x', x(obs) + 6).attr('y', 14).text(`observed ${f2(obs)}`);
    const p = nulls.length ? nulls.filter(extreme).length / nulls.length : NaN;
    statGrid(out, [[f2(obs), 'observed difference', C.yellow], [nulls.length, 'shuffles'], [nulls.length ? (p === 0 ? `< ${(1 / nulls.length).toFixed(3)}` : p.toFixed(3)) : '–', 'permutation p-value', C.red]]);
  }

  const shuffleDiff = () => {
    labels = r.shuffle(data.map((d) => d.g));
    return mean(data.filter((_, i) => labels[i] === 1).map((d) => d.v)) - mean(data.filter((_, i) => labels[i] === 0).map((d) => d.v));
  };

  function load() {
    const m = METRICS[state.metric];
    data = participants(cache).filter((p) => Number.isFinite(p[state.metric])).map((p) => ({ g: Number(p[m.group]), v: p[state.metric] }));
    if (data.filter((d) => d.g).length < 2 || data.filter((d) => !d.g).length < 2) { emptyNote(groupsBox, 'Need at least two participants with and without the banner.'); nullBox.innerHTML = ''; return; }
    labels = data.map((d) => d.g); nulls = [];
    obs = drawGroups(false); drawNull();
    bus.emit({ data, alt: state.alt });
  }

  ctl.querySelector('#once').addEventListener('click', () => { if (!data.length) return; nulls.push(shuffleDiff()); drawGroups(true); drawNull(); });
  ctl.querySelector('#many').addEventListener('click', () => {
    if (!data.length) return;
    let k = 0;
    const step = () => { for (let i = 0; i < 50; i++) nulls.push(shuffleDiff()); drawNull(); if (++k < 20) requestAnimationFrame(step); else { labels = data.map((d) => d.g); drawGroups(true); } };
    step();
  });
  ctl.querySelector('#metric').addEventListener('change', (e) => {
    state.metric = e.target.value; state.alt = METRICS[state.metric].alt; ctl.querySelector('#alt').value = state.alt; load();
  });
  ctl.querySelector('#alt').addEventListener('change', (e) => { state.alt = e.target.value; drawNull(); bus.emit({ data, alt: state.alt }); });
  onData(({ rows }) => { cache = rows; load(); });
}

// ---------------------------------------------------------------------------
// Scene 2: the t-test shortcut, assumptions and automatic test choice
// ---------------------------------------------------------------------------
function tTestScene(root, bus) {
  const s = scene(root, {
    title: 'The shortcut: the t-distribution',
    story: 'Thanks to the Central Limit Theorem, that shuffled histogram is almost always bell-shaped, so we can skip the shuffling and use a formula. But formulas come with <b>assumptions</b>. Check them first, then pick the test that fits. The red area is the p-value.',
    formula: String.raw`t = \frac{\bar x_{\text{banner}} - \bar x_{\text{none}}}{\sqrt{s_1^2/n_1 + s_0^2/n_0}}`,
  });
  const box = s.appendChild(el('div', { class: 'viz' }));
  const diag = el('div'); s.appendChild(diag);
  bus.on(({ data, alt }) => {
    const a = data.filter((d) => d.g).map((d) => d.v), b = data.filter((d) => !d.g).map((d) => d.v);
    box.innerHTML = ''; diag.innerHTML = '';
    if (a.length < 3 || b.length < 3) return emptyNote(box, 'Need at least three participants in each group.');
    const swA = shapiroWilk(a), swB = shapiroWilk(b), lev = levene(a, b);
    const normal = swA.p > 0.05 && swB.p > 0.05, eqVar = lev.p > 0.05;
    const chosen = normal && eqVar ? 'Student’s t' : normal ? 'Welch’s t' : 'Mann–Whitney U';
    const tt = tTest(a, b, { equalVar: chosen === 'Student’s t', alternative: alt }), mw = mannWhitney(a, b, { alternative: alt });
    const f = frame(box, { height: 300 });
    const span = Math.max(4.5, Math.abs(tt.t) + 1), xs = d3.range(-span, span, (2 * span) / 400);
    const x = d3.scaleLinear().domain([-span, span]).range([0, f.w]), y = d3.scaleLinear().domain([0, tPdf(0, tt.df) * 1.1]).range([f.h, 0]);
    axes(f, x, y, { xLabel: `t statistic (df = ${tt.df.toFixed(1)})`, yLabel: 'density' });
    const inTail = (v) => (alt === 'greater' ? v >= tt.t : alt === 'less' ? v <= tt.t : Math.abs(v) >= Math.abs(tt.t));
    f.g.append('path').attr('d', d3.area().defined(inTail).x((v) => x(v)).y0(f.h).y1((v) => y(tPdf(v, tt.df)))(xs)).attr('fill', C.red).attr('fill-opacity', 0.55);
    f.g.append('path').attr('d', d3.line().x((v) => x(v)).y((v) => y(tPdf(v, tt.df)))(xs)).attr('fill', 'none').attr('stroke', C.blue).attr('stroke-width', 2.5);
    f.g.append('line').attr('x1', x(tt.t)).attr('x2', x(tt.t)).attr('y1', 0).attr('y2', f.h).attr('stroke', C.yellow).attr('stroke-width', 3);
    f.g.append('text').attr('class', 'lbl').attr('fill', C.yellow).attr('x', x(tt.t) + 6).attr('y', 14).text(`t = ${f2(tt.t)}`);
    const crit = alt === 'two-sided' ? [tInv(0.975, tt.df), -tInv(0.975, tt.df)] : [alt === 'greater' ? tInv(0.95, tt.df) : tInv(0.05, tt.df)];
    crit.forEach((c) => f.g.append('line').attr('x1', x(c)).attr('x2', x(c)).attr('y1', f.h * 0.35).attr('y2', f.h).attr('stroke', C.muted).attr('stroke-dasharray', '4 4'));
    const finalP = chosen === 'Mann–Whitney U' ? mw.p : tt.p;
    diag.innerHTML = `
      <table class="ltable" style="margin-top:12px">
        <tr><th>Check</th><th>Result</th><th class="num">p</th><th>Verdict</th></tr>
        <tr><td>Shapiro–Wilk, banner group</td><td>W = ${f2(swA.W)}</td><td class="num">${fmtP(swA.p)}</td><td>${swA.p > 0.05 ? 'looks normal' : '<span style="color:var(--red)">not normal</span>'}</td></tr>
        <tr><td>Shapiro–Wilk, no-banner group</td><td>W = ${f2(swB.W)}</td><td class="num">${fmtP(swB.p)}</td><td>${swB.p > 0.05 ? 'looks normal' : '<span style="color:var(--red)">not normal</span>'}</td></tr>
        <tr><td>Levene (equal spread)</td><td>F = ${f2(lev.F)}</td><td class="num">${fmtP(lev.p)}</td><td>${eqVar ? 'similar spread' : '<span style="color:var(--red)">unequal spread</span>'}</td></tr>
      </table>`;
    statGrid(diag, [[chosen, 'test the checks choose', C.yellow], [fmtP(finalP), `p-value (${alt})`], [f2(cohensD(a, b)), 'Cohen’s d'], [f2(mw.rankBiserial), 'rank-biserial r'],
      [`[${f2(tt.ci[0])}, ${f2(tt.ci[1])}]`, '95% CI, mean difference']]);
  });
  callout(s, 'Ratings on a 1–10 slider are rarely normal: they bunch at the ends. That’s why the checks often hand you <b>Mann–Whitney U</b>, which compares ranks instead of means. Same question, fewer assumptions.');
}

// ---------------------------------------------------------------------------
// Scene 3: the stopwatch (paired comparison)
// ---------------------------------------------------------------------------
function stopwatch(root) {
  const s = scene(root, {
    title: 'Meanwhile, the stopwatch',
    story: 'Everyone used <b>both</b> systems, so each person is their own control. Each line is one person: their typical ServiceNow ticket on the left, their typical AI-agent ticket on the right. On a log scale, the average slope is the <b>speed-up ratio</b>.',
    formula: String.raw`d_i = \ln(\text{AI time}_i) - \ln(\text{ServiceNow time}_i), \qquad t = \frac{\bar d}{s_d/\sqrt n}, \qquad \text{ratio} = e^{\bar d}`,
  });
  const box = s.appendChild(el('div', { class: 'viz' }));
  const out = el('div'); s.appendChild(out);
  onData(({ rows }) => {
    box.innerHTML = '';
    const pp = participants(rows).filter((p) => p.sn_time && p.ai_time);
    if (pp.length < 3) return emptyNote(box, 'Need at least three people who finished both sets.');
    const f = frame(box, { height: 380, margin: { top: 20, right: 40, bottom: 40, left: 70 } });
    const x = d3.scalePoint().domain(['ServiceNow', 'AI agent']).range([f.w * 0.2, f.w * 0.8]);
    const y = d3.scaleLog().domain(d3.extent(pp.flatMap((p) => [p.sn_time, p.ai_time]))).nice().range([f.h, 0]);
    f.g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6).tickFormat((v) => `${d3.format('~r')(v)}s`));
    f.g.append('text').attr('class', 'lbl muted').attr('transform', 'rotate(-90)').attr('x', -f.h / 2).attr('y', -50).attr('text-anchor', 'middle').text('typical seconds per ticket (log)');
    ['ServiceNow', 'AI agent'].forEach((k) => f.g.append('text').attr('class', 'lbl').attr('x', x(k)).attr('y', f.h + 26).attr('text-anchor', 'middle').text(k));
    f.g.selectAll('.pl').data(pp).join('line').attr('x1', x('ServiceNow')).attr('x2', x('ServiceNow')).attr('y1', (p) => y(p.sn_time)).attr('y2', (p) => y(p.sn_time))
      .attr('stroke', (p) => (p.ai_time < p.sn_time ? C.teal : C.red)).attr('stroke-opacity', 0.35)
      .transition().duration(900).delay((_, i) => i * 3).attr('x2', x('AI agent')).attr('y2', (p) => y(p.ai_time));
    const d = pp.map((p) => Math.log(p.ai_time) - Math.log(p.sn_time)), n = d.length, md = mean(d), se = sd(d) / Math.sqrt(n), t = md / se, crit = tInv(0.975, n - 1);
    const medSn = d3.median(pp, (p) => p.sn_time), medAi = d3.median(pp, (p) => p.ai_time);
    f.g.append('line').attr('x1', x('ServiceNow')).attr('x2', x('AI agent')).attr('y1', y(medSn)).attr('y2', y(medAi)).attr('stroke', C.yellow).attr('stroke-width', 4);
    statGrid(out, [[`${(1 / Math.exp(md)).toFixed(1)}×`, 'faster with the AI agent', C.teal],
      [`${(1 / Math.exp(md + crit * se)).toFixed(1)}–${(1 / Math.exp(md - crit * se)).toFixed(1)}×`, '95% CI'],
      [pct(d.filter((v) => v < 0).length / n), 'of people were faster with AI'],
      [fmtP(tCdf(t, n - 1)), 'paired t-test (one-sided)'],
      [fmtP(wilcoxonSignedRank(d, { alternative: 'less' }).p), 'Wilcoxon signed-rank (nonparametric)']]);
  });
  callout(s, 'Put this next to the ratings. If the AI is clearly faster but the people who saw the warning rate it lower anyway, then <b>perception is lagging performance</b>. That gap is what an AI leader has to manage.', 'ai');
}

// ---------------------------------------------------------------------------
// Scene 4: power, two worlds
// ---------------------------------------------------------------------------
function power(root) {
  const s = scene(root, {
    title: 'Power: two worlds, one threshold',
    story: 'There are two possible worlds. In the <b style="color:var(--blue)">null world</b> the banner does nothing; in the <b style="color:var(--teal)">real-effect world</b> it shifts ratings by <b>d</b> standard deviations. We reject when our statistic passes the threshold. <b style="color:var(--red)">α</b> is how often we’re fooled in the null world; <b style="color:var(--teal)">power</b> is how often we catch the real effect.',
    formula: String.raw`\text{power} = 1-\beta = P\big(\text{reject } H_0 \mid \text{effect } d\big), \qquad \delta = d\sqrt{n/2}`,
  });
  const ctl = controls(s, `
    <label>Effect size d <input type="range" id="d" min="0.1" max="1.5" step="0.05" value="0.8"><b id="dv"></b></label>
    <label>n per group <input type="range" id="n" min="4" max="120" value="20"><b id="nv"></b></label>
    <label>α <select id="a"><option>0.01</option><option selected>0.05</option><option>0.10</option></select></label>`);
  const f = frame(s, { height: 320 });
  const out = el('div'); s.appendChild(out);
  const x = d3.scaleLinear().domain([-4, 9]).range([0, f.w]), y = d3.scaleLinear().domain([0, 0.45]).range([f.h, 0]);
  axes(f, x, y, { xLabel: 'test statistic (standard errors)', yLabel: 'density' });
  const layers = f.g.append('g');
  const update = () => {
    const d = +ctl.querySelector('#d').value, n = +ctl.querySelector('#n').value, a = +ctl.querySelector('#a').value;
    ctl.querySelector('#dv').textContent = d.toFixed(2); ctl.querySelector('#nv').textContent = n;
    const delta = d * Math.sqrt(n / 2), crit = normInv(1 - a), xs = d3.range(-4, 9, 0.02);
    layers.selectAll('*').remove();
    const area = (mu, cond) => d3.area().defined(cond).x((v) => x(v)).y0(f.h).y1((v) => y(normPdf(v, mu, 1)))(xs);
    layers.append('path').attr('d', area(delta, (v) => v >= crit)).attr('fill', C.teal).attr('fill-opacity', 0.35);
    layers.append('path').attr('d', area(delta, (v) => v < crit)).attr('fill', C.purple).attr('fill-opacity', 0.25);
    layers.append('path').attr('d', area(0, (v) => v >= crit)).attr('fill', C.red).attr('fill-opacity', 0.7);
    [[0, C.blue], [delta, C.teal]].forEach(([mu, c]) => layers.append('path').attr('d', d3.line().x((v) => x(v)).y((v) => y(normPdf(v, mu, 1)))(xs)).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 2.5));
    layers.append('line').attr('x1', x(crit)).attr('x2', x(crit)).attr('y1', 0).attr('y2', f.h).attr('stroke', C.yellow).attr('stroke-width', 2).attr('stroke-dasharray', '6 4');
    layers.append('text').attr('class', 'lbl').attr('fill', C.yellow).attr('x', x(crit) + 6).attr('y', 14).text('reject beyond here');
    const pw = 1 - normCdf(crit - delta);
    let need = 2; while (need < 2000 && 1 - normCdf(crit - d * Math.sqrt(need / 2)) < 0.8) need++;
    statGrid(out, [[pct(pw), 'power', C.teal], [pct(1 - pw), 'β (missed effect)', C.purple], [a, 'α (false alarm)', C.red], [need, 'n per group for 80% power', C.yellow]]);
  };
  ctl.querySelectorAll('input, select').forEach((i) => i.addEventListener('input', update));
  update();
  s.appendChild(el('div', { class: 'legend' }, `<span><i style="background:${C.blue}"></i>null world</span><span><i style="background:${C.teal}"></i>real-effect world</span><span><i style="background:${C.red}"></i>α</span><span><i style="background:${C.purple}"></i>β</span>`));
  callout(s, 'Most AI pilots are <b>underpowered</b>: 15 users for two weeks, then “no significant improvement, kill it”. Do this calculation <i>before</i> the pilot, and you’ll know whether a null result means “doesn’t work” or “we couldn’t have told”. Because each banner here is its own coin flip, every person counts towards <b>both</b> comparisons, which doubles your power for free.', 'ai');
}

// ---------------------------------------------------------------------------
// Scene 5: two-way ANOVA, the crossing lines, Tukey HSD
// ---------------------------------------------------------------------------
function anova(root) {
  const s = scene(root, {
    title: 'ANOVA: the lines that cross',
    story: 'Ratings depend on two things: the <b>platform</b> (ServiceNow or AI agent) and whether you saw <b>that platform’s banner</b>. ANOVA splits the variation into pieces each factor explains, plus leftover noise. Each F is <b>signal ÷ noise</b>. If the banners work in opposite directions, the lines <b>cross</b>: that’s an interaction.',
    formula: String.raw`SS_{\text{total}} = SS_{\text{platform}} + SS_{\text{banner}} + SS_{\text{platform}\times\text{banner}} + SS_{\text{error}}, \qquad F = \frac{MS_{\text{effect}}}{MS_{\text{error}}}`,
  });
  const ctl = controls(s, `<label>Outcome <select id="y"><option value="efficiency">Perceived efficiency</option><option value="frustration">Frustration</option></select></label>`);
  const row = s.appendChild(el('div', { class: 'viz-row' }));
  const plotBox = row.appendChild(el('div', { class: 'viz' })), tableBox = row.appendChild(el('div', { class: 'viz' }));
  const tukeyBox = s.appendChild(el('div', { class: 'viz' }));
  let cache = [];
  const label = (r) => (r.primed ? 'Banner' : 'No banner');
  const draw = () => {
    const yk = ctl.querySelector('#y').value, d = cache.filter((r) => Number.isFinite(r[yk]));
    plotBox.innerHTML = ''; tableBox.innerHTML = ''; tukeyBox.innerHTML = '';
    const cells = [LEGACY, AI].flatMap((w) => ['No banner', 'Banner'].map((p) => ({ w, p, v: d.filter((r) => r.workflow === w && label(r) === p).map((r) => r[yk]) })));
    if (cells.some((c) => c.v.length < 2)) return emptyNote(plotBox, 'Need at least two tickets in every platform × banner cell.');
    const f = frame(plotBox, { width: 560, height: 340 });
    const x = d3.scalePoint().domain([LEGACY, AI]).range([70, f.w - 70]), y = d3.scaleLinear().domain([1, 10]).range([f.h, 0]);
    axes(f, d3.scaleLinear().range([0, f.w]), y, { yLabel: `mean ${yk} (±95% CI)`, xTicks: 0 });
    f.g.selectAll('.xl').data([LEGACY, AI]).join('text').attr('class', 'lbl muted').attr('x', (w) => x(w)).attr('y', f.h + 22).attr('text-anchor', 'middle').text((w) => w);
    ['No banner', 'Banner'].forEach((p, k) => {
      const color = k ? C.yellow : C.blue;
      const pts = cells.filter((c) => c.p === p).map((c) => ({ w: c.w, m: mean(c.v), h: 1.96 * Math.sqrt(d3.variance(c.v) / c.v.length) }));
      const dx = (k - 0.5) * 14;
      f.g.append('path').attr('d', d3.line().x((q) => x(q.w) + dx).y((q) => y(q.m))(pts)).attr('stroke', color).attr('stroke-width', 2.5).attr('fill', 'none');
      pts.forEach((q) => {
        f.g.append('line').attr('x1', x(q.w) + dx).attr('x2', x(q.w) + dx).attr('y1', y(q.m - q.h)).attr('y2', y(q.m + q.h)).attr('stroke', color).attr('stroke-width', 1.5);
        f.g.append('circle').attr('cx', x(q.w) + dx).attr('cy', y(q.m)).attr('r', 6).attr('fill', color).attr('stroke', C.surface).attr('stroke-width', 2);
      });
    });
    plotBox.appendChild(el('div', { class: 'legend' }, `<span><i style="background:${C.blue}"></i>No banner</span><span><i style="background:${C.yellow}"></i>Banner (positive for ServiceNow, warning for AI)</span>`));
    let av;
    try { av = twoWayAnova(d.map((r) => r[yk]), d.map((r) => r.workflow), d.map(label)); } catch (e) { return emptyNote(tableBox, `ANOVA couldn’t be fitted: ${e.message}`); }
    const rowHtml = (name, r) => `<tr><td>${name}</td><td class="num">${f2(r.F)}</td><td class="num">${r.df}</td><td class="num">${fmtP(r.p)}</td><td class="num">${f2(r.partialEta2)}</td></tr>`;
    tableBox.innerHTML = `<p class="kicker" style="color:var(--teal)">Two-way ANOVA (Type II)</p>
      <table class="ltable"><tr><th>Term</th><th class="num">F</th><th class="num">df</th><th class="num">p</th><th class="num">partial η²</th></tr>
      ${rowHtml('Platform', av.A)}${rowHtml('Banner', av.B)}${rowHtml('Platform × banner', av.AB)}<tr><td>Residual</td><td></td><td class="num">${av.residual.df}</td><td></td><td></td></tr></table>
      <p style="color:var(--l-muted);font-size:13px;margin-top:10px">Each person contributes six tickets, so rows aren’t independent. The course report fits a mixed model with a random intercept per person as the formal test; this table shows the logic.</p>`;
    const tk = tukeyHSD(cells.map((c) => c.v), cells.map((c) => `${c.w} · ${c.p}`));
    tukeyBox.innerHTML = `<p class="kicker" style="color:var(--teal)">Tukey HSD post hoc: every pair of cells, family-wise α = 0.05</p>
      <table class="ltable"><tr><th>Group A</th><th>Group B</th><th class="num">Mean diff (B − A)</th><th class="num">adj. p</th><th>Different?</th></tr>
      ${tk.map((t) => `<tr><td>${t.a}</td><td>${t.b}</td><td class="num">${f2(t.diff)}</td><td class="num">${fmtP(t.p)}</td><td>${t.reject ? '<b style="color:var(--yellow)">yes</b>' : 'no'}</td></tr>`).join('')}</table>`;
  };
  ctl.querySelector('#y').addEventListener('change', draw);
  onData(({ rows }) => { cache = rows; draw(); });
}

// ---------------------------------------------------------------------------
// Scene 6: chi-square, do warned users overrule the AI more?
// ---------------------------------------------------------------------------
function chiSquare(root) {
  const s = scene(root, {
    title: 'Chi-square: do warned users overrule the AI more?',
    story: 'Counts, not averages. On every AI ticket you either <b>kept</b> the agent’s category or <b>changed</b> it. If the warning made no difference, each cell would hold its <b style="color:var(--blue)">expected</b> count. Chi-square adds up how far the <b style="color:var(--yellow)">observed</b> counts stray from that.',
    formula: String.raw`\chi^2 = \sum_{\text{cells}} \frac{(O-E)^2}{E}, \qquad E_{ij} = \frac{\text{row}_i \times \text{col}_j}{N}`,
  });
  const box = s.appendChild(el('div', { class: 'viz' }));
  const out = el('div'); s.appendChild(out);
  onData(({ rows }) => {
    box.innerHTML = '';
    const d = rows.filter((r) => r.workflow === AI && (r.ai_correct === 0 || r.ai_correct === 1));
    const groups = [['Saw warning', d.filter((r) => r.ai_primed)], ['No warning', d.filter((r) => !r.ai_primed)]];
    if (groups.some(([, g]) => g.length < 3)) return emptyNote(box, 'Need AI-agent tickets from people with and without the warning.');
    const table = groups.map(([, g]) => [g.filter((r) => r.ai_correct === 1).length, g.filter((r) => r.ai_correct === 0).length]);
    const res = chiSquareIndependence(table), N = d3.sum(table.flat()), rowT = table.map((r) => d3.sum(r)), colT = [0, 1].map((j) => d3.sum(table, (r) => r[j]));
    const f = frame(box, { height: 300 });
    const cellsData = groups.flatMap(([name], i) => ['Kept AI category', 'Changed it'].map((lab, j) => ({ name, lab, O: table[i][j], E: (rowT[i] * colT[j]) / N })));
    const x0 = d3.scaleBand().domain(cellsData.map((c) => `${c.name}|${c.lab}`)).range([0, f.w]).padding(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(cellsData, (c) => Math.max(c.O, c.E)) * 1.1]).range([f.h, 0]);
    axes(f, d3.scaleLinear().range([0, f.w]), y, { yLabel: 'tickets', xTicks: 0 });
    const bw = x0.bandwidth() / 2;
    f.g.selectAll('.o').data(cellsData).join('rect').attr('x', (c) => x0(`${c.name}|${c.lab}`)).attr('width', bw - 2).attr('y', f.h).attr('height', 0).attr('fill', C.yellow).attr('rx', 3)
      .transition().duration(700).attr('y', (c) => y(c.O)).attr('height', (c) => f.h - y(c.O));
    f.g.selectAll('.e').data(cellsData).join('rect').attr('x', (c) => x0(`${c.name}|${c.lab}`) + bw).attr('width', bw - 2).attr('y', f.h).attr('height', 0).attr('fill', C.blue).attr('fill-opacity', 0.7).attr('rx', 3)
      .transition().duration(700).delay(200).attr('y', (c) => y(c.E)).attr('height', (c) => f.h - y(c.E));
    f.g.selectAll('.cl').data(cellsData).join('text').attr('class', 'lbl muted').attr('text-anchor', 'middle').attr('x', (c) => x0(`${c.name}|${c.lab}`) + bw).attr('y', f.h + 18).text((c) => `${c.name}: ${c.lab}`);
    box.appendChild(el('div', { class: 'legend' }, `<span><i style="background:${C.yellow}"></i>Observed</span><span><i style="background:${C.blue}"></i>Expected if the warning made no difference</span>`));
    statGrid(out, [[f2(res.chi2), `χ² (df = ${res.df})`], [fmtP(res.p), 'p-value'], [f2(res.cramersV), 'Cramér’s V (effect size)'],
      [pct(table[0][1] / rowT[0]), 'override rate, warned', C.yellow], [pct(table[1][1] / rowT[1]), 'override rate, not warned', C.blue]]);
  });
  callout(s, 'Overrides aren’t free: every unnecessary correction costs time and teaches the model nothing. The same test answers fairness questions too. Swap “saw the warning” for department, region or language, and a chi-square on override counts is a basic <b>AI adoption and fairness audit</b>.', 'ai');
}

// ---------------------------------------------------------------------------
// Scene: statistically significant vs practically meaningful (Ch. 4)
// ---------------------------------------------------------------------------
function practical(root) {
  const s = scene(root, {
    title: 'Significant is not the same as important',
    story: 'Two AI routing models: <b>Model A is 94% accurate, Model B is 93%</b>. Is A better? It depends on how many tickets you tested them on, and on how big a difference would actually matter to the service desk. Slide the test-set size and watch the confidence interval shrink. The p-value answers “is there a difference?”; the interval answers “how big could it be?”',
    formula: String.raw`z = \frac{\hat p_A - \hat p_B}{\sqrt{\hat p(1-\hat p)\left(\frac{1}{n_A}+\frac{1}{n_B}\right)}}`,
  });
  const ctl = controls(s, `
    <label>Test tickets per model <input type="range" id="n" min="2" max="5" step="0.05" value="3"><b id="nv"></b></label>
    <label>Smallest difference that matters <input type="range" id="m" min="0.5" max="5" step="0.5" value="2"><b id="mv"></b></label>`);
  const box = s.appendChild(el('div', { class: 'viz' }));
  const out = el('div'); s.appendChild(out);
  const update = () => {
    const n = Math.round(10 ** +ctl.querySelector('#n').value), m = +ctl.querySelector('#m').value / 100;
    ctl.querySelector('#nv').textContent = n.toLocaleString(); ctl.querySelector('#mv').textContent = `${(m * 100).toFixed(1)} pts`;
    const r = twoProportionZ(Math.round(0.94 * n), n, Math.round(0.93 * n), n);
    box.innerHTML = '';
    const f = frame(box, { height: 200, margin: { top: 30, right: 30, bottom: 44, left: 30 } });
    const x = d3.scaleLinear().domain([-0.06, 0.08]).range([0, f.w]).clamp(true);
    f.g.append('rect').attr('x', x(-m)).attr('width', x(m) - x(-m)).attr('y', 0).attr('height', f.h).attr('fill', C.muted).attr('fill-opacity', 0.18);
    f.g.append('text').attr('class', 'lbl muted').attr('x', x(0)).attr('y', -10).attr('text-anchor', 'middle').text('too small to matter');
    f.g.append('g').attr('class', 'axis').attr('transform', `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(8).tickFormat((v) => `${(v * 100).toFixed(0)} pts`));
    f.g.append('text').attr('class', 'lbl muted').attr('x', f.w / 2).attr('y', f.h + 38).attr('text-anchor', 'middle').text('accuracy difference, Model A − Model B (95% CI)');
    f.g.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', f.h).attr('stroke', C.ink2).attr('stroke-dasharray', '4 4');
    const yy = f.h / 2;
    f.g.append('line').attr('x1', x(r.ci[0])).attr('x2', x(r.ci[1])).attr('y1', yy).attr('y2', yy).attr('stroke', C.yellow).attr('stroke-width', 6).attr('stroke-linecap', 'round');
    f.g.append('circle').attr('cx', x(r.diff)).attr('cy', yy).attr('r', 9).attr('fill', C.yellow).attr('stroke', C.surface).attr('stroke-width', 2);
    const sig = r.p < 0.05, meaningful = r.ci[0] > m, trivial = r.ci[0] > -m && r.ci[1] < m;
    const verdict = sig && meaningful ? 'Significant <b>and</b> big enough to matter.'
      : sig && trivial ? '<b>Statistically significant but practically trivial</b>: the whole interval sits inside “too small to matter”.'
      : sig ? 'Significant, but the interval still includes differences too small to care about.'
      : trivial ? 'Not significant, and we can rule out any difference that matters: the models are <b>practically equivalent</b>.'
      : '<b>Not significant, and inconclusive</b>: the interval still includes differences that would matter. Test on more tickets.';
    statGrid(out, [[`p = ${r.p < 0.001 ? '< 0.001' : r.p.toFixed(3)}`, 'two-proportion z-test', sig ? C.teal : C.muted],
      [`${(r.ci[0] * 100).toFixed(1)} to ${(r.ci[1] * 100).toFixed(1)} pts`, '95% CI for the difference', C.yellow]]);
    out.appendChild(el('div', { class: 'callout' }, verdict));
  };
  ctl.querySelectorAll('input').forEach((i) => i.addEventListener('input', update));
  update();
  callout(s, 'Before choosing between two AI models, also ask: <b>is accuracy even the right metric?</b> (Not if the tickets you care about are rare; see class balancing on page 5.) And if both models were tested on the <i>same</i> tickets, use a paired test such as McNemar’s, which is more powerful than comparing two separate percentages.', 'ai');
}

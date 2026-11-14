// Shared building blocks for the lessons: scenes, KaTeX, chart frames and colours.

import * as d3 from 'd3';
import katex from 'katex';

export const C = {
  blue: '#58c4dd', yellow: '#f4d35e', teal: '#5cd0b3', red: '#fc6255', green: '#83c167', purple: '#b48ce8',
  ink: '#ece9e1', ink2: '#b4b0a6', muted: '#7e7a72', grid: '#2a2e35', surface: '#1b1e23',
};
// Categorical order for series (max 3 per chart): blue, yellow, teal.
export const SERIES = [C.blue, C.yellow, C.teal];

export const fmtP = (p) => (p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`);
export const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '–');
export const pct = (x) => `${Math.round(x * 100)}%`;

export function tex(str, display = false) {
  return katex.renderToString(str, { displayMode: display, throwOnError: false });
}

export function el(tag, attrs = {}, html = '') {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.innerHTML = html;
  return e;
}

export function hero(root, { kicker, title, lede, chapters }) {
  root.appendChild(el('section', { class: 'lesson-hero' }, `
    <p class="kicker">${kicker}</p>
    <h1>${title}</h1>
    <p class="lede">${lede}</p>
    <div class="chapters">${chapters.map((c) => `<span>${c}</span>`).join('')}</div>`));
}

let sceneCounter = 0;
export function scene(root, { title, story = '', formula = '' }) {
  sceneCounter++;
  const s = el('section', { class: 'scene' }, `
    <div class="scene-num">Scene ${root.querySelectorAll('.scene').length + 1}</div>
    <h2>${title}</h2>
    ${story ? `<p class="story">${story}</p>` : ''}
    ${formula ? `<div class="formula">${tex(formula, true)}</div>` : ''}`);
  root.appendChild(s);
  return s;
}

export function callout(parent, html, kind = '') {
  const c = el('div', { class: `callout ${kind}` }, kind === 'ai' ? `<span class="tag">Where AI comes in</span>${html}` : html);
  parent.appendChild(c);
  return c;
}

export function frame(parent, { width = 900, height = 380, margin = { top: 20, right: 24, bottom: 44, left: 56 } } = {}) {
  const box = parent.classList?.contains('viz') ? parent : parent.appendChild(el('div', { class: 'viz' }));
  const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img');
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  return { box, svg, g, w: width - margin.left - margin.right, h: height - margin.top - margin.bottom, margin };
}

export function axes(f, x, y, { xLabel = '', yLabel = '', xTicks = 6, yTicks = 5, xFormat, yFormat } = {}) {
  f.g.append('g').attr('class', 'grid').call(d3.axisLeft(y).ticks(yTicks).tickSize(-f.w).tickFormat(''));
  const xa = f.g.append('g').attr('class', 'axis').attr('transform', `translate(0,${f.h})`).call(d3.axisBottom(x).ticks(xTicks).tickFormat(xFormat || null));
  const ya = f.g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(yTicks).tickFormat(yFormat || null));
  if (xLabel) f.g.append('text').attr('class', 'lbl muted').attr('x', f.w / 2).attr('y', f.h + 38).attr('text-anchor', 'middle').text(xLabel);
  if (yLabel) f.g.append('text').attr('class', 'lbl muted').attr('transform', 'rotate(-90)').attr('x', -f.h / 2).attr('y', -42).attr('text-anchor', 'middle').text(yLabel);
  return { xa, ya };
}

let tipEl = null;
export function tip() {
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); }
  return {
    show(html, ev) { tipEl.innerHTML = html; tipEl.style.opacity = 1; tipEl.style.left = `${ev.clientX + 12}px`; tipEl.style.top = `${ev.clientY + 12}px`; },
    hide() { tipEl.style.opacity = 0; },
  };
}

export function legend(parent, items) {
  parent.appendChild(el('div', { class: 'legend' }, items.map(([label, color]) => `<span><i style="background:${color}"></i>${label}</span>`).join('')));
}

export function controls(parent, html) {
  const c = el('div', { class: 'controls' }, html);
  parent.appendChild(c);
  return c;
}

export function statGrid(parent, items) {
  const g = parent.querySelector(':scope > .stat-grid') || parent.appendChild(el('div', { class: 'stat-grid' }));
  g.innerHTML = items.map(([v, k, color]) => `<div class="stat"><div class="v" style="${color ? `color:${color}` : ''}">${v}</div><div class="k">${k}</div></div>`).join('');
  return g;
}

export const by = (rows, key) => d3.group(rows, (r) => r[key]);
export const num = (rows, key) => rows.map((r) => Number(r[key])).filter(Number.isFinite);

export function emptyNote(box, text = 'Not enough data yet. Switch the data source to include the benchmark, or wait for more tickets.') {
  box.innerHTML = `<div class="empty">${text}</div>`;
}

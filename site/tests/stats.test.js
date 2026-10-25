// Checks the in-browser statistics against SciPy / statsmodels reference values
// (site/tests/reference.json, produced by site/tests/make_reference.py).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as S from '../src/stats/core.js';

const { ref: R, data: D } = JSON.parse(readFileSync(new URL('./reference.json', import.meta.url)));
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);

test('descriptives', () => {
  const d = S.describe(D.b);
  for (const k of ['mean', 'median', 'sd', 'iqr', 'skew']) close(d[k], R.desc[k], 1e-9, k);
});

test('t-tests (Student and Welch, all alternatives)', () => {
  for (const eq of [true, false]) for (const alt of ['two-sided', 'greater', 'less']) {
    const r = S.tTest(D.a, D.b, { equalVar: eq, alternative: alt }), ref = R[`t_${eq ? 'True' : 'False'}_${alt}`];
    close(r.t, ref.t, 1e-9, 't'); close(r.df, ref.df, 1e-9, 'df'); close(r.p, ref.p, 1e-6, `p ${eq} ${alt}`);
    close(r.ci[0], ref.ci[0], 1e-6, 'ci lo'); close(r.ci[1], ref.ci[1], 1e-6, 'ci hi');
  }
});

test('Mann-Whitney U (asymptotic, ties)', () => {
  for (const alt of ['two-sided', 'greater', 'less']) {
    const r = S.mannWhitney(D.ra, D.rb, { alternative: alt });
    close(r.U, R[`mwu_${alt}`].U, 1e-9, 'U'); close(r.p, R[`mwu_${alt}`].p, 1e-6, `p ${alt}`);
  }
});

test('Levene (median-centred)', () => close(S.levene(D.ra, D.rb, D.c).p, R.levene, 1e-6, 'levene p'));

test('Shapiro-Wilk', () => {
  for (const [k, x] of [['sw_a', D.a], ['sw_b', D.b], ['sw_c', D.c], ['sw_small', D.c.slice(0, 8)], ['sw_ra', D.ra]]) {
    const r = S.shapiroWilk(x);
    close(r.W, R[k].W, 1e-4, `${k} W`); close(r.p, R[k].p, 5e-3, `${k} p`);
  }
});

test('one-way ANOVA and Tukey HSD', () => {
  close(S.oneWayAnova(D.ra, D.rb, D.c).p, R.anova1, 1e-6, 'anova p');
  const tk = S.tukeyHSD([D.ra, D.rb, D.c], ['g1', 'g2', 'g3']);
  tk.forEach((row, i) => close(row.p, R.tukey[i], 2e-3, `tukey ${i}`));
});

test('chi-square independence', () => {
  const r = S.chiSquareIndependence(D.tab);
  close(r.chi2, R.chi2.chi2, 1e-9, 'chi2'); close(r.p, R.chi2.p, 1e-6, 'p');
});

test('OLS', () => {
  const r = S.ols(D.x1.map((v, i) => [v, D.x2[i]]), D.y);
  r.beta.forEach((b, i) => close(b, R.ols.beta[i], 1e-8, 'beta'));
  r.se.forEach((s, i) => close(s, R.ols.se[i], 1e-8, 'se'));
  r.p.forEach((p, i) => close(p, R.ols.p[i], 1e-6, 'p'));
  close(r.r2, R.ols.r2, 1e-9, 'r2');
});

test('logistic regression (IRLS)', () => {
  const r = S.logistic(D.x1.map((v, i) => [v, D.x2[i]]), D.yl);
  r.beta.forEach((b, i) => close(b, R.logit.beta[i], 1e-6, 'beta'));
  r.se.forEach((s, i) => close(s, R.logit.se[i], 1e-6, 'se'));
  r.p.forEach((p, i) => close(p, R.logit.p[i], 1e-6, 'p'));
});

test('two-way ANOVA, Type II', () => {
  const r = S.twoWayAnova(D.yy, D.A, D.B);
  [r.A, r.B, r.AB].forEach((row, i) => { close(row.F, R.anova2.F[i], 1e-6, `F ${i}`); close(row.p, R.anova2.p[i], 1e-6, `p ${i}`); });
});

test('power approximation is within 0.02 of statsmodels', () => {
  close(S.powerTwoSample(0.8, 24, 0.05, true), R.power.p24, 0.02, 'power');
  assert.ok(Math.abs(S.nForPower(0.8) - Math.ceil(R.power.n80)) <= 1);
});

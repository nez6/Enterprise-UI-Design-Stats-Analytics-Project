// In-browser statistics for the lessons. Distribution functions come from jStat;
// every test below is checked against SciPy / statsmodels in tests/stats.test.js.

import jStatModule from 'jstat';

export const jStat = jStatModule.jStat || jStatModule;

// ---------------------------------------------------------------------------
// Seeded randomness (so the benchmark class and animations are reproducible)
// ---------------------------------------------------------------------------

export function rng(seed = 42) {
  // mulberry32
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = (mu = 0, sd = 1) => {
    const u = 1 - next(), v = next();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return {
    random: next,
    normal,
    lognormal: (mu, sigma) => Math.exp(normal(mu, sigma)),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted: (arr, w) => {
      let r = next() * w.reduce((s, x) => s + x, 0);
      for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; }
      return arr[arr.length - 1];
    },
    poisson: (lambda) => {
      const L = Math.exp(-lambda); let k = 0, p = 1;
      do { k++; p *= next(); } while (p > L);
      return k - 1;
    },
    shuffle: (arr) => {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; }
      return a2;
    },
  };
}

// ---------------------------------------------------------------------------
// Descriptive statistics
// ---------------------------------------------------------------------------

export const sum = (x) => x.reduce((s, v) => s + v, 0);
export const mean = (x) => sum(x) / x.length;
export const sorted = (x) => Float64Array.from(x).sort();

export function quantile(x, q) {
  // numpy's default (linear interpolation, "type 7")
  const s = sorted(x), h = (s.length - 1) * q, lo = Math.floor(h);
  return lo + 1 < s.length ? s[lo] + (h - lo) * (s[lo + 1] - s[lo]) : s[lo];
}
export const median = (x) => quantile(x, 0.5);
export function variance(x, ddof = 1) {
  const m = mean(x);
  return sum(x.map((v) => (v - m) ** 2)) / (x.length - ddof);
}
export const sd = (x, ddof = 1) => Math.sqrt(variance(x, ddof));
export const iqr = (x) => quantile(x, 0.75) - quantile(x, 0.25);

export function skewness(x) {
  // Adjusted Fisher-Pearson (scipy.stats.skew(bias=False))
  const n = x.length, m = mean(x);
  const m2 = sum(x.map((v) => (v - m) ** 2)) / n, m3 = sum(x.map((v) => (v - m) ** 3)) / n;
  const g1 = m3 / m2 ** 1.5;
  return (Math.sqrt(n * (n - 1)) / (n - 2)) * g1;
}

export function describe(x) {
  return { n: x.length, mean: mean(x), median: median(x), sd: sd(x), iqr: iqr(x),
    skew: x.length > 2 ? skewness(x) : NaN, min: Math.min(...x), max: Math.max(...x) };
}

export function rank(x) {
  // average ranks for ties (1-based)
  const idx = x.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(x.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

// ---------------------------------------------------------------------------
// Distributions
// ---------------------------------------------------------------------------

export const normPdf = (x, mu = 0, s = 1) => jStat.normal.pdf(x, mu, s);
export const normCdf = (x, mu = 0, s = 1) => jStat.normal.cdf(x, mu, s);
export const normInv = (p, mu = 0, s = 1) => jStat.normal.inv(p, mu, s);
export const tPdf = (x, df) => jStat.studentt.pdf(x, df);
export const tCdf = (x, df) => jStat.studentt.cdf(x, df);
export const tInv = (p, df) => jStat.studentt.inv(p, df);
export const fSf = (x, d1, d2) => 1 - jStat.centralF.cdf(x, d1, d2);
export const chi2Sf = (x, df) => 1 - jStat.chisquare.cdf(x, df);
export const betaPdf = (x, a, b) => jStat.beta.pdf(x, a, b);
export const betaInv = (p, a, b) => jStat.beta.inv(p, a, b);

function pFromT(t, df, alternative) {
  if (alternative === 'greater') return 1 - tCdf(t, df);
  if (alternative === 'less') return tCdf(t, df);
  return 2 * (1 - tCdf(Math.abs(t), df));
}
function pFromZ(z, alternative) {
  if (alternative === 'greater') return 1 - normCdf(z);
  if (alternative === 'less') return normCdf(z);
  return 2 * (1 - normCdf(Math.abs(z)));
}

// ---------------------------------------------------------------------------
// Two-sample tests
// ---------------------------------------------------------------------------

export function tTest(a, b, { equalVar = false, alternative = 'two-sided', conf = 0.95 } = {}) {
  const na = a.length, nb = b.length, va = variance(a), vb = variance(b);
  let se, df;
  if (equalVar) {
    const sp2 = ((na - 1) * va + (nb - 1) * vb) / (na + nb - 2);
    se = Math.sqrt(sp2 * (1 / na + 1 / nb)); df = na + nb - 2;
  } else {
    se = Math.sqrt(va / na + vb / nb);
    df = (va / na + vb / nb) ** 2 / ((va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1));
  }
  const diff = mean(a) - mean(b), t = diff / se, crit = tInv(1 - (1 - conf) / 2, df);
  return { t, df, p: pFromT(t, df, alternative), diff, se, ci: [diff - crit * se, diff + crit * se] };
}

export function mannWhitney(a, b, { alternative = 'two-sided' } = {}) {
  // Normal approximation with tie and continuity correction (scipy "asymptotic").
  const n1 = a.length, n2 = b.length, all = a.concat(b), r = rank(all);
  const r1 = sum(r.slice(0, n1)), U = r1 - (n1 * (n1 + 1)) / 2, mu = (n1 * n2) / 2;
  const counts = new Map(); all.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  const tieTerm = sum([...counts.values()].map((t) => t ** 3 - t));
  const N = n1 + n2, sigma = Math.sqrt((n1 * n2 / 12) * ((N + 1) - tieTerm / (N * (N - 1))));
  let z;
  if (alternative === 'greater') z = (U - mu - 0.5) / sigma;
  else if (alternative === 'less') z = (U - mu + 0.5) / sigma;
  else z = (Math.abs(U - mu) - 0.5) / sigma;
  const p = alternative === 'two-sided' ? Math.min(1, 2 * (1 - normCdf(z))) : alternative === 'greater' ? 1 - normCdf(z) : normCdf(z);
  return { U, z, p, rankBiserial: (2 * U) / (n1 * n2) - 1 };
}

export function levene(...groups) {
  // Brown-Forsythe (center = median), scipy's default
  const z = groups.map((g) => { const m = median(g); return g.map((v) => Math.abs(v - m)); });
  return oneWayAnova(...z);
}

export function cohensD(a, b) {
  const na = a.length, nb = b.length;
  const sp = Math.sqrt(((na - 1) * variance(a) + (nb - 1) * variance(b)) / (na + nb - 2));
  return sp > 0 ? (mean(a) - mean(b)) / sp : 0;
}

// Shapiro-Wilk W and p-value (Royston 1992/1995 approximation, as in scipy's swilk).
export function shapiroWilk(xs) {
  const x = Array.from(sorted(xs)), n = x.length;
  if (n < 3) return { W: NaN, p: NaN };
  const m = x.map((_, i) => normInv((i + 1 - 0.375) / (n + 0.25)));
  const mm = sum(m.map((v) => v * v)), u = 1 / Math.sqrt(n);
  const a = new Array(n).fill(0);
  const an = m[n - 1] / Math.sqrt(mm) + 0.221157 * u - 0.147981 * u ** 2 - 2.07119 * u ** 3 + 4.434685 * u ** 4 - 2.706056 * u ** 5;
  if (n === 3) {
    a[0] = -Math.SQRT1_2; a[2] = Math.SQRT1_2;
  } else if (n <= 5) {
    const phi = (mm - 2 * m[n - 1] ** 2) / (1 - 2 * an ** 2);
    for (let i = 1; i < n - 1; i++) a[i] = m[i] / Math.sqrt(phi);
    a[n - 1] = an; a[0] = -an;
  } else {
    const an1 = m[n - 2] / Math.sqrt(mm) + 0.042981 * u - 0.293762 * u ** 2 - 1.752461 * u ** 3 + 5.682633 * u ** 4 - 3.582633 * u ** 5;
    const phi = (mm - 2 * m[n - 1] ** 2 - 2 * m[n - 2] ** 2) / (1 - 2 * an ** 2 - 2 * an1 ** 2);
    for (let i = 2; i < n - 2; i++) a[i] = m[i] / Math.sqrt(phi);
    a[n - 1] = an; a[0] = -an; a[n - 2] = an1; a[1] = -an1;
  }
  const xm = mean(x), ssq = sum(x.map((v) => (v - xm) ** 2));
  if (ssq === 0) return { W: 1, p: 1 };
  const W = Math.min(1, sum(x.map((v, i) => a[i] * v)) ** 2 / ssq);
  let p;
  if (n === 3) {
    p = Math.max(0, (6 / Math.PI) * (Math.asin(Math.sqrt(W)) - Math.asin(Math.sqrt(0.75))));
  } else if (n <= 11) {
    const g = 0.459 * n - 2.273;
    const mu = -0.0006714 * n ** 3 + 0.025054 * n ** 2 - 0.39978 * n + 0.544;
    const s = Math.exp(-0.0020322 * n ** 3 + 0.062767 * n ** 2 - 0.77857 * n + 1.3822);
    p = 1 - normCdf((-Math.log(g - Math.log(1 - W)) - mu) / s);
  } else {
    const ln = Math.log(n);
    const mu = 0.0038915 * ln ** 3 - 0.083751 * ln ** 2 - 0.31082 * ln - 1.5861;
    const s = Math.exp(0.0030302 * ln ** 2 - 0.082676 * ln - 0.4803);
    p = 1 - normCdf((Math.log(1 - W) - mu) / s);
  }
  return { W, p };
}

// ---------------------------------------------------------------------------
// ANOVA, Tukey, chi-square
// ---------------------------------------------------------------------------

export function oneWayAnova(...groups) {
  const all = groups.flat(), gm = mean(all), k = groups.length, N = all.length;
  const ssb = sum(groups.map((g) => g.length * (mean(g) - gm) ** 2));
  const ssw = sum(groups.map((g) => { const m = mean(g); return sum(g.map((v) => (v - m) ** 2)); }));
  const dfb = k - 1, dfw = N - k, F = ssb / dfb / (ssw / dfw);
  return { F, dfb, dfw, p: fSf(F, dfb, dfw), ssb, ssw, eta2: ssb / (ssb + ssw) };
}

export function tukeyHSD(groups, labels) {
  const k = groups.length, N = groups.flat().length, dfw = N - k;
  const msw = sum(groups.map((g) => { const m = mean(g); return sum(g.map((v) => (v - m) ** 2)); })) / dfw;
  const out = [];
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
    const diff = mean(groups[j]) - mean(groups[i]);
    const se = Math.sqrt((msw / 2) * (1 / groups[i].length + 1 / groups[j].length));
    const q = Math.abs(diff) / se;
    const p = Math.min(1, Math.max(0, 1 - jStat.tukey.cdf(q, k, dfw)));
    out.push({ a: labels[i], b: labels[j], diff, p, reject: p < 0.05 });
  }
  return out;
}

export function chiSquareIndependence(table) {
  const rows = table.map((r) => sum(r)), cols = table[0].map((_, j) => sum(table.map((r) => r[j]))), N = sum(rows);
  let chi2 = 0, minExp = Infinity;
  table.forEach((r, i) => r.forEach((o, j) => {
    const e = (rows[i] * cols[j]) / N; minExp = Math.min(minExp, e);
    if (e > 0) chi2 += (o - e) ** 2 / e;
  }));
  const df = (table.length - 1) * (table[0].length - 1);
  return { chi2, df, p: chi2Sf(chi2, df), minExpected: minExp, cramersV: Math.sqrt(chi2 / (N * (Math.min(table.length, table[0].length) - 1))) };
}

export function holm(ps) {
  const order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const adj = new Array(ps.length); let running = 0;
  order.forEach(([p, i], k) => { running = Math.max(running, Math.min(1, (ps.length - k) * p)); adj[i] = running; });
  return adj;
}

// ---------------------------------------------------------------------------
// Linear algebra + regression
// ---------------------------------------------------------------------------

const transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));
const matmul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
function inverse(M) {
  const n = M.length, A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) throw new Error('matrix is singular');
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c]; for (let j = 0; j < 2 * n; j++) A[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[c][j]; }
  }
  return A.map((r) => r.slice(n));
}

export function ols(X, y, names) {
  // X: rows of predictors WITHOUT the intercept column; an intercept is added.
  const Xd = X.map((r) => [1, ...r]), Xt = transpose(Xd), XtXi = inverse(matmul(Xt, Xd));
  const beta = matmul(XtXi, matmul(Xt, y.map((v) => [v]))).map((r) => r[0]);
  const fitted = Xd.map((r) => r.reduce((s, v, i) => s + v * beta[i], 0)), resid = y.map((v, i) => v - fitted[i]);
  const n = y.length, k = beta.length, sse = sum(resid.map((r) => r * r)), ym = mean(y), sst = sum(y.map((v) => (v - ym) ** 2));
  const s2 = sse / (n - k), se = XtXi.map((r, i) => Math.sqrt(s2 * r[i])), t = beta.map((b, i) => b / se[i]);
  return { names: ['Intercept', ...(names || [])], beta, se, t, p: t.map((v) => pFromT(v, n - k, 'two-sided')), fitted, resid, sse, r2: 1 - sse / sst, df: n - k };
}

export function logistic(X, y, names, { maxIter = 50 } = {}) {
  // Iteratively reweighted least squares.
  const Xd = X.map((r) => [1, ...r]), k = Xd[0].length;
  let beta = new Array(k).fill(0), cov;
  for (let it = 0; it < maxIter; it++) {
    const eta = Xd.map((r) => r.reduce((s, v, i) => s + v * beta[i], 0)), p = eta.map((e) => 1 / (1 + Math.exp(-e)));
    const W = p.map((pi) => Math.max(pi * (1 - pi), 1e-10));
    const XtWX = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => sum(Xd.map((r, n) => r[i] * W[n] * r[j]))));
    const grad = Array.from({ length: k }, (_, i) => sum(Xd.map((r, n) => r[i] * (y[n] - p[n]))));
    cov = inverse(XtWX);
    const step = cov.map((r) => sum(r.map((v, j) => v * grad[j])));
    beta = beta.map((b, i) => b + step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }
  const se = cov.map((r, i) => Math.sqrt(r[i])), z = beta.map((b, i) => b / se[i]);
  const predict = (row) => 1 / (1 + Math.exp(-[1, ...row].reduce((s, v, i) => s + v * beta[i], 0)));
  return { names: ['Intercept', ...(names || [])], beta, se, z, p: z.map((v) => pFromZ(v, 'two-sided')), oddsRatio: beta.map(Math.exp), predict };
}

// Two-way ANOVA with Type II sums of squares, by comparing nested OLS fits.
export function twoWayAnova(y, A, B) {
  const la = [...new Set(A)].sort(), lb = [...new Set(B)].sort();
  const dA = (i) => la.slice(1).map((l) => (A[i] === l ? 1 : 0));
  const dB = (i) => lb.slice(1).map((l) => (B[i] === l ? 1 : 0));
  const dAB = (i) => dA(i).flatMap((a) => dB(i).map((b) => a * b));
  const fit = (cols) => ols(y.map((_, i) => cols.flatMap((f) => f(i))), y).sse;
  const sseAB = fit([dA, dB]), sseA = fit([dA]), sseB = fit([dB]), sseFull = fit([dA, dB, dAB]);
  const dfRes = y.length - la.length * lb.length, msRes = sseFull / dfRes;
  const row = (ss, df) => ({ ss, df, F: ss / df / msRes, p: fSf(ss / df / msRes, df, dfRes), partialEta2: ss / (ss + sseFull) });
  return {
    A: row(sseB - sseAB, la.length - 1),
    B: row(sseA - sseAB, lb.length - 1),
    AB: row(sseAB - sseFull, (la.length - 1) * (lb.length - 1)),
    residual: { ss: sseFull, df: dfRes },
  };
}

// ---------------------------------------------------------------------------
// Power (normal approximation to the two-sample t-test)
// ---------------------------------------------------------------------------

export function powerTwoSample(d, nPerGroup, alpha = 0.05, oneSided = true) {
  const df = 2 * nPerGroup - 2, nc = d * Math.sqrt(nPerGroup / 2);
  const crit = tInv(1 - (oneSided ? alpha : alpha / 2), df);
  // Approximate the noncentral t by a shifted t; accurate to ~0.01 for the ranges shown.
  return 1 - tCdf(crit - nc, df) + (oneSided ? 0 : tCdf(-crit - nc, df));
}

export function nForPower(d, power = 0.8, alpha = 0.05, oneSided = true) {
  let n = 2; while (n < 5000 && powerTwoSample(d, n, alpha, oneSided) < power) n++;
  return n;
}

export const softmax = (logits, T = 1) => {
  const z = logits.map((l) => l / Math.max(T, 1e-6)), m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s = sum(e);
  return e.map((v) => v / s);
};

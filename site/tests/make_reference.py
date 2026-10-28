"""Regenerate site/tests/reference.json from SciPy/statsmodels: python site/tests/make_reference.py (run from the repo root)."""
import json, numpy as np, pandas as pd, statsmodels.formula.api as smf
from scipy import stats
from statsmodels.stats.anova import anova_lm
from statsmodels.stats.multicomp import pairwise_tukeyhsd
from statsmodels.stats.power import TTestIndPower
rng = np.random.default_rng(3)
a = np.round(rng.lognormal(1, .5, 23), 1).tolist(); b = np.round(rng.lognormal(1.3, .6, 31), 1).tolist()
ra = rng.integers(1, 8, 25).tolist(); rb = rng.integers(2, 10, 28).tolist()
c = rng.normal(5, 2, 20).round(2).tolist()
R = {}
R["desc"] = dict(mean=np.mean(b), median=np.median(b), sd=np.std(b, ddof=1), iqr=float(np.subtract(*np.percentile(b,[75,25]))), skew=stats.skew(b, bias=False))
for eq in (True, False):
    for alt in ("two-sided","greater","less"):
        r = stats.ttest_ind(a,b,equal_var=eq,alternative=alt); ci = stats.ttest_ind(a,b,equal_var=eq).confidence_interval()
        R[f"t_{eq}_{alt}"] = dict(t=r.statistic, p=r.pvalue, df=r.df, ci=[ci.low, ci.high])
for alt in ("two-sided","greater","less"):
    r = stats.mannwhitneyu(ra, rb, alternative=alt, method="asymptotic"); R[f"mwu_{alt}"] = dict(U=r.statistic, p=r.pvalue)
R["levene"] = stats.levene(ra, rb, c).pvalue
for name, x in [("sw_a", a), ("sw_b", b), ("sw_c", c), ("sw_small", c[:8]), ("sw_ra", ra)]:
    r = stats.shapiro(x); R[name] = dict(W=r.statistic, p=r.pvalue)
R["anova1"] = stats.f_oneway(ra, rb, c).pvalue
tk = pairwise_tukeyhsd(np.r_[ra, rb, c], ["g1"]*len(ra)+["g2"]*len(rb)+["g3"]*len(c))
R["tukey"] = [float(x) for x in tk.pvalues]
tab = [[12, 5, 9], [4, 11, 7]]; r = stats.chi2_contingency(tab, correction=False); R["chi2"] = dict(chi2=r.statistic, p=r.pvalue)
n = 80; x1 = rng.normal(0,1,n); x2 = rng.integers(0,2,n); y = 1 + 2*x1 - x2 + rng.normal(0,1,n)
d = pd.DataFrame(dict(y=y, x1=x1, x2=x2)); m = smf.ols("y ~ x1 + x2", d).fit()
R["ols"] = dict(beta=m.params.tolist(), se=m.bse.tolist(), p=m.pvalues.tolist(), r2=m.rsquared)
yl = (rng.random(n) < 1/(1+np.exp(-(-0.5 + 1.2*x1 + 0.8*x2)))).astype(int); d["yl"] = yl
lm = smf.logit("yl ~ x1 + x2", d).fit(disp=0); R["logit"] = dict(beta=lm.params.tolist(), se=lm.bse.tolist(), p=lm.pvalues.tolist())
A = rng.choice(["p","q"], 90); B = rng.choice(["u","v","w"], 90); yy = rng.normal(0,1,90) + (A=="q")*0.8 + (B=="w")*0.5 + ((A=="q")&(B=="v"))*1.0
dd = pd.DataFrame(dict(y=yy, A=A, B=B)); av = anova_lm(smf.ols("y ~ C(A)*C(B)", dd).fit(), typ=2)
R["anova2"] = dict(F=av["F"].tolist()[:3], p=av["PR(>F)"].tolist()[:3])
R["power"] = dict(p24=TTestIndPower().power(0.8, 24, 0.05, alternative="larger"), n80=TTestIndPower().solve_power(0.8, power=.8, alpha=.05, alternative="larger"))
data = dict(a=a, b=b, ra=ra, rb=rb, c=c, tab=tab, x1=x1.tolist(), x2=x2.tolist(), y=y.tolist(), yl=yl.tolist(), A=A.tolist(), B=B.tolist(), yy=yy.tolist())
json.dump(dict(ref=R, data=data), open("site/tests/reference.json", "w"), default=float)
print("ok")

# --- syllabus-gap additions -------------------------------------------------
R2 = {}
dd = (rng.normal(0.3, 1, 40)).round(1)
for alt in ("two-sided", "greater", "less"):
    r = stats.wilcoxon(dd, alternative=alt, method="approx", correction=False)
    R2[f"wil_{alt}"] = dict(W=float(r.statistic), p=float(r.pvalue))
from statsmodels.stats.proportion import proportions_ztest
z, p = proportions_ztest([940, 930], [1000, 1000]); R2["prop"] = dict(z=float(z), p=float(p))
sc = rng.random(60).round(2); lab = (rng.random(60) < sc).astype(int)
from sklearn.metrics import roc_auc_score  # noqa: E402  (installed only for this check)
R2["auc"] = float(roc_auc_score(lab, sc))
R2["binom"] = float(stats.binom.pmf(7, 10, 0.8)); R2["pois"] = float(stats.poisson.pmf(3, 2.5))
ref = json.load(open("site/tests/reference.json")); ref["ref"].update(R2); ref["data"].update(dict(dd=dd.tolist(), sc=sc.tolist(), lab=lab.tolist()))
json.dump(ref, open("site/tests/reference.json", "w"), default=float)
print("added gap references")

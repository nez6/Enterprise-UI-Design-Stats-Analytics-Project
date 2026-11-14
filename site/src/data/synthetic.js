// Seeded benchmark "class" so every lesson has data before anyone files a ticket.
// The same data-generating process lives in lab/simulate.py for the Python course pipeline.
//
// Built-in effects (what the lessons can find):
//   * The three ServiceNow tickets take the same effort (~2 minutes, long right tail);
//     AI-agent tickets are ~3-4x faster.
//   * Positive banner raises ServiceNow efficiency ratings.
//   * The AI team (warned + shown confidence + always-right agent) rates the AI lower because
//     of the warning, and second-guesses it more.
//   * The other team's agent gets the AV ticket wrong; ~1 in 4 catch it, the rest get the
//     angry email, which spikes frustration on that ticket.
//   * Seniors are the most suggestible; experience vs ratings shows a Simpson's paradox.

import { AI, AI_ERROR_TESTS, CATEGORIES, JOB_LEVELS, JOB_ROLES, LEGACY, TESTS } from './design.js';
import { rng } from '../stats/core.js';

const PHRASES = {
  1: ['locked out of expense system', 'password reset needed asap', 'cant log in, account locked', 'expense login locked after too many tries', 'pw locked again??'],
  2: ['need tableau licence', 'pls install tableau for dashboard', 'software request: tableau desktop', 'licence for tableau by monday', 'tableau access for board deck'],
  3: ['boardroom screen not working', 'mics dead in boardroom', 'av broken for board call', 'boardroom display no signal', 'room screen + mic down'],
  4: ['mfa codes not arriving new phone', 'cant sign in, 2fa broken', 'two factor not working after phone change', 'locked out of email mfa', 'need mfa reset'],
  5: ['install figma pls', 'need figma for design review', 'software install figma', 'figma access today', 'can you install figma'],
  6: ['room 3a camera offline', 'meeting room camera not working', 'zoom room camera down 3a', 'camera dead in 3A client call', 'video in room 3a broken'],
};
const NOISE = ['', '', ' !!', ' asap', ' (again)', ' plz help', ' urgent', ' ...', ' thx'];

function typo(text, r) {
  if (r.random() > 0.3 || text.length < 6) return text;
  const i = r.int(1, text.length - 2);
  return text.slice(0, i) + text[i + 1] + text[i] + text.slice(i + 2);
}

export function simulateClass(n = 300, seed = 42, { session = 'benchmark' } = {}) {
  const r = rng(seed);
  const L = JOB_LEVELS;
  const levelMeanYears = { [L[0]]: 3.5, [L[1]]: 9.5, [L[2]]: 17.5 };
  const levelEff = { [L[0]]: -1.0, [L[1]]: 0, [L[2]]: 1.5 };
  const sus = { [L[0]]: 0.6, [L[1]]: 1.0, [L[2]]: 1.6 };           // how far banners move ratings
  const yearRange = { [L[0]]: [0, 7], [L[1]]: [4, 15], [L[2]]: [10, 25] };
  const baseTime = { 1: 105, 2: 115, 3: 120, 4: 28, 5: 32, 6: 36 };
  const timeSigma = { 1: 0.45, 2: 0.45, 3: 0.45, 4: 0.3, 5: 0.3, 6: 0.3 };
  const baseFrust = { 1: 5.0, 2: 5.2, 3: 5.4, 4: 2.6, 5: 2.5, 6: 2.8 };
  const baseEff = { 1: 4.1, 2: 3.9, 3: 3.8, 4: 7.4, 5: 7.6, 6: 7.2 };
  const baseErr = { 1: 1.0, 2: 1.1, 3: 1.2, 4: 0.1, 5: 0.1, 6: 0.1 };
  const rows = [], feedback = [];
  // Manipulation-check answers: most people who saw a banner say so; a few misremember.
  const mc = (saw) => { const u = r.random(); return saw ? (u < 0.85 ? 'yes' : u < 0.95 ? 'unsure' : 'no') : (u < 0.8 ? 'no' : u < 0.95 ? 'unsure' : 'yes'); };

  for (let i = 0; i < n; i++) {
    const lvl = r.weighted(L, [0.5, 0.32, 0.18]), [lo, hi] = yearRange[lvl], yrs = r.int(lo, hi);
    const role = r.weighted(JOB_ROLES, [0.35, 0.35, 0.2, 0.1]);
    const snowPrimed = r.random() < 0.5 ? 1 : 0, aiPrimed = r.random() < 0.5 ? 1 : 0;
    const aiFirst = r.random() < 0.5, setOrder = aiFirst ? 'ai_first' : 'legacy_first';
    const order = aiFirst ? [4, 5, 6, 1, 2, 3] : [1, 2, 3, 4, 5, 6];
    const speed = r.lognormal(0, 0.18), pid = `BENCH-${String(i).padStart(3, '0')}`;
    const effSum = { [LEGACY]: 0, [AI]: 0 };
    let aiRight = 0, burned = 0;

    order.forEach((t, k) => {
      const meta = TESTS[t], ai = meta.workflow === AI, primed = ai ? aiPrimed : snowPrimed;
      let ct = baseTime[t] * speed * (k >= 3 ? 0.9 : 1) * r.lognormal(0, timeSigma[t]) * (1 - 0.006 * yrs);
      let errors = r.poisson(baseErr[t]);
      const text = typo(r.pick(PHRASES[t]), r) + r.pick(NOISE);

      let aiCat = null, aiConf = null, aiCorrect = null, injected = null, caught = null, email = 0;
      if (ai) {
        aiCat = meta.category; aiConf = Math.round((0.88 + r.random() * 0.09) * 100) / 100;
        // The warned team sometimes "corrects" an agent that was right.
        aiCorrect = aiPrimed && r.random() < 0.12 ? 0 : 1;
        if (!aiCorrect) { errors += 1; ct += 10 * r.lognormal(0, 0.3); }
        injected = !aiPrimed && AI_ERROR_TESTS.includes(t) ? 1 : 0;
        if (injected) {
          caught = r.random() < 0.25 ? 1 : 0;
          if (caught) { errors += 1; ct += 20 * r.lognormal(0, 0.3); } else { email = 1; burned = 1; }
        }
        aiRight += aiCorrect;
      }
      const logit = -4.6 + (ai ? -0.6 : 0.6) - 0.05 * yrs;
      const quit = r.random() < 1 / (1 + Math.exp(-logit)) ? 1 : 0;
      if (quit) ct *= 0.4 + 0.5 * r.random();

      const shift = primed * sus[lvl] * (ai ? -1.3 : 1.0);           // positive vs negative banner
      const frust = baseFrust[t] + 0.003 * (ct - baseTime[t]) + 1.5 * quit + 0.3 * errors - 0.5 * shift + 3 * email + r.normal(0, 1);
      const eff = baseEff[t] + levelEff[lvl] - 0.1 * (yrs - levelMeanYears[lvl]) + shift - quit - 2.5 * email + r.normal(0, 1);
      const effR = Math.min(10, Math.max(1, Math.round(eff)));
      effSum[meta.workflow] += effR;

      rows.push({
        participant_id: pid, source: 'benchmark', submitted_at: null, session_label: session,
        years_experience: yrs, job_level: lvl, job_role: role,
        snow_primed: snowPrimed, ai_primed: aiPrimed, set_order: setOrder,
        test_num: t, position: k + 1, test_name: meta.name, ticket_type: meta.type, workflow: meta.workflow, primed,
        completion_time: Math.round(ct * 10) / 10, error_count: errors, rage_quit: quit,
        frustration: Math.min(10, Math.max(1, Math.round(frust))), efficiency: effR,
        ticket_text: text, chosen_category: quit ? null : meta.category, ai_category: aiCat, ai_confidence: aiConf,
        ai_correct: quit ? null : aiCorrect, ai_error_injected: injected, ai_error_caught: quit ? null : caught,
      });
    });
    const nps = Math.min(10, Math.max(0, Math.round(effSum[LEGACY] / 3 + snowPrimed * sus[lvl] * 0.8 + r.normal(0, 1.8))));
    const trust = Math.min(10, Math.max(1, Math.round(3 + 1.8 * aiRight - aiPrimed * sus[lvl] * 1.2 - 2.5 * burned + r.normal(0, 1.2))));
    // Preference follows the rating gap, so warnings and the angry email both pull people away from the AI.
    const preferAI = 0.35 * (effSum[AI] - effSum[LEGACY]) / 3 - 0.8 + r.normal(0, 1) > 0 ? 1 : 0;
    feedback.push({ participant_id: pid, session_label: session, snow_primed: snowPrimed, ai_primed: aiPrimed, job_level: lvl,
      nps_servicenow: nps, ai_trust: trust, prefer_ai: preferAI, mc_snow: mc(snowPrimed), mc_ai: mc(aiPrimed), comment: null });
  }
  return { rows, feedback };
}

export { CATEGORIES };

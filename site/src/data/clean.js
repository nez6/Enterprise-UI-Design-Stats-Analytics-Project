// The site's copy of the cleaning rules in scripts/clean_data.py, so the Data page and the lessons
// count the same people as the analysis pipeline. Rule 1 (withdrawals) already happened: the
// public views and loadLive() leave those people out.

import { AI, LEGACY, TESTS } from './design.js';

export const WALKAWAY_SECONDS = 30 * 60;

const between = (x, lo, hi) => Number.isFinite(x) && x >= lo && x <= hi;
const isValid = (r) => TESTS[r.test_num] && between(r.frustration, 1, 10) && between(r.efficiency, 1, 10)
  && r.completion_time > 0 && r.error_count >= 0 && [0, 1].includes(r.rage_quit)
  && [0, 1].includes(r.snow_primed) && [0, 1].includes(r.ai_primed);

// Returns the kept rows and surveys, the row and participant count after each rule, and why each
// excluded participant was dropped (participant_id -> reason).
export function cleanStudyData(rawRows, rawFeedback = []) {
  const people = (rows) => new Set(rows.map((r) => r.participant_id)).size;
  const funnel = [{ rule: 'Everyone who filed a ticket (withdrawals already removed)', rows: rawRows.length, participants: people(rawRows) }];
  const reasons = new Map();
  const step = (rule, rows) => { funnel.push({ rule, rows: rows.length, participants: people(rows) }); return rows; };
  const dropPeople = (rows, ids, reason) => {
    ids.forEach((id) => { if (!reasons.has(id)) reasons.set(id, reason); });
    return rows.filter((r) => !ids.has(r.participant_id));
  };

  const seen = new Set();
  let rows = step('Double-submitted tickets removed', rawRows.filter((r) => {
    const key = `${r.participant_id}|${r.test_num}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
  rows = step('Impossible values removed', rows.filter(isValid));

  // Design columns are re-derived so a mislabelled or inserted row can't change a condition.
  rows = rows.map((r) => {
    const t = TESTS[r.test_num];
    return { ...r, test_name: t.name, workflow: t.workflow, ticket_type: t.type, primed: t.workflow === AI ? r.ai_primed : r.snow_primed };
  });

  const arms = new Map();
  rows.forEach((r) => {
    const arm = `${r.snow_primed}${r.ai_primed}`;
    if (!arms.has(r.participant_id)) arms.set(r.participant_id, arm);
    else if (arms.get(r.participant_id) !== arm) arms.set(r.participant_id, null);
  });
  const mixed = new Set([...arms].filter(([, a]) => a === null).map(([id]) => id));
  rows = step('Inconsistent banner assignment removed', dropPeople(rows, mixed, 'Inconsistent banner assignment'));

  const walked = new Set(rows.filter((r) => r.completion_time > WALKAWAY_SECONDS).map((r) => r.participant_id));
  rows = step('Walked away (any ticket over 30 minutes)', dropPeople(rows, walked, 'Walked away (ticket over 30 min)'));

  const counts = new Map();
  rows.forEach((r) => counts.set(r.participant_id, (counts.get(r.participant_id) || 0) + 1));
  const total = Object.keys(TESTS).length;
  const partial = new Set([...counts].filter(([, n]) => n < total).map(([id]) => id));
  rows = step('Did not finish all six tickets', dropPeople(rows, partial, 'Did not finish all six tickets'));

  const kept = new Set(rows.map((r) => r.participant_id));
  const surveyed = new Set();
  const feedback = rawFeedback.filter((f) => {
    if (!kept.has(f.participant_id) || surveyed.has(f.participant_id)) return false;
    surveyed.add(f.participant_id);
    return true;
  });
  return { rows, feedback, funnel, reasons };
}

// One row per person: the unit of analysis for H1, H2 and the paired platform comparison.
export function perPerson(rows) {
  const byId = new Map();
  rows.forEach((r) => { if (!byId.has(r.participant_id)) byId.set(r.participant_id, []); byId.get(r.participant_id).push(r); });
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const geo = (xs) => Math.exp(avg(xs.map(Math.log)));
  return [...byId.values()].map((rs) => {
    const sn = rs.filter((r) => r.workflow === LEGACY), ai = rs.filter((r) => r.workflow === AI);
    return {
      snow_primed: rs[0].snow_primed, ai_primed: rs[0].ai_primed,
      sn_eff: avg(sn.map((r) => r.efficiency)), ai_eff: avg(ai.map((r) => r.efficiency)),
      sn_frust: avg(sn.map((r) => r.frustration)), ai_frust: avg(ai.map((r) => r.frustration)),
      sn_time: geo(sn.map((r) => r.completion_time)), ai_time: geo(ai.map((r) => r.completion_time)),
    };
  });
}

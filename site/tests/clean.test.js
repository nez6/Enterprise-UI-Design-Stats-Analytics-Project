import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanStudyData, perPerson } from '../src/data/clean.js';

const ticket = (id, n, over = {}) => ({
  participant_id: id, test_num: n, completion_time: 60, error_count: 0, rage_quit: 0,
  frustration: 5, efficiency: 5, snow_primed: 0, ai_primed: 0, ...over,
});
const person = (id, over) => [1, 2, 3, 4, 5, 6].map((n) => ticket(id, n, over));

test('keeps a person with six valid tickets and their survey', () => {
  const { rows, feedback, reasons } = cleanStudyData(person('A'), [{ participant_id: 'A' }, { participant_id: 'A' }, { participant_id: 'Z' }]);
  assert.equal(rows.length, 6);
  assert.equal(feedback.length, 1);
  assert.equal(reasons.size, 0);
});

test('drops everyone with a ticket over 30 minutes, but not one at exactly 30', () => {
  const walked = person('A').map((r) => (r.test_num === 3 ? { ...r, completion_time: 1801 } : r));
  const edge = person('B').map((r) => (r.test_num === 3 ? { ...r, completion_time: 1800 } : r));
  const { rows, reasons } = cleanStudyData([...walked, ...edge]);
  assert.deepEqual([...new Set(rows.map((r) => r.participant_id))], ['B']);
  assert.match(reasons.get('A'), /Walked away/);
});

test('drops people with fewer than six tickets, after removing duplicates and impossible values', () => {
  const dup = [...person('A'), ticket('A', 1)];
  const bad = person('B').map((r) => (r.test_num === 6 ? { ...r, efficiency: 11 } : r));
  const { rows, reasons, funnel } = cleanStudyData([...dup, ...bad]);
  assert.equal(rows.length, 6);
  assert.match(reasons.get('B'), /six tickets/);
  assert.deepEqual(funnel.map((f) => f.rows), [13, 12, 11, 11, 11, 6]);
});

test('re-derives conditions from the ticket number, and drops mixed banner assignment', () => {
  const lying = person('A', { snow_primed: 1 }).map((r) => ({ ...r, workflow: 'ServiceNow', test_name: '<img>' }));
  const mixed = person('B').map((r) => (r.test_num === 2 ? { ...r, ai_primed: 1 } : r));
  const { rows, reasons } = cleanStudyData([...lying, ...mixed]);
  assert.equal(rows.find((r) => r.test_num === 4).workflow, 'AI Agent');
  assert.equal(rows.find((r) => r.test_num === 4).primed, 0);
  assert.equal(rows.find((r) => r.test_num === 1).primed, 1);
  assert.ok(!rows.some((r) => r.test_name === '<img>'));
  assert.match(reasons.get('B'), /banner/);
});

test('perPerson gives each platform its own means and geometric mean time', () => {
  const rows = cleanStudyData(person('A').map((r) => ({ ...r, efficiency: r.test_num <= 3 ? 2 : 8, completion_time: r.test_num <= 3 ? 100 : 25 }))).rows;
  const [p] = perPerson(rows);
  assert.equal(p.sn_eff, 2);
  assert.equal(p.ai_eff, 8);
  assert.ok(Math.abs(p.sn_time - 100) < 1e-9);
  assert.ok(Math.abs(p.ai_time - 25) < 1e-9);
});

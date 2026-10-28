// Where tickets and feedback go. There is ONE study data store: the Supabase database.
//
// * Supabase mode (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set at build time): every
//   participant inserts into the shared tables. The public key can only INSERT into the raw
//   tables; the lessons read de-identified views that leave out free text, and re-poll every
//   few seconds so the charts update live during a session.
// * Demo mode (no keys): data stays in this browser (localStorage) and is NOT study data.
//   The portal says so on screen, so a facilitator can't mistake a demo for a live session.

import { createClient } from '@supabase/supabase-js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = URL_ && KEY ? createClient(URL_, KEY) : null;

export const MODE = supabase ? 'supabase' : 'demo';

const LS = { rows: 'snowlab.submissions', fb: 'snowlab.feedback', wd: 'snowlab.withdrawals' };
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('snowlab') : null;
const listeners = new Set();

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}
const notify = (evt) => listeners.forEach((fn) => fn(evt));
channel?.addEventListener('message', (e) => notify(e.data));

// Remove obvious personal identifiers from free text before it leaves the browser.
export function scrub(text) {
  return String(text || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[number]')
    .replace(/\b\d{6,}\b/g, '[number]');
}

async function insert(table, row, localKey) {
  if (supabase) {
    const { error } = await supabase.from(table).insert(row);
    if (error) throw new Error(error.message);
  } else {
    writeLocal(localKey, [...readLocal(localKey), row]);
    channel?.postMessage({ type: table });
  }
  notify({ type: table });
}

export const addSubmission = (row) => insert('submissions', { ...row, ticket_text: scrub(row.ticket_text) }, LS.rows);
export const addFeedback = (row) => insert('feedback', { ...row, comment: row.comment ? scrub(row.comment) : null }, LS.fb);
export const addWithdrawal = (participantId, sessionLabel) => insert('withdrawals', { participant_id: participantId, session_label: sessionLabel }, LS.wd);

async function selectAll(view, session) {
  // Supabase caps a select at 1000 rows by default, so page through.
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(view).select('*').range(from, from + 999);
    if (session) q = q.eq('session_label', session);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

export async function loadLive(session) {
  let rows, feedback, withdrawn;
  if (supabase) {
    [rows, feedback, withdrawn] = await Promise.all([
      selectAll('submissions_public', session), selectAll('feedback_public', session), selectAll('withdrawals_public', session),
    ]);
  } else {
    const f = (r) => !session || r.session_label === session;
    [rows, feedback, withdrawn] = [readLocal(LS.rows).filter(f), readLocal(LS.fb).filter(f), readLocal(LS.wd).filter(f)];
  }
  // Withdrawn participants disappear from every chart immediately.
  const gone = new Set(withdrawn.map((w) => w.participant_id));
  return { rows: rows.filter((r) => !gone.has(r.participant_id)), feedback: feedback.filter((r) => !gone.has(r.participant_id)) };
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The public key can't read the raw tables, so it can't receive realtime events: poll instead.
// Polling only runs while someone is looking at a lesson with live data selected (in practice,
// the presenter). With ~100 people filing tickets, polling everyone would download the whole
// dataset thousands of times and could exhaust the free plan's bandwidth.
let poll = null;
export function setPolling(on, ms = 10000) {
  if (!supabase) return;
  if (on && !poll) poll = setInterval(() => notify({ type: 'poll' }), ms);
  if (!on && poll) { clearInterval(poll); poll = null; }
}

export function clearLocal() {
  writeLocal(LS.rows, []); writeLocal(LS.fb, []); writeLocal(LS.wd, []);
  channel?.postMessage({ type: 'cleared' }); notify({ type: 'cleared' });
}

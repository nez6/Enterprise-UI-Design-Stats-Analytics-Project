// Where tickets and feedback go.
//
// * Supabase mode (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set at build time): every
//   participant writes to one shared database, and the lessons subscribe to inserts so the
//   charts redraw live during a call.
// * Demo mode (no keys): data stays in this browser (localStorage), and other tabs of the same
//   browser update live via BroadcastChannel. Handy for rehearsing.

import { createClient } from '@supabase/supabase-js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = URL_ && KEY ? createClient(URL_, KEY) : null;

export const MODE = supabase ? 'supabase' : 'demo';

const LS = { rows: 'snowlab.submissions', fb: 'snowlab.feedback' };
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

export async function addSubmission(row) {
  if (supabase) {
    const { error } = await supabase.from('submissions').insert(row);
    if (error) throw new Error(error.message);
  } else {
    writeLocal(LS.rows, [...readLocal(LS.rows), row]);
    channel?.postMessage({ type: 'submission' });
  }
  notify({ type: 'submission' });
}

export async function addFeedback(row) {
  if (supabase) {
    const { error } = await supabase.from('feedback').insert(row);
    if (error) throw new Error(error.message);
  } else {
    writeLocal(LS.fb, [...readLocal(LS.fb), row]);
    channel?.postMessage({ type: 'feedback' });
  }
  notify({ type: 'feedback' });
}

async function selectAll(table, session) {
  // Supabase caps a select at 1000 rows by default, so page through.
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select('*').order('id').range(from, from + 999);
    if (session) q = q.eq('session_label', session);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

export async function loadLive(session) {
  if (supabase) {
    const [rows, feedback] = await Promise.all([selectAll('submissions', session), selectAll('feedback', session)]);
    return { rows, feedback };
  }
  const f = (r) => !session || r.session_label === session;
  return { rows: readLocal(LS.rows).filter(f), feedback: readLocal(LS.fb).filter(f) };
}

export async function listSessions() {
  if (supabase) {
    const { data, error } = await supabase.from('session_counts').select('*');
    if (error) return [];
    return data.map((d) => d.session_label);
  }
  return [...new Set(readLocal(LS.rows).map((r) => r.session_label))];
}

let realtime = null;
export function subscribe(fn) {
  listeners.add(fn);
  if (supabase && !realtime) {
    realtime = supabase.channel('snowlab-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'submissions' }, () => notify({ type: 'submission' }))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feedback' }, () => notify({ type: 'feedback' }))
      .subscribe();
  }
  return () => listeners.delete(fn);
}

export function clearLocal() {
  writeLocal(LS.rows, []); writeLocal(LS.fb, []);
  channel?.postMessage({ type: 'cleared' }); notify({ type: 'cleared' });
}

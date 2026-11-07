// The dataset every lesson reads: the live class, the seeded benchmark, or both.
// Lessons call onData(render); render is called now and again whenever new tickets arrive.

import { MODE, loadLive, setPolling, subscribe } from './store.js';
import { simulateClass } from './synthetic.js';
import { cleanStudyData } from './clean.js';

const params = new URLSearchParams(location.search);
export const SESSION = params.get('session') || 'pathfinders';
// The finished session shown on the Data page and offered as a lesson data source. It is read-only
// here: new tickets still go to SESSION, so a new session can't mix into this one.
export const ARCHIVE_SESSION = 'pathfinders-oct28';

const bench = simulateClass(300, 42);
const state = { source: localStorage.getItem('snowlab.source') || 'benchmark', live: { rows: [], feedback: [] }, archive: { rows: [], feedback: [] }, loading: false };
const renderers = new Set();

export const SOURCES = {
  live: 'Live class',
  archive: 'Oct 28 class (cleaned)',
  benchmark: 'Benchmark (300 simulated)',
  both: 'Live + benchmark',
};

let archive = null;
export function loadArchive() {
  archive ||= loadLive(ARCHIVE_SESSION).then(({ rows, feedback }) => ({ raw: rows, clean: cleanStudyData(rows, feedback) }))
    .catch((err) => { archive = null; throw err; });
  return archive;
}

export function current() {
  if (state.source === 'archive') return state.archive;
  if (state.source === 'live') return state.live;
  if (state.source === 'both') return { rows: [...bench.rows, ...state.live.rows], feedback: [...bench.feedback, ...state.live.feedback] };
  return bench;
}

export const source = () => state.source;
export const liveCount = () => new Set(state.live.rows.map((r) => r.participant_id)).size;

let lessonActive = false;
// A finished session doesn't change, so only the live sources poll.
const updatePolling = () => setPolling(lessonActive && (state.source === 'live' || state.source === 'both'));
export function setLessonActive(on) { lessonActive = on; updatePolling(); if (on && state.source !== 'benchmark') refresh(); }

export function setSource(s) {
  state.source = s;
  updatePolling();
  if (s !== 'benchmark') refresh();
  try { localStorage.setItem('snowlab.source', s); } catch { /* ignore */ }
  emit();
}

function emit() {
  const data = current();
  renderers.forEach((fn) => fn(data));
  document.dispatchEvent(new CustomEvent('snowlab:data', { detail: { live: liveCount(), source: state.source } }));
}

export async function refresh() {
  // In live mode, only download the class data when someone is viewing it in a lesson.
  if (MODE === 'supabase' && !(lessonActive && state.source !== 'benchmark')) return;
  state.loading = true;
  try {
    if (state.source === 'archive') state.archive = (await loadArchive()).clean;
    else state.live = await loadLive(SESSION);
  } catch (e) { console.warn('Live data unavailable:', e.message); }
  state.loading = false;
  emit();
}

let timer = null;
subscribe(() => { clearTimeout(timer); timer = setTimeout(refresh, 400); });

export function onData(fn) {
  renderers.add(fn);
  fn(current());
  return () => renderers.delete(fn);
}

export function clearRenderers() { renderers.clear(); }

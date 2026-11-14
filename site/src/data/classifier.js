// The portal's "Virtual Agent": a multinomial naive Bayes classifier.
// It is deliberately simple so Lesson 2 can open it up and show Bayes' theorem doing the work:
//   P(category | words) ∝ P(category) × Π P(word | category)

import { CATEGORIES } from './design.js';
import { softmax } from '../stats/core.js';

const SEED_TICKETS = {
  'Access & Passwords': [
    'locked out of my account after too many attempts', 'need a password reset for the expense system',
    'forgot my password cannot log in', 'account locked mfa not working', 'reset login credentials for sso',
    'cannot sign in password expired', 'two factor code never arrives locked out', 'access denied to workday login',
    'my password stopped working this morning', 'unlock my account please',
  ],
  Software: [
    'need a tableau licence for dashboards', 'install adobe creative cloud', 'request software license for figma',
    'excel keeps crashing when i open macros', 'need access to jetbrains ide', 'app will not install permission error',
    'licence expired for visio', 'please install python and vs code', 'request new software subscription',
    'outlook add in missing after update',
  ],
  'Network & VPN': [
    'vpn keeps dropping when working from home', 'cannot connect to vpn', 'wifi in the office is very slow',
    'vpn disconnects every few minutes', 'network drive not reachable', 'internet connection unstable on calls',
    'cannot reach internal sites without vpn', 'wifi password for guest network', 'vpn client error 809',
    'remote access tunnel keeps failing',
  ],
  Hardware: [
    'laptop battery swelled and trackpad broken', 'need a replacement laptop', 'monitor flickering and dead pixels',
    'keyboard keys stuck', 'laptop overheating and shutting down', 'request a second monitor and dock',
    'mouse not working', 'screen cracked on my laptop', 'headset microphone broken', 'docking station not charging',
  ],
  'Facilities & AV': [
    'boardroom screen and microphones not working', 'conference room projector will not turn on',
    'zoom room camera offline', 'meeting room speakers crackling', 'need av setup for the board call',
    'room display shows no signal', 'hdmi cable missing in meeting room', 'video conference audio echo in room',
    'book av technician for town hall', 'room booking panel frozen',
  ],
  'Incident / Outage': [
    'checkout page is down for everyone', 'production outage customers cannot pay', 'website returning 500 errors',
    'payment service down urgent', 'critical system outage sev 1', 'customers report site not loading',
    'api latency spike everything timing out', 'database down production impacted', 'major incident checkout broken',
    'all users seeing error page',
  ],
};

const STOP = new Set('a an the and or to of for in on my is it i me we our this that with when after be can not no please need very every from at as are was have has'.split(' '));

export const tokenize = (text) => (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));

function train(corpus, alpha = 1) {
  const counts = {}, totals = {}, docs = {}, vocab = new Set();
  for (const c of CATEGORIES) {
    counts[c] = {}; totals[c] = 0; docs[c] = corpus[c].length;
    for (const doc of corpus[c]) for (const w of tokenize(doc)) {
      counts[c][w] = (counts[c][w] || 0) + 1; totals[c]++; vocab.add(w);
    }
  }
  const nDocs = Object.values(docs).reduce((s, v) => s + v, 0);
  return { counts, totals, docs, vocab, nDocs, alpha };
}

const MODEL = train(SEED_TICKETS);

export function classify(text, model = MODEL) {
  const words = tokenize(text).filter((w) => model.vocab.has(w));
  const V = model.vocab.size;
  const logPrior = {}, logLik = {}, perWord = {};
  for (const c of CATEGORIES) {
    logPrior[c] = Math.log(model.docs[c] / model.nDocs);
    perWord[c] = words.map((w) => Math.log(((model.counts[c][w] || 0) + model.alpha) / (model.totals[c] + model.alpha * V)));
    logLik[c] = perWord[c].reduce((s, v) => s + v, 0);
  }
  const logPost = CATEGORIES.map((c) => logPrior[c] + logLik[c]);
  const probs = softmax(logPost);
  const ranked = CATEGORIES.map((c, i) => ({ category: c, p: probs[i], logPost: logPost[i] })).sort((a, b) => b.p - a.p);
  return { words, ranked, top: ranked[0], logPrior, perWord, logPost };
}

// The chaos agent: same model, but sampled at a high "temperature" with hallucinated labels mixed in.
// Lesson 5 uses this to explain why LLMs hallucinate when sampling is too random.
export const HALLUCINATED = ['Quantum Printer Calibration', 'Blockchain › Mood Ledger', 'Cloud › Actual Weather',
  'Synergy › Paradigm Shift', 'Hardware › Emotional Support Monitor', 'AI › Ask Another AI'];

export function chaosClassify(text, random, temperature = 3) {
  const base = classify(text);
  const labels = [...CATEGORIES, ...HALLUCINATED];
  const logits = [...base.logPost, ...HALLUCINATED.map(() => Math.max(...base.logPost) - 1.5)];
  const probs = softmax(logits, temperature);
  let r = random(), pick = labels[labels.length - 1];
  for (let i = 0; i < labels.length; i++) { r -= probs[i]; if (r <= 0) { pick = labels[i]; break; } }
  return { category: pick, confidence: 0.55 + random() * 0.44, probs: labels.map((l, i) => ({ category: l, p: probs[i] })) };
}

export { SEED_TICKETS };

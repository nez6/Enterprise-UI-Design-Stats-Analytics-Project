// Experimental design shared by the portal (data collection) and the lessons (analysis).
//
// Every participant files six tickets in two sets, in random order:
//   * ServiceNow set: classic catalog forms (slow, fiddly).
//   * AI agent set: the same three kinds of request, but an AI agent built into the
//     product reads your description and fills the ticket in for you (fast).
// Two independent coin flips decide the banners:
//   * snow_primed: a POSITIVE banner before the ServiceNow set ("single pane of glass").
//   * ai_primed:   a NEGATIVE banner before the AI agent set (hallucination warning).

export const LEGACY = 'ServiceNow';
export const AI = 'AI Agent';
export const JOB_LEVELS = ['IC / Associate', 'Lead / Manager', 'Director / Executive'];
export const JOB_ROLES = ['Project / Product Management', 'Engineering / Tech', 'Operations', 'Other'];

export const CATEGORIES = ['Access & Passwords', 'Software', 'Network & VPN', 'Hardware', 'Facilities & AV', 'Incident / Outage'];
export const TICKET_TYPES = ['access', 'software', 'facilities'];

export const TESTS = {
  1: { name: 'Password Reset', short: 'SN · Access', workflow: LEGACY, type: 'access', category: 'Access & Passwords',
       prompt: 'You’re locked out of the expense system after too many attempts, and expenses are due today.' },
  2: { name: 'Software Licence Request', short: 'SN · Software', workflow: LEGACY, type: 'software', category: 'Software',
       prompt: 'You need a Tableau licence to build the board dashboard for Monday.' },
  3: { name: 'Boardroom AV (Documentation Hunt)', short: 'SN · Facilities', workflow: LEGACY, type: 'facilities', category: 'Facilities & AV',
       prompt: 'The boardroom screen and microphones aren’t working, and the board call starts at 5:00 PM.' },
  4: { name: 'MFA Reset', short: 'AI · Access', workflow: AI, type: 'access', category: 'Access & Passwords',
       prompt: 'Your new phone means the two-factor codes stopped arriving and you can’t sign in to email.' },
  5: { name: 'Software Install', short: 'AI · Software', workflow: AI, type: 'software', category: 'Software',
       prompt: 'You need Figma installed to review the new product designs this afternoon.' },
  6: { name: 'Meeting Room Camera', short: 'AI · Facilities', workflow: AI, type: 'facilities', category: 'Facilities & AV',
       prompt: 'The camera in meeting room 3A is offline and your client call starts in 15 minutes.' },
};
export const LEGACY_TESTS = [1, 2, 3];
export const AI_TESTS = [4, 5, 6];

export const BANNERS = {
  [LEGACY]: { tone: 'positive', text: 'As a reminder, ServiceNow’s single pane of glass is incredibly efficient.' },
  [AI]: { tone: 'negative', text: 'Reminder: AI agents are known to hallucinate and make costly mistakes. Double-check everything it does.' },
};

export const CART_CODE = 'CART-7781';

// One row per participant per ticket.
export const SUBMISSION_COLUMNS = [
  'participant_id', 'source', 'submitted_at', 'session_label',
  'years_experience', 'job_level', 'job_role',
  'snow_primed', 'ai_primed', 'set_order',
  'test_num', 'position', 'test_name', 'ticket_type', 'workflow', 'primed',
  'completion_time', 'error_count', 'rage_quit', 'frustration', 'efficiency',
  'ticket_text', 'chosen_category', 'ai_category', 'ai_confidence', 'ai_correct',
];
export const FEEDBACK_COLUMNS = ['participant_id', 'session_label', 'snow_primed', 'ai_primed', 'job_level', 'nps_servicenow', 'ai_trust', 'prefer_ai', 'comment'];

export const isAI = (r) => r.workflow === AI;

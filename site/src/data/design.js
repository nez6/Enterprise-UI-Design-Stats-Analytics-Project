// Experimental design shared by the portal (data collection) and the lessons (analysis).
//
// Every participant files six tickets in two sets, in random order:
//   * ServiceNow set: three catalog forms with the SAME effort each: four mandatory fields,
//     a description, and a Shopping Cart checkout whose reference code is in a KB article.
//   * AI agent set: the same three kinds of request; an AI agent built into the form reads
//     your description and fills in the fields AND the cart for you.
// Two independent coin flips:
//   * snow_primed: a POSITIVE banner before the ServiceNow set ("single pane of glass").
//   * ai_primed:   the "AI team": a NEGATIVE hallucination banner, the agent's confidence
//     shown on every ticket, and an agent that fills everything in correctly.
//     The other team sees no banner and no confidence, and on the AV ticket the agent
//     silently fills in the wrong room and cart code. The ticket still submits, and if
//     nobody catches it, an angry email arrives from the AV team.

export const LEGACY = 'ServiceNow';
export const AI = 'AI Agent';
export const JOB_LEVELS = ['IC / Associate', 'Lead / Manager', 'Director / Executive'];
export const JOB_ROLES = ['Project / Product Management', 'Engineering / Tech', 'Operations', 'Other'];

export const CATEGORIES = ['Access & Passwords', 'Software', 'Network & VPN', 'Hardware', 'Facilities & AV', 'Incident / Outage'];
export const TICKET_TYPES = ['access', 'software', 'facilities'];

// `fields` are the four mandatory fields every ticket has. `answer` is the correct value the AI
// agent fills in. `cart` is the Shopping Cart reference code from that ticket's KB article.
export const TESTS = {
  1: { name: 'Password Reset', short: 'SN · Access', workflow: LEGACY, type: 'access', category: 'Access & Passwords', cart: 'CART-4410', kb: 'KB0011873',
       prompt: 'You’re locked out of the expense system after too many attempts, and expenses are due today.' },
  2: { name: 'Software Licence Request', short: 'SN · Software', workflow: LEGACY, type: 'software', category: 'Software', cart: 'CART-2208', kb: 'KB0012255',
       prompt: 'You need a Tableau licence to build the board dashboard for Monday.' },
  3: { name: 'Boardroom AV', short: 'SN · Facilities', workflow: LEGACY, type: 'facilities', category: 'Facilities & AV', cart: 'CART-7781', kb: 'KB0012847',
       prompt: 'The boardroom screen and microphones aren’t working, and the board call starts at 5:00 PM.' },
  4: { name: 'MFA Reset', short: 'AI · Access', workflow: AI, type: 'access', category: 'Access & Passwords', cart: 'CART-5150', kb: 'KB0013390',
       prompt: 'Your new phone means the two-factor codes stopped arriving and you can’t sign in to email.' },
  5: { name: 'Software Install', short: 'AI · Software', workflow: AI, type: 'software', category: 'Software', cart: 'CART-3302', kb: 'KB0013411',
       prompt: 'You need Figma installed to review the new product designs this afternoon.' },
  6: { name: 'Meeting Room Camera', short: 'AI · Facilities', workflow: AI, type: 'facilities', category: 'Facilities & AV', cart: 'CART-6019', kb: 'KB0013467',
       prompt: 'The camera in meeting room 3A is offline and your client call starts in 15 minutes.' },
};
export const LEGACY_TESTS = [1, 2, 3];
export const AI_TESTS = [4, 5, 6];

// Four mandatory fields per ticket type, the same for ServiceNow and the AI agent.
// [label, kind, options-or-placeholder, correct answer (what the AI fills in)]
export const FIELDS = {
  access: [
    ['Requested for', 'text', 'Your name or employee ID', 'Me (current user)'],
    ['Application', 'select', ['Expense system', 'Email', 'HR portal', 'Single sign-on'], null],
    ['Urgency', 'select', ['1 - High', '2 - Medium', '3 - Low'], '1 - High'],
    ['Assignment group', 'select', ['Identity & Access Mgmt', 'Software Asset Mgmt', 'Workplace & AV', 'End User Computing'], 'Identity & Access Mgmt'],
  ],
  software: [
    ['Software', 'select', ['Tableau Desktop', 'Figma', 'Adobe Creative Cloud', 'JetBrains All Products'], null],
    ['Cost center', 'text', 'CC-0000', 'CC-4410'],
    ['Approving manager', 'select', ['Direct manager', 'Department head', 'Finance partner'], 'Direct manager'],
    ['Assignment group', 'select', ['Identity & Access Mgmt', 'Software Asset Mgmt', 'Workplace & AV', 'End User Computing'], 'Software Asset Mgmt'],
  ],
  facilities: [
    ['Room', 'text', 'e.g. Boardroom 4B', null],
    ['Request type', 'select', ['AV / Conferencing', 'Facilities', 'General inquiry'], 'AV / Conferencing'],
    ['Urgency', 'select', ['1 - High', '2 - Medium', '3 - Low'], '1 - High'],
    ['Assignment group', 'select', ['Identity & Access Mgmt', 'Software Asset Mgmt', 'Workplace & AV', 'End User Computing'], 'Workplace & AV'],
  ],
};
// Ticket-specific correct answers for the fields marked null above.
export const ANSWERS = {
  1: { Application: 'Expense system' }, 2: { Software: 'Tableau Desktop' }, 3: { Room: 'Boardroom' },
  4: { Application: 'Email' }, 5: { Software: 'Figma' }, 6: { Room: 'Meeting room 3A' },
};

// The AI team's agent never errs. For everyone else, the agent gets these tickets wrong:
// it fills in the wrong room and cart code, and the ticket submits anyway.
export const AI_ERROR_TESTS = [6];
export const AI_WRONG = { 6: { Room: 'Meeting room 7C', cart: 'CART-6091', 'Assignment group': 'End User Computing' } };

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
  'ai_error_injected', 'ai_error_caught',
];
export const FEEDBACK_COLUMNS = ['participant_id', 'session_label', 'snow_primed', 'ai_primed', 'job_level', 'nps_servicenow', 'ai_trust', 'prefer_ai', 'mc_snow', 'mc_ai', 'comment'];

export const isAI = (r) => r.workflow === AI;

"""Experimental design constants and the telemetry schema.

Mirrors site/src/data/design.js, so CSVs exported from the teaching site's
database (scripts/export_supabase.py) feed this pipeline unchanged.

Design: every participant files six tickets in two sets, in random order.
  * ServiceNow set (tests 1-3): classic catalog forms, ending in a documentation hunt.
  * AI agent set   (tests 4-6): an AI agent built into the form fills the ticket in.
Two independent coin flips:
  * snow_primed: POSITIVE banner before the ServiceNow set ("single pane of glass").
  * ai_primed:   NEGATIVE banner before the AI set (hallucination warning).
"""

JOB_LEVELS = ["IC / Associate", "Lead / Manager", "Director / Executive"]
JOB_ROLES = ["Project / Product Management", "Engineering / Tech", "Operations", "Other"]
LEGACY, AI = "ServiceNow", "AI Agent"
CATEGORIES = ["Access & Passwords", "Software", "Network & VPN", "Hardware", "Facilities & AV", "Incident / Outage"]

TESTS = {
    1: dict(name="Password Reset", short="SN · Access", workflow=LEGACY, type="access", category="Access & Passwords"),
    2: dict(name="Software Licence Request", short="SN · Software", workflow=LEGACY, type="software", category="Software"),
    3: dict(name="Boardroom AV (Documentation Hunt)", short="SN · Facilities", workflow=LEGACY, type="facilities", category="Facilities & AV"),
    4: dict(name="MFA Reset", short="AI · Access", workflow=AI, type="access", category="Access & Passwords"),
    5: dict(name="Software Install", short="AI · Software", workflow=AI, type="software", category="Software"),
    6: dict(name="Meeting Room Camera", short="AI · Facilities", workflow=AI, type="facilities", category="Facilities & AV"),
}

BANNERS = {
    LEGACY: "As a reminder, ServiceNow’s single pane of glass is incredibly efficient.",
    AI: "Reminder: AI agents are known to hallucinate and make costly mistakes. Double-check everything it does.",
}

COLUMNS = [
    "participant_id", "source", "submitted_at", "session_label",
    "years_experience", "job_level", "job_role",
    "snow_primed", "ai_primed", "set_order",
    "test_num", "position", "test_name", "ticket_type", "workflow", "primed",
    "completion_time", "error_count", "rage_quit", "frustration", "efficiency",
    "ticket_text", "chosen_category", "ai_category", "ai_confidence", "ai_correct",
]
FEEDBACK_COLUMNS = ["participant_id", "session_label", "snow_primed", "ai_primed", "job_level",
                    "nps_servicenow", "ai_trust", "prefer_ai", "comment"]

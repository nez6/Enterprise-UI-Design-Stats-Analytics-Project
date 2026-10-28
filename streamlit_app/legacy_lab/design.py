"""Experimental design constants: the six tests, factor levels, and the telemetry schema.

The Streamlit app (data collection) and the scripts in scripts/ (cleaning and
analysis) both import from here so that the two can never disagree about what a
column means.
"""

JOB_LEVELS = ["IC / Associate", "Lead / Manager", "Director / Executive"]
JOB_ROLES = ["Project / Product Management", "Engineering / Tech", "Operations", "Other"]
LEGACY, AI_BOT = "Legacy Ticketing", "AI Bot"

TESTS = {
    1: dict(name="Password Reset", short="T1 Password", workflow=LEGACY, chaos=0),
    2: dict(name="Software License Request", short="T2 License", workflow=LEGACY, chaos=0),
    3: dict(name="VPN Access (AI Assistant)", short="T3 VPN", workflow=AI_BOT, chaos=0),
    4: dict(name="Laptop Replacement (AI Assistant)", short="T4 Laptop", workflow=AI_BOT, chaos=0),
    5: dict(name="The Chaos AI Bot", short="T5 Chaos Bot", workflow=AI_BOT, chaos=1),
    6: dict(name="The Primed Documentation Hunt", short="T6 Doc Hunt", workflow=LEGACY, chaos=1),
}

# Participants in the primed arm see a banner before each chaos test. Priming both
# an AI test and a legacy test keeps the workflow x priming design fully crossed,
# which the two-way ANOVA interaction term needs.
PRIMING_TEXT = {
    5: "As a reminder, our AI Assistant resolves 94% of tickets on first contact.",
    6: "As a reminder, ServiceNow’s single pane of glass is incredibly efficient.",
}

CART_CODE = "CART-7781"

# One row per participant per completed test. Order matches the CSV the app writes.
COLUMNS = [
    "participant_id", "source", "submitted_at",
    "years_experience", "job_level", "job_role", "primed_arm",
    "test_num", "test_name", "workflow", "workflow_chaos", "priming_exposed",
    "completion_time", "error_count", "rage_quit", "frustration", "efficiency",
]

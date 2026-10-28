# Enterprise AI & Statistics Lab (Streamlit)

The original single-page Streamlit lab: a six-test ticketing simulator (four baselines, a chaos AI bot, a primed documentation hunt) plus six tabs of interactive statistics.

```bash
pip install -r streamlit_app/requirements.txt
streamlit run streamlit_app/app.py
```

**Hosting (Streamlit Community Cloud, free):** go to share.streamlit.io → **Create app** → choose this repo, branch `main`, main file `streamlit_app/app.py` → **Deploy**.

**Live data:** every participant on the server appends to `streamlit_app/data/raw/live_sessions.csv`, and the "Use Live Session Telemetry" view pools them. Community Cloud wipes that file when the app restarts or sleeps, so download the CSV from the sidebar after each session.

`legacy_lab/` holds this app's own copy of the experiment definitions. They differ from the SNOW Stats Lab design in `lab/`.

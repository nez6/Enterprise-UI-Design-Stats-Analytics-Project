# Enterprise AI & Statistics Lab (Streamlit)

An interactive applied-statistics textbook (EDA, hypothesis testing, ANOVA, regression, Bayes) on a 300-person simulated ticketing experiment. **It does not collect any data:** participants use the SNOW Stats Lab portal, which stores everything in one Supabase database (see `docs/IRB_REVIEW.md`).

```bash
pip install -r streamlit_app/requirements.txt
streamlit run streamlit_app/app.py
```

**Hosting (Streamlit Community Cloud, free):** go to share.streamlit.io → **Create app** → choose this repo, branch `main`, main file `streamlit_app/app.py` → **Deploy**.

**Data:** benchmark only. Nothing is stored.

`legacy_lab/` holds this app's own copy of the experiment definitions. They differ from the SNOW Stats Lab design in `lab/`.

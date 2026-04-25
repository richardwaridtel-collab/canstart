#!/usr/bin/env python3
"""
CanStart Job Sync — JobSpy Edition
Scrapes Indeed + Google Jobs for Canadian jobs and upserts into Supabase.
Runs daily via GitHub Actions at 5 AM EDT (9 AM UTC).
"""

import os
import time
from datetime import datetime, timedelta, timezone

import pandas as pd
from jobspy import scrape_jobs
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

CANADIAN_CITIES = [
    "Ottawa", "Toronto", "Calgary", "Vancouver", "Montreal",
    "Edmonton", "Winnipeg", "Halifax", "Quebec City", "Hamilton",
    "Kitchener", "London", "Mississauga", "Brampton", "Surrey",
    "Markham", "Vaughan", "Laval", "Gatineau", "Longueuil",
]

SEARCH_QUERIES = [
    # Marketing & Communications
    {"term": "marketing manager",           "category": "Marketing & Communications"},
    {"term": "digital marketing specialist","category": "Marketing & Communications"},
    {"term": "marketing coordinator",       "category": "Marketing & Communications"},
    {"term": "content marketing",           "category": "Marketing & Communications"},
    {"term": "communications coordinator",  "category": "Marketing & Communications"},
    {"term": "social media manager",        "category": "Marketing & Communications"},
    # Project Management
    {"term": "project manager",             "category": "Project Management"},
    {"term": "project coordinator",         "category": "Project Management"},
    {"term": "junior project manager",      "category": "Project Management"},
    # Data & Analytics
    {"term": "data analyst",                "category": "Data & Analytics"},
    {"term": "business intelligence analyst","category": "Data & Analytics"},
    # Business Analysis
    {"term": "business analyst",            "category": "Business Analysis"},
    # Human Resources
    {"term": "hr coordinator",              "category": "Human Resources"},
    {"term": "human resources manager",     "category": "Human Resources"},
    {"term": "talent acquisition specialist","category": "Human Resources"},
    # Finance & Accounting
    {"term": "financial analyst",           "category": "Finance & Accounting"},
    {"term": "accountant",                  "category": "Finance & Accounting"},
    {"term": "bookkeeper",                  "category": "Finance & Accounting"},
    # Customer Service
    {"term": "customer service representative", "category": "Customer Service"},
    {"term": "customer success manager",    "category": "Customer Service"},
    # Administration
    {"term": "administrative assistant",    "category": "Administration & Office"},
    {"term": "office coordinator",          "category": "Administration & Office"},
    {"term": "executive assistant",         "category": "Administration & Office"},
    # Technology
    {"term": "software developer",          "category": "Technology & IT"},
    {"term": ".net developer",              "category": "Technology & IT"},
    {"term": "full stack developer",        "category": "Technology & IT"},
    # Sales
    {"term": "sales representative",        "category": "Sales & Business Development"},
    {"term": "account manager",             "category": "Sales & Business Development"},
    {"term": "business development representative", "category": "Sales & Business Development"},
    # Operations
    {"term": "operations coordinator",      "category": "Operations & Logistics"},
    {"term": "supply chain coordinator",    "category": "Operations & Logistics"},
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def safe_str(val) -> str:
    if val is None:
        return ""
    s = str(val)
    return "" if s in ("nan", "None", "NaT") else s


def safe_float(val):
    try:
        if pd.isna(val):
            return None
        return float(val)
    except (TypeError, ValueError):
        return None


def extract_city(location_str: str) -> str:
    loc = safe_str(location_str)
    if not loc:
        return "Canada"
    if "remote" in loc.lower():
        return "Remote"
    for city in CANADIAN_CITIES:
        if city.lower() in loc.lower():
            return city
    # Fall back to first part before comma
    first = loc.split(",")[0].strip()
    return first if first else "Canada"


def detect_work_mode(title: str, description: str, is_remote) -> str:
    if is_remote is True:
        return "remote"
    text = (title + " " + (description or "")).lower()
    if "remote" in text or "work from home" in text or "télétravail" in text:
        return "remote"
    if "hybrid" in text:
        return "hybrid"
    return "onsite"


# ── Main Sync ─────────────────────────────────────────────────────────────────

def main():
    total_inserted = 0
    total_errors = []
    now = datetime.now(timezone.utc)

    print(f"\n{'='*60}")
    print(f"CanStart Job Sync — {now.strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"Queries: {len(SEARCH_QUERIES)} | Sites: Indeed + Google Jobs")
    print(f"{'='*60}")

    for query in SEARCH_QUERIES:
        term = query["term"]
        category = query["category"]

        print(f"\n→ '{term}'  [{category}]")

        try:
            jobs: pd.DataFrame = scrape_jobs(
                site_name=["indeed", "google"],
                search_term=term,
                location="Canada",
                country_indeed="canada",
                results_wanted=30,
                hours_old=168,          # last 7 days — daily sync keeps it fresh
                verbose=0,
                description_format="markdown",
                enforce_annual_salary=True,
            )

            if jobs is None or jobs.empty:
                print("  No results")
                time.sleep(2)
                continue

            print(f"  {len(jobs)} results")
            inserted_this_query = 0

            for _, job in jobs.iterrows():
                try:
                    # Build stable external_id
                    job_id  = safe_str(job.get("id"))
                    job_url = safe_str(job.get("job_url", ""))
                    external_id = job_id if job_id else job_url
                    if not external_id:
                        continue

                    source      = safe_str(job.get("site", "jobspy"))
                    title       = safe_str(job.get("title", ""))
                    company     = safe_str(job.get("company", ""))
                    location_s  = safe_str(job.get("location", ""))
                    description = safe_str(job.get("description", ""))
                    url         = job_url if job_url else external_id

                    is_remote  = job.get("is_remote")
                    city       = extract_city(location_s)
                    work_mode  = detect_work_mode(title, description, is_remote)

                    salary_min = safe_float(job.get("min_amount"))
                    salary_max = safe_float(job.get("max_amount"))

                    # Real publish date from job board
                    date_posted = job.get("date_posted")
                    posted_at = None
                    if date_posted is not None and safe_str(date_posted):
                        posted_at = f"{date_posted}T00:00:00+00:00"

                    record = {
                        "source":      source,
                        "external_id": external_id,
                        "title":       title,
                        "company":     company,
                        "city":        city,
                        "description": description[:15000],   # cap at 15k chars
                        "url":         url,
                        "category":    category,
                        "salary_min":  salary_min,
                        "salary_max":  salary_max,
                        "work_mode":   work_mode,
                        "posted_at":   posted_at,
                        "synced_at":   now.isoformat(),
                    }

                    supabase.table("external_opportunities").upsert(
                        record, on_conflict="source,external_id"
                    ).execute()

                    total_inserted += 1
                    inserted_this_query += 1

                except Exception as row_err:
                    total_errors.append(f"  Row '{safe_str(job.get('title'))}': {row_err}")

            print(f"  ✓ {inserted_this_query} upserted")

        except Exception as query_err:
            msg = f"Query '{term}': {query_err}"
            total_errors.append(msg)
            print(f"  ✗ ERROR: {query_err}")

        # Respectful delay between queries
        time.sleep(3)

    # ── Cleanup: remove jobs published over 30 days ago ──────────────────────
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    try:
        supabase.table("external_opportunities").delete() \
            .lt("posted_at", thirty_days_ago) \
            .not_.is_("posted_at", "null") \
            .execute()
        supabase.table("external_opportunities").delete() \
            .lt("synced_at", thirty_days_ago) \
            .is_("posted_at", "null") \
            .execute()
        print("\n✓ Old jobs cleaned up (>30 days)")
    except Exception as cleanup_err:
        print(f"\n✗ Cleanup error: {cleanup_err}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"DONE — {total_inserted} records upserted | {len(total_errors)} errors")
    if total_errors:
        print("Errors:")
        for e in total_errors[:10]:
            print(f"  {e}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()

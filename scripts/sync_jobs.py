#!/usr/bin/env python3
"""
CanStart Job Sync — JobSpy Edition
Scrapes Indeed + Google Jobs for Canadian jobs and upserts into Supabase.
Runs daily via GitHub Actions at 5 AM EDT (9 AM UTC).
Uses direct HTTP requests to Supabase REST API (no supabase-py async issues).
"""

import os
import time
import requests
from datetime import datetime, timedelta, timezone

import pandas as pd
from jobspy import scrape_jobs

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

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


def upsert_records(records: list) -> tuple[int, list]:
    """Batch upsert records to Supabase via REST API. Returns (count_upserted, errors)."""
    if not records:
        return 0, []

    url = f"{SUPABASE_URL}/rest/v1/external_opportunities"
    resp = requests.post(
        url,
        json=records,
        headers={
            **HEADERS,
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        timeout=30,
    )

    if resp.status_code in (200, 201):
        return len(records), []
    else:
        return 0, [f"HTTP {resp.status_code}: {resp.text[:200]}"]


def delete_old_jobs(thirty_days_ago: str):
    """Delete jobs older than 30 days via REST API."""
    url = f"{SUPABASE_URL}/rest/v1/external_opportunities"

    # Delete where posted_at < 30 days ago (posted_at IS NOT NULL implied by lt. comparison)
    # Use list of tuples so both posted_at params are sent as separate query args
    resp1 = requests.delete(
        url,
        params=[("posted_at", f"lt.{thirty_days_ago}"), ("posted_at", "not.is.null")],
        headers=HEADERS,
        timeout=30,
    )

    # Delete where synced_at < 30 days ago AND posted_at IS NULL
    resp2 = requests.delete(
        url,
        params=[("synced_at", f"lt.{thirty_days_ago}"), ("posted_at", "is.null")],
        headers=HEADERS,
        timeout=30,
    )

    ok1 = resp1.status_code in (200, 204)
    ok2 = resp2.status_code in (200, 204)
    if not ok1:
        print(f"  Cleanup resp1 status {resp1.status_code}: {resp1.text[:100]}")
    if not ok2:
        print(f"  Cleanup resp2 status {resp2.status_code}: {resp2.text[:100]}")
    return ok1 and ok2


# ── Main Sync ─────────────────────────────────────────────────────────────────

def main():
    total_inserted = 0
    total_errors = []
    now = datetime.now(timezone.utc)

    print(f"\n{'='*60}")
    print(f"CanStart Job Sync — {now.strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"Queries: {len(SEARCH_QUERIES)} | Sites: Indeed + Google Jobs")
    print(f"Supabase: {SUPABASE_URL}")
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
                hours_old=168,          # last 7 days
                verbose=0,
                description_format="markdown",
                enforce_annual_salary=True,
            )

            if jobs is None or jobs.empty:
                print("  No results")
                time.sleep(2)
                continue

            print(f"  {len(jobs)} results — building records...")
            records = []

            for _, job in jobs.iterrows():
                try:
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
                        "description": description[:15000],
                        "url":         url,
                        "category":    category,
                        "salary_min":  salary_min,
                        "salary_max":  salary_max,
                        "work_mode":   work_mode,
                        "posted_at":   posted_at,
                        "synced_at":   now.isoformat(),
                    }
                    records.append(record)

                except Exception as row_err:
                    total_errors.append(f"  Row '{safe_str(job.get('title'))}': {row_err}")

            # Batch upsert all records for this query
            if records:
                count, errs = upsert_records(records)
                total_inserted += count
                total_errors.extend(errs)
                print(f"  ✓ {count}/{len(records)} upserted")
            else:
                print("  No valid records")

        except Exception as query_err:
            msg = f"Query '{term}': {query_err}"
            total_errors.append(msg)
            print(f"  ✗ ERROR: {query_err}")

        time.sleep(3)

    # ── Cleanup: remove jobs published over 30 days ago ──────────────────────
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    try:
        ok = delete_old_jobs(thirty_days_ago)
        if ok:
            print("\n✓ Old jobs cleaned up (>30 days)")
        else:
            print("\n⚠ Cleanup completed with non-fatal status")
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

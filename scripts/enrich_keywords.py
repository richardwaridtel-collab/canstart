#!/usr/bin/env python3
"""
One-time script: batch-enrich all external_opportunities with LLM keywords.

Sends 5 jobs per Groq request → ~334 API calls for 1671 jobs → ~11 minutes.
After this runs once, every job has extracted_keywords cached and the nightly
compute_matches.py batch never needs to call Groq again.

Usage:
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GROQ_API_KEY=... python scripts/enrich_keywords.py
"""

import json
import os
import re
import time

import requests

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GROQ_KEY     = os.environ["GROQ_API_KEY"]

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}
BASE = f"{SUPABASE_URL}/rest/v1"

GROQ_API_URL  = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL    = "llama-3.3-70b-versatile"
BATCH_SIZE    = 10     # jobs per Groq request → ~167 calls for 1671 jobs (~8 min total)
BATCH_DELAY   = 2.2    # seconds between batches → well under 30 RPM free-tier limit


# ── Fetch all uncached jobs ───────────────────────────────────────────────────

def fetch_uncached_jobs() -> list[dict]:
    results, offset, limit = [], 0, 500
    while True:
        r = requests.get(
            f"{BASE}/external_opportunities",
            headers=HEADERS,
            params={
                "select": "id,title,description",
                "extracted_keywords": "is.null",
                "limit": limit,
                "offset": offset,
            },
            timeout=30,
        )
        batch = r.json()
        results.extend(batch)
        if len(batch) < limit:
            break
        offset += limit
    return results


# ── Groq batch extraction ─────────────────────────────────────────────────────

def extract_batch(jobs: list[dict]) -> dict[str, list[str]]:
    """
    Send up to BATCH_SIZE jobs in one Groq call.
    Returns {job_id: [keyword, ...]} for each job that got a valid response.
    """
    numbered = "\n\n".join(
        f"JOB_{i+1} id={job['id']}\n"
        f"Title: {job.get('title','')}\n"
        f"Description: {(job.get('description') or '')[:600]}"
        for i, job in enumerate(jobs)
    )

    prompt = (
        "For each job below, extract 10-15 specific technical skills, tools, and domain keywords.\n"
        "Return ONLY a valid JSON object where each key is the job id (the uuid after 'id=') "
        "and the value is an array of keyword strings.\n"
        "No markdown, no explanation.\n\n"
        + numbered
    )

    try:
        r = requests.post(
            GROQ_API_URL,
            json={
                "model": GROQ_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 1600,
            },
            headers={
                "Authorization": f"Bearer {GROQ_KEY}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )

        if r.status_code == 429:
            print("  ⚠ Rate limited — waiting 15s…")
            time.sleep(15)
            return {}

        if r.status_code != 200:
            return {}

        content = r.json()["choices"][0]["message"]["content"].strip()
        content = re.sub(r'^```[a-z]*\n?|```$', '', content, flags=re.MULTILINE).strip()
        data = json.loads(content)
        if isinstance(data, dict):
            return {k: [str(x).strip().lower() for x in v if x]
                    for k, v in data.items() if isinstance(v, list)}

    except Exception as e:
        print(f"  ✗ Groq error: {e}")

    return {}


def save_keywords(job_id: str, keywords: list[str]) -> None:
    requests.patch(
        f"{BASE}/external_opportunities?id=eq.{job_id}",
        json={"extracted_keywords": keywords},
        headers=HEADERS,
        timeout=10,
    )


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("\nFetching uncached jobs…")
    jobs = fetch_uncached_jobs()
    total = len(jobs)
    print(f"  {total} jobs need enrichment")

    if total == 0:
        print("  All jobs already enriched — nothing to do.")
        return

    saved = 0
    batches = [jobs[i:i + BATCH_SIZE] for i in range(0, total, BATCH_SIZE)]
    print(f"  {len(batches)} batches of up to {BATCH_SIZE} jobs each\n")

    for idx, batch in enumerate(batches, 1):
        results = extract_batch(batch)
        for job in batch:
            kws = results.get(job["id"])
            if kws:
                save_keywords(job["id"], kws)
                saved += 1

        pct = round(idx / len(batches) * 100)
        print(f"  Batch {idx}/{len(batches)} ({pct}%) — {saved}/{total} saved", end="\r")
        time.sleep(BATCH_DELAY)

    print(f"\n\n✓ Done — {saved}/{total} jobs enriched with LLM keywords.")
    print("  The nightly compute_matches.py will now use cached keywords automatically.")


if __name__ == "__main__":
    main()

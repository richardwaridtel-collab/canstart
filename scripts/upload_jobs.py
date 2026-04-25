#!/usr/bin/env python3
"""
Step 2: Upload jobs from jobs.json to Supabase via REST API.
Runs in a fresh process with no tls-client loaded — clean DNS/network.
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone

import requests

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

TABLE_URL = f"{SUPABASE_URL}/rest/v1/external_opportunities"

BATCH_SIZE = 50   # upsert in chunks to avoid hitting request size limits


def upsert_batch(records: list) -> tuple[int, str | None]:
    """POST a batch of records. Returns (count_sent, error_message_or_None)."""
    resp = requests.post(
        TABLE_URL,
        json=records,
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"},
        timeout=30,
    )
    if resp.status_code in (200, 201):
        return len(records), None
    return 0, f"HTTP {resp.status_code}: {resp.text[:300]}"


def delete_old_jobs(thirty_days_ago: str):
    # Delete where posted_at < cutoff (IS NOT NULL implied by lt comparison)
    r1 = requests.delete(
        TABLE_URL,
        params=[("posted_at", f"lt.{thirty_days_ago}"), ("posted_at", "not.is.null")],
        headers=HEADERS,
        timeout=30,
    )
    # Delete where synced_at < cutoff AND posted_at IS NULL
    r2 = requests.delete(
        TABLE_URL,
        params=[("synced_at", f"lt.{thirty_days_ago}"), ("posted_at", "is.null")],
        headers=HEADERS,
        timeout=30,
    )
    for label, r in [("posted_at cleanup", r1), ("synced_at cleanup", r2)]:
        if r.status_code not in (200, 204):
            print(f"  ⚠ {label} → HTTP {r.status_code}: {r.text[:100]}")
        else:
            print(f"  ✓ {label} done")


def main():
    # ── Load scraped data ─────────────────────────────────────────────────────
    if not os.path.exists("jobs.json"):
        print("ERROR: jobs.json not found — did scrape_jobs.py run?")
        sys.exit(1)

    with open("jobs.json", encoding="utf-8") as f:
        records = json.load(f)

    now = datetime.now(timezone.utc)

    print(f"\n{'='*60}")
    print(f"UPLOAD STEP — {now.strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"Records to upload: {len(records)}")
    print(f"Supabase: {SUPABASE_URL}")
    print(f"{'='*60}")

    # Quick connectivity test
    try:
        test = requests.get(
            f"{SUPABASE_URL}/rest/v1/external_opportunities?limit=1",
            headers=HEADERS,
            timeout=10,
        )
        print(f"✓ Supabase reachable (HTTP {test.status_code})")
    except Exception as e:
        print(f"✗ Cannot reach Supabase: {e}")
        sys.exit(1)

    # ── Upsert in batches ─────────────────────────────────────────────────────
    total_upserted = 0
    errors = []

    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        count, err = upsert_batch(batch)
        if err:
            errors.append(err)
            print(f"  ✗ Batch {i//BATCH_SIZE + 1}: {err}")
        else:
            total_upserted += count
            print(f"  ✓ Batch {i//BATCH_SIZE + 1}: {count} upserted "
                  f"({total_upserted}/{len(records)} total)")

    # ── Cleanup ───────────────────────────────────────────────────────────────
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    print(f"\nCleaning up jobs older than {thirty_days_ago[:10]}…")
    try:
        delete_old_jobs(thirty_days_ago)
    except Exception as e:
        print(f"  ✗ Cleanup error: {e}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"DONE — {total_upserted}/{len(records)} upserted | {len(errors)} batch errors")
    if errors:
        for e in errors[:5]:
            print(f"  {e}")
    print(f"{'='*60}\n")

    if len(errors) == len(records) // BATCH_SIZE + 1:
        sys.exit(1)  # Every batch failed — surface as workflow failure


if __name__ == "__main__":
    main()

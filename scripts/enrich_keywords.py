#!/usr/bin/env python3
"""
One-time script: pre-populate extracted_keywords for all external_opportunities
using a local Python tokenizer — no LLM, no API calls, no rate limits.

Completes in under 60 seconds for 1,600+ jobs.

Usage:
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python scripts/enrich_keywords.py
"""

import os
import re
import time

import requests

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}
BASE = f"{SUPABASE_URL}/rest/v1"

# ── Tokenizer (mirrors compute_matches.py) ────────────────────────────────────

SKILL_SYNONYMS = {
    "js": "javascript", "ts": "typescript",
    "reactjs": "react", "react.js": "react",
    "nodejs": "node", "node.js": "node",
    "vuejs": "vue", "vue.js": "vue",
    "angularjs": "angular",
    "nextjs": "next.js",
    "py": "python",
    "gcp": "google cloud",
    "amazon web services": "aws",
    "k8s": "kubernetes", "kube": "kubernetes",
    "ml": "machine learning",
    "dl": "deep learning",
    "ai": "artificial intelligence",
    "gen ai": "generative ai",
    "nlp": "natural language processing",
    "cv": "computer vision",
    "llm": "large language model",
    "bi": "business intelligence",
    "etl": "data pipeline",
    "powerbi": "power bi",
    "ci/cd": "continuous integration",
    "cicd": "continuous integration",
    "mssql": "sql server",
    "psql": "postgresql", "pg": "postgresql",
    "mongo": "mongodb",
    "dotnet": ".net", "csharp": "c#",
    "ux": "user experience", "ui": "user interface",
    "gh": "github", "gl": "gitlab",
    "ms office": "microsoft office",
}

DOMAIN_PHRASES = [
    "machine learning", "deep learning", "artificial intelligence",
    "natural language processing", "computer vision", "data science",
    "data engineering", "software engineer", "software developer",
    "full stack", "frontend developer", "backend developer",
    "mobile developer", "devops engineer", "cloud engineer",
    "data analyst", "business intelligence", "continuous integration",
    "continuous deployment", "large language model",
    "digital marketing", "content marketing", "social media marketing",
    "email marketing", "brand management", "content strategy",
    "google analytics", "google ads", "facebook ads",
    "public relations", "media relations", "a/b testing",
    "financial modeling", "accounts payable", "accounts receivable",
    "financial analyst", "talent acquisition", "human resources",
    "employee relations", "workforce planning", "benefits administration",
    "talent management", "performance management", "labour relations",
    "organizational development", "business development",
    "account executive", "account manager", "lead generation",
    "b2b sales", "b2c sales", "revenue target", "client acquisition",
    "data analysis", "data warehouse", "power bi", "sql server",
    "big data", "supply chain", "inventory management",
    "operations manager", "quality assurance", "process improvement",
    "six sigma", "vendor management", "graphic design", "ui design",
    "ux design", "product design", "web design", "user experience",
    "user interface", "motion graphics", "project management",
    "agile methodology", "scrum master", "product owner",
]

STOP_WORDS = {
    "a","an","the","i","me","my","we","our","you","your","he","him","his",
    "she","her","it","its","they","them","their","what","which","who","whom",
    "this","that","these","those","am","is","are","was","were","be","been",
    "being","have","has","had","do","does","did","will","would","could",
    "should","might","must","shall","can","may","and","but","if","or","as",
    "until","while","of","at","by","for","with","about","against","between",
    "into","through","during","before","after","above","below","to","from",
    "up","down","in","out","on","off","over","under","again","then","once",
    "nor","so","yet","both","either","neither","not","only","here","there",
    "when","where","why","how","all","each","every","few","more","most",
    "other","some","such","no","same","than","too","very","just","also",
    "now","etc","within","via","per","new","make","use","get","give","go",
    "see","take","come","know","role","position","job","work","working",
    "team","company","looking","seeking","required","requirements",
    "responsibilities","qualifications","preferred","experience","years",
    "year","ability","skills","knowledge","strong","excellent","good",
    "great","well","include","including","includes","like",
}

def tokenize(text: str) -> list[str]:
    lower = text.lower()
    tokens = set()

    # Single tokens
    for word in re.split(r"[^a-z0-9#+.\-]+", lower):
        clean = word.strip(".-")
        clean = SKILL_SYNONYMS.get(clean, clean)
        if len(clean) >= 3 and clean not in STOP_WORDS and not re.match(r"^\d+$", clean):
            tokens.add(clean)

    # Multi-word domain phrases
    for phrase in DOMAIN_PHRASES:
        if phrase in lower:
            tokens.add(phrase)

    return sorted(tokens)


# ── Fetch / Save ──────────────────────────────────────────────────────────────

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
        r.raise_for_status()
        batch = r.json()
        results.extend(batch)
        if len(batch) < limit:
            break
        offset += limit
    return results


def save_batch(updates: list[dict]) -> None:
    """Bulk-save up to 500 rows via Supabase upsert."""
    requests.post(
        f"{BASE}/external_opportunities",
        json=updates,
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates"},
        timeout=30,
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

    print("  Tokenizing locally (no API calls)…\n")

    UPSERT_BATCH = 200
    saved = 0
    updates: list[dict] = []

    for i, job in enumerate(jobs, 1):
        text = f"{job.get('title', '')} {job.get('description', '') or ''}"
        keywords = tokenize(text)

        updates.append({"id": job["id"], "extracted_keywords": keywords})

        if len(updates) >= UPSERT_BATCH:
            save_batch(updates)
            saved += len(updates)
            updates = []

        pct = round(i / total * 100)
        print(f"  {i}/{total} ({pct}%) tokenized…", end="\r")

    # flush remainder
    if updates:
        save_batch(updates)
        saved += len(updates)

    print(f"\n\n✓ Done — {saved}/{total} jobs enriched with keywords.")
    print("  The nightly compute_matches.py will now use cached keywords automatically.")


if __name__ == "__main__":
    main()

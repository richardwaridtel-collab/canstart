#!/usr/bin/env python3
"""
Nightly match computation: seeker ↔ external-job  (stores ≥70%)
                           candidate ↔ employer-job (stores ≥75%)

Mirrors the TypeScript keywordMatcher.ts algorithm so scores are
consistent with what users see on the Opportunities page.
"""

import os
import re
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

BASE = f"{SUPABASE_URL}/rest/v1"

# ── Stop words (mirrors keywordMatcher.ts STOP_WORDS) ────────────────────────

STOP_WORDS = frozenset([
    'a','an','the','i','me','my','we','our','you','your','he','him','his','she','her',
    'it','its','they','them','their','what','which','who','whom','this','that','these','those',
    'am','is','are','was','were','be','been','being','have','has','had','do','does','did',
    'will','would','could','should','might','must','shall','can','may',
    'and','but','if','or','as','until','while','of','at','by','for','with','about',
    'against','between','into','through','during','before','after','above','below',
    'to','from','up','down','in','out','on','off','over','under','again','then','once',
    'nor','so','yet','both','either','neither','not','only',
    'here','there','when','where','why','how','all','each','every','few','more','most',
    'other','some','such','no','same','than','too','very','just','also','now','etc',
    'within','via','per','new','make','use','get','give','go','see','take','come','know',
    'role','position','job','work','working','team','company','looking','seeking',
    'required','requirements','responsibilities','qualifications','preferred',
    'experience','years','year','ability','skills','knowledge','strong','excellent',
    'good','great','well','include','including','includes','like',
])

SOFT_SKILLS = frozenset([
    'leadership','communication','problem-solving','critical thinking',
    'attention to detail','time management','teamwork','collaboration','adaptability',
    'organizational skills','interpersonal skills','written communication','verbal communication',
])

# ── Domain signals (mirrors TypeScript DOMAIN_SIGNALS) ────────────────────────

DOMAIN_SIGNALS: dict[str, list[str]] = {
    'tech': [
        '.net','c#','java','python','javascript','typescript','react','angular','vue','node.js',
        'sql','aws','azure','gcp','docker','kubernetes','php','ruby','swift','kotlin','html','css',
        'software developer','software engineer','backend','frontend','full stack',
        'devops','cloud','database','programming','api','git','linux','microservices',
        'machine learning','data science','artificial intelligence','mobile developer',
    ],
    'marketing': [
        'seo','sem','ppc','content marketing','digital marketing','social media marketing',
        'email marketing','brand management','copywriting','advertising',
        'marketing campaign','google ads','facebook ads','hubspot','mailchimp','hootsuite',
        'marketing manager','marketing coordinator','communications','public relations',
        'media relations','content strategy','google analytics','a/b testing',
    ],
    'finance': [
        'accounting','financial','cpa','gaap','ifrs','bookkeeping','audit','tax',
        'financial modeling','accounts payable','accounts receivable','quickbooks','xero',
        'budgeting','forecasting','financial analyst','controller','cfo',
        'investment','portfolio','banking','insurance','actuarial',
    ],
    'hr': [
        'recruitment','talent acquisition','hris','human resources','onboarding','payroll',
        'employee relations','workforce planning','benefits administration','hr manager',
        'hr coordinator','talent management','performance management','compensation',
        'labour relations','organizational development',
    ],
    'sales': [
        'sales','business development','account executive','account manager','cold calling',
        'pipeline','quota','revenue target','crm','lead generation','b2b sales','b2c sales',
        'sales manager','territory','client acquisition',
    ],
    'data': [
        'data analysis','data analyst','data science','data engineer','power bi','tableau',
        'machine learning','statistics','pandas','data warehouse','etl',
        'business intelligence','analytics','big data','looker','sql server',
    ],
    'operations': [
        'supply chain','logistics','procurement','inventory management','operations manager',
        'quality assurance','process improvement','lean','six sigma','warehouse',
        'vendor management','facilities','manufacturing','production',
    ],
    'design': [
        'graphic design','ui design','ux design','product design','web design','figma','sketch',
        'photoshop','illustrator','indesign','canva','adobe','motion graphics',
        'user experience','user interface',
    ],
}

CATEGORY_DOMAIN_MAP = [
    ('marketing', 'marketing'), ('communications', 'marketing'),
    ('technology', 'tech'), ('it ', 'tech'), (' it', 'tech'),
    ('software', 'tech'), ('finance', 'finance'), ('accounting', 'finance'),
    ('human resources', 'hr'), (' hr', 'hr'),
    ('sales', 'sales'), ('business development', 'sales'),
    ('data & analytics', 'data'), ('data analytics', 'data'),
    ('business analysis', 'data'), ('design', 'design'), ('creative', 'design'),
    ('operations', 'operations'), ('logistics', 'operations'),
    ('project management', 'pm'), ('customer service', 'customer'),
    ('administration', 'admin'), ('office', 'admin'),
    ('education', 'education'), ('training', 'education'),
    ('healthcare', 'healthcare'), ('health', 'healthcare'),
    ('engineering', 'engineering'), ('legal', 'legal'), ('compliance', 'legal'),
]

ADJACENT: dict[str, list[str]] = {
    'tech': ['data', 'engineering'],
    'data': ['tech', 'finance'],
    'sales': ['marketing', 'customer'],
    'marketing': ['sales', 'design', 'customer'],
    'finance': ['data', 'operations'],
    'hr': ['operations', 'admin'],
    'design': ['marketing', 'tech'],
    'operations': ['finance', 'hr', 'admin'],
    'pm': ['tech', 'operations', 'data'],
    'customer': ['sales', 'marketing'],
    'admin': ['hr', 'operations'],
    'engineering': ['tech', 'operations'],
}


# ── Core matching utilities ───────────────────────────────────────────────────

def tokenize(text: str) -> set:
    """Extract significant keywords. Mirrors keywordMatcher.ts extractKeywords."""
    words = re.split(r'[^a-z0-9#+.\-]+', text.lower())
    result = set()
    for w in words:
        clean = w.strip('.-')
        if len(clean) >= 3 and clean not in STOP_WORDS and not clean.isdigit():
            result.add(clean)
    return result


def category_to_domain(category: str) -> str:
    lower = (category or '').lower()
    for match, domain in CATEGORY_DOMAIN_MAP:
        if match in lower:
            return domain
    return 'unknown'


def detect_domain(text_lower: str) -> str:
    scores: dict[str, int] = {}
    for domain, signals in DOMAIN_SIGNALS.items():
        scores[domain] = sum(1 for s in signals if s in text_lower)
    top = max(scores.items(), key=lambda x: x[1])
    return top[0] if top[1] >= 2 else 'unknown'


def industry_score(candidate_text_lower: str, job_category: str) -> int:
    """0, 12 (adjacent), or 30 (exact). Mirrors computeIndustryScore."""
    job_domain = category_to_domain(job_category)
    candidate_domain = detect_domain(candidate_text_lower)
    if job_domain == 'unknown' or candidate_domain == 'unknown':
        return 0
    if job_domain == candidate_domain:
        return 30
    if candidate_domain in ADJACENT.get(job_domain, []):
        return 12
    return 0


def compute_score(
    candidate_tokens: set,
    candidate_text_lower: str,
    job_tokens: set,
    job_category: str,
) -> int:
    """Compute match score 0-100 (mirrors TypeScript computeJobMatch)."""
    if not job_tokens or not candidate_tokens:
        return 0

    matched = len(job_tokens & candidate_tokens)
    raw_ratio = matched / len(job_tokens)
    confidence = min(1.0, len(job_tokens) / 10)
    kw_score = round(raw_ratio * confidence * 70)

    # Early exit: can't reach threshold even with max industry bonus (30)
    if kw_score + 30 < 70:
        return kw_score  # caller skips if < 70

    ind_score = industry_score(candidate_text_lower, job_category)
    return min(100, kw_score + ind_score)


# ── Supabase REST helpers ─────────────────────────────────────────────────────

def fetch_all(path: str, params: dict | None = None) -> list:
    """Fetch all rows with pagination (handles >500 records)."""
    results = []
    limit = 500
    offset = 0
    while True:
        p = {**(params or {}), 'limit': limit, 'offset': offset}
        r = requests.get(f"{BASE}/{path}", headers=HEADERS, params=p, timeout=30)
        if r.status_code != 200:
            print(f"  ✗ fetch {path}: HTTP {r.status_code} {r.text[:120]}")
            break
        batch = r.json()
        results.extend(batch)
        if len(batch) < limit:
            break
        offset += limit
    return results


def upsert_batch(table: str, records: list, on_conflict: str) -> None:
    """Upsert records in chunks of 200."""
    if not records:
        return
    chunk_size = 200
    total = 0
    for i in range(0, len(records), chunk_size):
        batch = records[i:i + chunk_size]
        r = requests.post(
            f"{BASE}/{table}",
            json=batch,
            headers={**HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal'},
            params={'on_conflict': on_conflict},
            timeout=60,
        )
        if r.status_code not in (200, 201):
            print(f"  ✗ upsert {table} batch {i // chunk_size + 1}: HTTP {r.status_code} {r.text[:120]}")
        else:
            total += len(batch)
    print(f"  ✓ upserted {total} rows → {table}")


def delete_stale(table: str, cutoff: str) -> None:
    """Delete rows with computed_at < cutoff."""
    r = requests.delete(
        f"{BASE}/{table}",
        headers=HEADERS,
        params={'computed_at': f'lt.{cutoff}'},
        timeout=30,
    )
    if r.status_code in (200, 204):
        print(f"  ✓ cleaned stale rows from {table}")
    else:
        print(f"  ⚠ cleanup {table}: HTTP {r.status_code} {r.text[:80]}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    now = datetime.now(timezone.utc)
    print(f"\n{'='*60}")
    print(f"MATCH COMPUTE — {now.strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"Supabase: {SUPABASE_URL}")
    print(f"{'='*60}")

    # ── 1. Load data ──────────────────────────────────────────────────────────
    print("\nLoading data…")

    seekers = fetch_all('profiles', {'role': 'eq.seeker', 'select': 'user_id'})
    print(f"  Seekers: {len(seekers)}")

    all_sp = fetch_all('seeker_profiles', {'select': 'user_id,skills,resume_text'})
    sp_map = {sp['user_id']: sp for sp in all_sp}
    print(f"  Seeker profiles loaded: {len(sp_map)}")

    # Pre-tokenize candidate texts
    skipped = 0
    for uid, sp in sp_map.items():
        raw = sp.get('resume_text') or ''
        resume_len = len(raw)
        skills = sp.get('skills') or []
        if not raw or len(raw) < 30:
            raw = ' '.join(skills)
        sp['_text_lower'] = raw.lower()
        sp['_tokens'] = tokenize(sp['_text_lower']) if len(raw) >= 30 else set()
        if not sp['_tokens']:
            skipped += 1
        print(f"  Profile {uid[:8]}… resume_text={resume_len} chars, skills={len(skills)}, tokens={len(sp['_tokens'])}")
    if skipped:
        print(f"  ⚠ {skipped} profile(s) skipped — no resume text or skills found")

    ext_jobs = fetch_all(
        'external_opportunities',
        {'select': 'id,title,description,category,work_mode,city'},
    )
    print(f"  External jobs: {len(ext_jobs)}")

    open_opps = fetch_all(
        'opportunities',
        {'status': 'eq.open', 'select': 'id,title,description,category,work_mode,city,skills_required,employer_id'},
    )
    print(f"  Open CanStart opportunities: {len(open_opps)}")

    # Pre-tokenize job texts
    for job in ext_jobs:
        full = ((job.get('title') or '') + ' ' + (job.get('description') or '')).lower()
        job['_tokens'] = tokenize(full) - SOFT_SKILLS

    for opp in open_opps:
        full = (
            (opp.get('title') or '') + ' ' +
            (opp.get('description') or '') + ' ' +
            ' '.join(opp.get('skills_required') or [])
        ).lower()
        opp['_tokens'] = tokenize(full) - SOFT_SKILLS

    # ── 2. Seeker ↔ External Job matching (threshold ≥70%) ───────────────────
    print(f"\n[1/2] Seeker–Job matching (threshold ≥70%)")
    job_match_records: list[dict] = []
    computed_ts = now.isoformat()

    for seeker in seekers:
        uid = seeker['user_id']
        sp = sp_map.get(uid)
        if not sp or not sp['_tokens']:
            continue
        c_tokens = sp['_tokens']
        c_text = sp['_text_lower']

        for job in ext_jobs:
            j_tokens = job['_tokens']
            if not j_tokens:
                continue
            score = compute_score(c_tokens, c_text, j_tokens, job.get('category', ''))
            if score >= 70:
                job_match_records.append({
                    'seeker_id': uid,
                    'job_id': job['id'],
                    'match_score': score,
                    'computed_at': computed_ts,
                })

    print(f"  Matches found: {len(job_match_records)}")
    upsert_batch('job_matches', job_match_records, 'seeker_id,job_id')

    # ── 3. Employer ↔ Candidate matching (threshold ≥75%) ────────────────────
    print(f"\n[2/2] Employer–Candidate matching (threshold ≥75%)")
    candidate_match_records: list[dict] = []

    for opp in open_opps:
        employer_id = opp.get('employer_id')
        if not employer_id:
            continue
        j_tokens = opp['_tokens']
        if not j_tokens:
            continue
        job_cat = opp.get('category', '')

        for seeker in seekers:
            uid = seeker['user_id']
            sp = sp_map.get(uid)
            if not sp or not sp['_tokens']:
                continue
            score = compute_score(sp['_tokens'], sp['_text_lower'], j_tokens, job_cat)
            if score >= 75:
                candidate_match_records.append({
                    'employer_id': employer_id,
                    'opportunity_id': opp['id'],
                    'seeker_id': uid,
                    'match_score': score,
                    'computed_at': computed_ts,
                })

    print(f"  Matches found: {len(candidate_match_records)}")
    upsert_batch('candidate_matches', candidate_match_records, 'opportunity_id,seeker_id')

    # ── 4. Clean up stale matches (older than 7 days) ────────────────────────
    cutoff = (now - timedelta(days=7)).isoformat()
    print(f"\nCleaning matches older than {cutoff[:10]}…")
    delete_stale('job_matches', cutoff)
    delete_stale('candidate_matches', cutoff)

    print(f"\n{'='*60}\nDONE\n{'='*60}\n")


if __name__ == '__main__':
    main()

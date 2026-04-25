#!/usr/bin/env python3
"""
Nightly match computation: seeker ↔ external-job  (stores ≥40 score)
                           candidate ↔ employer-job (stores ≥50 score)

Scoring pipeline (zero external API cost):
  1. Synonym normalisation  — "js"→"javascript", "k8s"→"kubernetes" etc.
  2. Domain phrase extraction — "machine learning", "data science" matched
     as single units, not split tokens.
  3. Groq LLM keyword extraction (optional, free tier) — when GROQ_API_KEY
     is present, richer per-job keyword sets are fetched and cached in
     external_opportunities.extracted_keywords, replacing full-text
     tokenisation for far more accurate scoring.
  4. Set-intersection scoring — capped denominator + industry boost (0-30).
"""

import json
import os
import re
import time
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

# ── Skill synonym normalisation ───────────────────────────────────────────────
# Maps common abbreviations / alternate spellings to a canonical form so that
# "js" in a resume matches "javascript" in a job description and vice-versa.

SKILL_SYNONYMS: dict[str, str] = {
    # JavaScript / TypeScript
    'js': 'javascript', 'ts': 'typescript',
    'reactjs': 'react', 'react.js': 'react',
    'nodejs': 'node', 'node.js': 'node',
    'vuejs': 'vue', 'vue.js': 'vue',
    'angularjs': 'angular',
    'nextjs': 'next.js',
    # Python
    'py': 'python',
    # Cloud
    'gcp': 'google cloud',
    'amazon web services': 'aws',
    # Containers / orchestration
    'k8s': 'kubernetes', 'kube': 'kubernetes',
    # ML / AI
    'ml': 'machine learning',
    'dl': 'deep learning',
    'ai': 'artificial intelligence',
    'gen ai': 'generative ai',
    'nlp': 'natural language processing',
    'cv': 'computer vision',
    'llm': 'large language model',
    # Data
    'bi': 'business intelligence',
    'etl': 'data pipeline',
    'powerbi': 'power bi',
    # DevOps / CI-CD
    'ci/cd': 'continuous integration',
    'cicd': 'continuous integration',
    'ci': 'continuous integration',
    'cd': 'continuous deployment',
    # Databases
    'mssql': 'sql server',
    'psql': 'postgresql',
    'pg': 'postgresql',
    'mongo': 'mongodb',
    'es': 'elasticsearch',
    'dynamo': 'dynamodb',
    # .NET / C#
    'dotnet': '.net',
    'csharp': 'c#',
    # UX / UI
    'ux': 'user experience',
    'ui': 'user interface',
    # Version control
    'gh': 'github',
    'gl': 'gitlab',
    # Microsoft Office
    'ms office': 'microsoft office',
    'msoffice': 'microsoft office',
    'ms excel': 'excel',
    'ms word': 'word',
}


def normalise(token: str) -> str:
    """Return the canonical form of a token via SKILL_SYNONYMS."""
    return SKILL_SYNONYMS.get(token, token)


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


# ── Domain phrases (multi-word skills extracted as single match units) ─────────
# Derived automatically from DOMAIN_SIGNALS so there's one source of truth.
# These are matched as complete phrases in both resume and job text, preventing
# "machine" + "learning" being scored as two separate weak signals.

DOMAIN_PHRASES: frozenset = frozenset(
    phrase for phrases in DOMAIN_SIGNALS.values()
    for phrase in phrases if ' ' in phrase
)
# e.g. {'machine learning', 'data science', 'software engineer', 'ui design', ...}


# ── Core matching utilities ───────────────────────────────────────────────────

def tokenize(text: str) -> set:
    """
    Extract significant keywords + known domain phrases.

    1. Split on non-alphanumeric separators.
    2. Normalise each token via SKILL_SYNONYMS.
    3. Filter stop-words, short tokens, and pure numbers.
    4. Additionally scan the full text for every DOMAIN_PHRASES entry so that
       multi-word skills like "machine learning" are treated as single units
       and match reliably across resume↔job pairs.
    """
    lower = text.lower()

    # ── Single tokens ──────────────────────────────────────────────────────────
    words = re.split(r'[^a-z0-9#+.\-]+', lower)
    result = set()
    for w in words:
        clean = w.strip('.-')
        clean = normalise(clean)          # synonym normalisation
        if len(clean) >= 3 and clean not in STOP_WORDS and not clean.isdigit():
            result.add(clean)

    # ── Multi-word domain phrases ──────────────────────────────────────────────
    for phrase in DOMAIN_PHRASES:
        if phrase in lower:
            result.add(phrase)

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
    threshold: int = 40,
) -> dict:
    """Compute match result with score, matched keywords, and missing keywords.

    Returns a dict:
        score           int  0-100
        matched         list[str]  up to 20 tokens in both resume and job
        missing         list[str]  up to 20 job tokens absent from resume

    Job descriptions often contain 200-500 non-stop-word tokens (boilerplate,
    prose, legal text).  Dividing by the raw token count makes every score tiny.
    We cap the effective denominator at 60 so that matching 30 out of the
    most-relevant tokens in a long description isn't penalised relative to a
    tightly-written 40-token posting.
    """
    empty = {'score': 0, 'matched': [], 'missing': sorted(job_tokens)[:20]}
    if not job_tokens or not candidate_tokens:
        return empty

    matched_tokens = job_tokens & candidate_tokens
    missing_tokens = job_tokens - candidate_tokens

    matched_count = len(matched_tokens)
    effective_denom = max(10, min(len(job_tokens), 60))
    raw_ratio = matched_count / effective_denom
    confidence = min(1.0, len(job_tokens) / 10)
    kw_score = round(raw_ratio * confidence * 70)

    # Prefer shorter, human-readable tokens for display (skip pure numbers / long hashes)
    def display_tokens(tset: set, limit: int) -> list:
        return sorted(t for t in tset if len(t) <= 30)[:limit]

    # Early exit: can't reach threshold even with max industry bonus (30)
    if kw_score + 30 < threshold:
        return {
            'score': kw_score,
            'matched': display_tokens(matched_tokens, 20),
            'missing': display_tokens(missing_tokens, 20),
        }

    ind_score = industry_score(candidate_text_lower, job_category)
    return {
        'score': min(100, kw_score + ind_score),
        'matched': display_tokens(matched_tokens, 20),
        'missing': display_tokens(missing_tokens, 20),
    }


# ── Groq LLM keyword extraction (free tier, optional) ────────────────────────
# When GROQ_API_KEY is set, each job gets 10-20 focused skill keywords extracted
# by llama-3.3-70b instead of using the full-text tokeniser.  These are cached
# in external_opportunities.extracted_keywords so subsequent runs are instant.
#
# Free tier limits: 14 400 req/day, 100 RPM — plenty for a nightly job.

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_RPM_DELAY = 0.65   # seconds between requests → ≤92 RPM


def extract_keywords_groq(job: dict) -> list[str]:
    """
    Call Groq to extract 10-20 specific skill/tool keywords for a job.
    Returns empty list on any failure so callers can fall back to tokenisation.
    """
    title = (job.get('title') or '')
    desc  = (job.get('description') or '')[:2000]
    prompt = (
        f"Job title: {title}\nJob description:\n{desc}\n\n"
        "Extract 10-20 specific technical skills, tools, and domain keywords from this job posting. "
        "Return ONLY a JSON array of strings — no explanation, no markdown. "
        "Example: [\"Python\", \"SQL\", \"machine learning\", \"AWS\", \"Agile\"]"
    )
    try:
        r = requests.post(
            GROQ_API_URL,
            json={
                "model": GROQ_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 300,
            },
            headers={
                "Authorization": f"Bearer {GROQ_KEY}",
                "Content-Type": "application/json",
            },
            timeout=20,
        )
        if r.status_code == 200:
            content = r.json()["choices"][0]["message"]["content"].strip()
            # Strip markdown code fences if present
            content = re.sub(r'^```[a-z]*\n?|```$', '', content, flags=re.MULTILINE).strip()
            kws = json.loads(content)
            if isinstance(kws, list):
                return [str(k).strip().lower() for k in kws if k][:20]
        elif r.status_code == 429:
            # Rate limited — back off and skip this job for now
            time.sleep(5)
    except Exception as e:
        pass   # fall back to tokenisation silently
    return []


def cache_job_keywords(job_id: str, keywords: list[str]) -> None:
    """Persist extracted_keywords back to external_opportunities."""
    requests.patch(
        f"{BASE}/external_opportunities?id=eq.{job_id}",
        json={"extracted_keywords": keywords},
        headers=HEADERS,
        timeout=10,
    )


def get_job_token_set(job: dict) -> set:
    """
    Return the token set to use for scoring.

    Priority:
      1. Cached LLM keywords (extracted_keywords column) — most accurate.
      2. Fresh Groq extraction (if GROQ_API_KEY present) — fetched + cached.
      3. Full-text tokenisation fallback.
    """
    cached = job.get('extracted_keywords')
    if cached and isinstance(cached, list) and len(cached) >= 3:
        # Normalise cached LLM keywords the same way we normalise resume tokens
        normalised = set()
        for kw in cached:
            tok = normalise(kw.lower().strip())
            if tok:
                normalised.add(tok)
            # Also add domain phrases contained in the keyword string
            for phrase in DOMAIN_PHRASES:
                if phrase in kw.lower():
                    normalised.add(phrase)
        return normalised - SOFT_SKILLS

    full = ((job.get('title') or '') + ' ' + (job.get('description') or '')).lower()
    tokens = tokenize(full) - SOFT_SKILLS

    # Optionally enrich with Groq (rate-limited)
    if GROQ_KEY:
        kws = extract_keywords_groq(job)
        if kws:
            cache_job_keywords(job['id'], kws)
            groq_tokens = set()
            for kw in kws:
                tok = normalise(kw.strip())
                groq_tokens.add(tok)
                for phrase in DOMAIN_PHRASES:
                    if phrase in kw:
                        groq_tokens.add(phrase)
            return (groq_tokens - SOFT_SKILLS) or tokens
        time.sleep(GROQ_RPM_DELAY)

    return tokens


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
        skills = sp.get('skills') or []
        if not raw or len(raw) < 30:
            raw = ' '.join(skills)
        sp['_text_lower'] = raw.lower()
        sp['_tokens'] = tokenize(sp['_text_lower']) if len(raw) >= 30 else set()
        if not sp['_tokens']:
            skipped += 1
    if skipped:
        print(f"  ⚠ {skipped} profile(s) skipped — no resume text or skills found")

    ext_jobs = fetch_all(
        'external_opportunities',
        {'select': 'id,title,description,category,work_mode,city,extracted_keywords'},
    )
    print(f"  External jobs: {len(ext_jobs)}")
    cached_count = sum(1 for j in ext_jobs if j.get('extracted_keywords'))
    if GROQ_KEY:
        print(f"  LLM keywords cached: {cached_count}/{len(ext_jobs)} jobs (remaining will be fetched via Groq)")
    else:
        print(f"  LLM keywords cached: {cached_count}/{len(ext_jobs)} jobs (set GROQ_API_KEY to enable Groq enrichment)")

    open_opps = fetch_all(
        'opportunities',
        {'status': 'eq.open', 'select': 'id,title,description,category,work_mode,city,skills_required,employer_id'},
    )
    print(f"  Open CanStart opportunities: {len(open_opps)}")

    # Pre-tokenize job texts (uses LLM keywords when cached, Groq when key present, else full-text)
    groq_fetched = 0
    for job in ext_jobs:
        job['_tokens'] = get_job_token_set(job)
        if GROQ_KEY and not job.get('extracted_keywords'):
            groq_fetched += 1
    if groq_fetched:
        print(f"  Groq enriched: {groq_fetched} new jobs")

    for opp in open_opps:
        full = (
            (opp.get('title') or '') + ' ' +
            (opp.get('description') or '') + ' ' +
            ' '.join(opp.get('skills_required') or [])
        ).lower()
        opp['_tokens'] = tokenize(full) - SOFT_SKILLS

    # ── 2. Seeker ↔ External Job matching (threshold ≥40%) ───────────────────
    SEEKER_JOB_THRESHOLD = 40
    print(f"\n[1/2] Seeker–Job matching (threshold ≥{SEEKER_JOB_THRESHOLD}%)")
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
            result = compute_score(c_tokens, c_text, j_tokens, job.get('category', ''), SEEKER_JOB_THRESHOLD)
            if result['score'] >= SEEKER_JOB_THRESHOLD:
                job_match_records.append({
                    'seeker_id': uid,
                    'job_id': job['id'],
                    'match_score': result['score'],
                    'matched_keywords': result['matched'],
                    'missing_keywords': result['missing'],
                    'computed_at': computed_ts,
                })

    print(f"  Matches found: {len(job_match_records)}")
    upsert_batch('job_matches', job_match_records, 'seeker_id,job_id')

    # ── 3. Employer ↔ Candidate matching (threshold ≥50%) ────────────────────
    CANDIDATE_THRESHOLD = 50
    print(f"\n[2/2] Employer–Candidate matching (threshold ≥{CANDIDATE_THRESHOLD}%)")
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
            result = compute_score(sp['_tokens'], sp['_text_lower'], j_tokens, job_cat, CANDIDATE_THRESHOLD)
            if result['score'] >= CANDIDATE_THRESHOLD:
                candidate_match_records.append({
                    'employer_id': employer_id,
                    'opportunity_id': opp['id'],
                    'seeker_id': uid,
                    'match_score': result['score'],
                    'matched_keywords': result['matched'],
                    'missing_keywords': result['missing'],
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

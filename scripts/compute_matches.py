#!/usr/bin/env python3
"""
Nightly match computation: seeker ↔ external-job  (stores ≥40 score)
                           candidate ↔ employer-job (stores ≥50 score)

Scoring pipeline (ATS recruiter model):
  Stage 1 — Keyword pre-filter (free, instant):
    • Synonym normalisation  — "js"→"javascript", "k8s"→"kubernetes" etc.
    • Domain phrase extraction — "machine learning", "data science" matched
      as single units.
    • Top-30 most-relevant jobs per seeker are selected for LLM scoring.

  Stage 2 — Groq LLM recruiter scoring (when GROQ_API_KEY is set):
    • Full resume + full job description sent to llama-3.1-8b-instant.
    • Model acts as an ATS + senior recruiter, returns JSON:
        {score, matched, missing, reason}
    • Score is 0-100, calibrated like a real ATS:
        ≥70 = Strong Match, 55-69 = Good Match, 40-54 = Possible Match.
    • Graceful fallback to keyword scoring if Groq key absent / rate limited.
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

# ── Groq config ───────────────────────────────────────────────────────────────
GROQ_API_URL  = "https://api.groq.com/openai/v1/chat/completions"
GROQ_KEY      = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL    = "llama-3.1-8b-instant"   # 20k TPM free tier — highest limits
GROQ_DELAY    = 3.0                       # seconds between requests → ~20 RPM (safe)
GROQ_MAX_CALLS_PER_RUN = 300             # cap total LLM calls per nightly run
                                          # 300 × 3 s ≈ 15 min — fits 20-min window

# Top-N keyword pre-filter per seeker before LLM scoring.
# Only the most keyword-relevant 30 jobs are sent to the LLM, saving ~98% of API calls.
LLM_PRE_FILTER_TOP_N = 30

# ── ATS recruiter scoring prompt ──────────────────────────────────────────────
ATS_PROMPT = """\
You are an expert ATS (Applicant Tracking System) and senior recruiter. \
Evaluate how well this candidate's resume matches the job posting.

Scoring guide — be strict, like a real recruiter:
  85-100 = Excellent match: candidate meets nearly all requirements
  70-84  = Strong match: candidate meets most key requirements
  55-69  = Good match: relevant background, some skill gaps
  40-54  = Possible match: some overlap but noticeable gaps
   0-39  = Weak match: candidate lacks most requirements

JOB TITLE: {title}

JOB DESCRIPTION:
{description}

CANDIDATE RESUME:
{resume}

Return ONLY a valid JSON object (no markdown, no extra text):
{{"score": <integer 0-100>, "matched": [<up to 8 skills or experiences the candidate HAS that the job needs>], "missing": [<up to 8 key requirements the candidate LACKS>], "reason": "<one concise sentence explaining the score>"}}"""


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
SKILL_SYNONYMS: dict[str, str] = {
    'js': 'javascript', 'ts': 'typescript',
    'reactjs': 'react', 'react.js': 'react',
    'nodejs': 'node', 'node.js': 'node',
    'vuejs': 'vue', 'vue.js': 'vue',
    'angularjs': 'angular',
    'nextjs': 'next.js',
    'py': 'python',
    'gcp': 'google cloud',
    'amazon web services': 'aws',
    'k8s': 'kubernetes', 'kube': 'kubernetes',
    'ml': 'machine learning',
    'dl': 'deep learning',
    'ai': 'artificial intelligence',
    'gen ai': 'generative ai',
    'nlp': 'natural language processing',
    'cv': 'computer vision',
    'llm': 'large language model',
    'bi': 'business intelligence',
    'etl': 'data pipeline',
    'powerbi': 'power bi',
    'ci/cd': 'continuous integration',
    'cicd': 'continuous integration',
    'ci': 'continuous integration',
    'cd': 'continuous deployment',
    'mssql': 'sql server',
    'psql': 'postgresql',
    'pg': 'postgresql',
    'mongo': 'mongodb',
    'es': 'elasticsearch',
    'dynamo': 'dynamodb',
    'dotnet': '.net',
    'csharp': 'c#',
    'ux': 'user experience',
    'ui': 'user interface',
    'gh': 'github',
    'gl': 'gitlab',
    'ms office': 'microsoft office',
    'msoffice': 'microsoft office',
    'ms excel': 'excel',
    'ms word': 'word',
}


def normalise(token: str) -> str:
    return SKILL_SYNONYMS.get(token, token)


# ── Domain signals ────────────────────────────────────────────────────────────
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

DOMAIN_PHRASES: frozenset = frozenset(
    phrase for phrases in DOMAIN_SIGNALS.values()
    for phrase in phrases if ' ' in phrase
)


# ── Core keyword utilities (used for Stage 1 pre-filter) ─────────────────────

def tokenize(text: str) -> set:
    lower = text.lower()
    words = re.split(r'[^a-z0-9#+.\-]+', lower)
    result = set()
    for w in words:
        clean = w.strip('.-')
        clean = normalise(clean)
        if len(clean) >= 3 and clean not in STOP_WORDS and not clean.isdigit():
            result.add(clean)
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
    job_domain = category_to_domain(job_category)
    candidate_domain = detect_domain(candidate_text_lower)
    if job_domain == 'unknown' or candidate_domain == 'unknown':
        return 0
    if job_domain == candidate_domain:
        return 30
    if candidate_domain in ADJACENT.get(job_domain, []):
        return 12
    return 0


def keyword_score(
    candidate_tokens: set,
    candidate_text_lower: str,
    job_tokens: set,
    job_category: str,
) -> int:
    """Quick keyword intersection score (0-100) used only for Stage 1 pre-filtering."""
    if not job_tokens or not candidate_tokens:
        return 0
    matched_count = len(job_tokens & candidate_tokens)
    effective_denom = max(10, min(len(job_tokens), 60))
    raw_ratio = matched_count / effective_denom
    confidence = min(1.0, len(job_tokens) / 10)
    kw = round(raw_ratio * confidence * 70)
    ind = industry_score(candidate_text_lower, job_category)
    return min(100, kw + ind)


def get_job_token_set(job: dict) -> set:
    cached = job.get('extracted_keywords')
    if cached and isinstance(cached, list) and len(cached) >= 3:
        result = set()
        for kw in cached:
            tok = normalise(kw.lower().strip())
            if tok:
                result.add(tok)
            for phrase in DOMAIN_PHRASES:
                if phrase in kw.lower():
                    result.add(phrase)
        return result - SOFT_SKILLS
    full = ((job.get('title') or '') + ' ' + (job.get('description') or '')).lower()
    return tokenize(full) - SOFT_SKILLS


# ── Stage 2: Groq ATS recruiter scoring ──────────────────────────────────────

def score_with_llm(title: str, description: str, resume_text: str) -> dict | None:
    """
    Score a resume against a job using Groq LLM acting as an ATS recruiter.

    Returns a dict: {score, matched, missing, reason}
    Returns None on any failure (caller falls back to keyword score).
    """
    prompt = ATS_PROMPT.format(
        title=title or 'Unknown',
        description=(description or '')[:1500],
        resume=resume_text[:2000],
    )
    try:
        r = requests.post(
            GROQ_API_URL,
            json={
                "model": GROQ_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 400,
            },
            headers={
                "Authorization": f"Bearer {GROQ_KEY}",
                "Content-Type": "application/json",
            },
            timeout=25,
        )
        if r.status_code == 200:
            content = r.json()["choices"][0]["message"]["content"].strip()
            # Strip markdown fences if the model wraps output anyway
            content = re.sub(r'^```[a-z]*\n?|```$', '', content, flags=re.MULTILINE).strip()
            result = json.loads(content)
            if isinstance(result, dict) and 'score' in result:
                return {
                    'score':   max(0, min(100, int(result.get('score', 0)))),
                    'matched': [str(k).lower().strip() for k in result.get('matched', [])][:8],
                    'missing': [str(k).lower().strip() for k in result.get('missing', [])][:8],
                    'reason':  str(result.get('reason', ''))[:300],
                }
        elif r.status_code == 429:
            print("  ⚠ Groq rate limited — sleeping 10 s…")
            time.sleep(10)
    except Exception as e:
        pass   # silently fall back to keyword scoring
    return None


# ── Supabase REST helpers ─────────────────────────────────────────────────────

def fetch_all(path: str, params: dict | None = None) -> list:
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
    print(f"Scoring mode: {'🤖 LLM (ATS recruiter)' if GROQ_KEY else '🔑 Keyword fallback (set GROQ_API_KEY to enable LLM)'}")
    print(f"{'='*60}")

    # ── 1. Load data ──────────────────────────────────────────────────────────
    print("\nLoading data…")

    seekers = fetch_all('profiles', {'role': 'eq.seeker', 'select': 'user_id'})
    print(f"  Seekers: {len(seekers)}")

    all_sp = fetch_all('seeker_profiles', {'select': 'user_id,skills,resume_text'})
    sp_map = {sp['user_id']: sp for sp in all_sp}
    print(f"  Seeker profiles loaded: {len(sp_map)}")

    skipped = 0
    for uid, sp in sp_map.items():
        raw = sp.get('resume_text') or ''
        skills = sp.get('skills') or []
        if not raw or len(raw) < 30:
            raw = ' '.join(skills)
        sp['_text_lower'] = raw.lower()
        sp['_tokens'] = tokenize(sp['_text_lower']) if len(raw) >= 30 else set()
        sp['_resume_text'] = raw   # keep original for LLM
        if not sp['_tokens']:
            skipped += 1
    if skipped:
        print(f"  ⚠ {skipped} profile(s) skipped — no resume text or skills found")

    ext_jobs = fetch_all(
        'external_opportunities',
        {'select': 'id,title,description,category,work_mode,city,extracted_keywords'},
    )
    print(f"  External jobs: {len(ext_jobs)}")

    open_opps = fetch_all(
        'opportunities',
        {'status': 'eq.open', 'select': 'id,title,description,category,work_mode,city,skills_required,employer_id'},
    )
    print(f"  Open CanStart opportunities: {len(open_opps)}")

    # Pre-tokenize job texts (used for Stage 1 keyword pre-filter)
    for job in ext_jobs:
        job['_tokens'] = get_job_token_set(job)

    for opp in open_opps:
        full = (
            (opp.get('title') or '') + ' ' +
            (opp.get('description') or '') + ' ' +
            ' '.join(opp.get('skills_required') or [])
        ).lower()
        opp['_tokens'] = tokenize(full) - SOFT_SKILLS

    # ── 2. Seeker ↔ External Job matching ────────────────────────────────────
    SEEKER_JOB_THRESHOLD = 40
    print(f"\n[1/2] Seeker–Job matching (threshold ≥{SEEKER_JOB_THRESHOLD}%)")

    job_match_records: list[dict] = []
    computed_ts = now.isoformat()
    total_llm_calls = 0

    for seeker in seekers:
        uid = seeker['user_id']
        sp = sp_map.get(uid)
        if not sp or not sp['_tokens']:
            continue

        c_tokens     = sp['_tokens']
        c_text       = sp['_text_lower']
        resume_text  = sp['_resume_text']
        use_llm      = (GROQ_KEY and len(resume_text) >= 50
                        and total_llm_calls < GROQ_MAX_CALLS_PER_RUN)

        if use_llm:
            # ── Stage 1: keyword pre-filter → top N jobs ──────────────────
            scored_jobs: list[tuple[int, dict]] = []
            for job in ext_jobs:
                if not job['_tokens']:
                    continue
                ks = keyword_score(c_tokens, c_text, job['_tokens'], job.get('category', ''))
                if ks > 0:
                    scored_jobs.append((ks, job))

            scored_jobs.sort(key=lambda x: x[0], reverse=True)
            top_jobs = [job for _, job in scored_jobs[:LLM_PRE_FILTER_TOP_N]]

            print(f"  Seeker {uid[:8]}: {len(top_jobs)} candidates → LLM scoring…")

            # ── Stage 2: LLM recruiter scoring ────────────────────────────
            for job in top_jobs:
                if total_llm_calls >= GROQ_MAX_CALLS_PER_RUN:
                    print(f"  ⚠ LLM call cap ({GROQ_MAX_CALLS_PER_RUN}) reached — remaining seekers use keyword fallback")
                    break

                llm = score_with_llm(
                    job.get('title', ''),
                    job.get('description', ''),
                    resume_text,
                )
                total_llm_calls += 1
                time.sleep(GROQ_DELAY)

                if llm and llm['score'] >= SEEKER_JOB_THRESHOLD:
                    job_match_records.append({
                        'seeker_id':        uid,
                        'job_id':           job['id'],
                        'match_score':      llm['score'],
                        'matched_keywords': llm['matched'],
                        'missing_keywords': llm['missing'],
                        'match_reason':     llm['reason'],
                        'computed_at':      computed_ts,
                    })
        else:
            # ── Keyword-only fallback ──────────────────────────────────────
            for job in ext_jobs:
                if not job['_tokens']:
                    continue
                ks = keyword_score(c_tokens, c_text, job['_tokens'], job.get('category', ''))
                if ks >= SEEKER_JOB_THRESHOLD:
                    matched_t = sorted(t for t in (job['_tokens'] & c_tokens) if len(t) <= 30)[:20]
                    missing_t = sorted(t for t in (job['_tokens'] - c_tokens) if len(t) <= 30)[:20]
                    job_match_records.append({
                        'seeker_id':        uid,
                        'job_id':           job['id'],
                        'match_score':      ks,
                        'matched_keywords': matched_t,
                        'missing_keywords': missing_t,
                        'match_reason':     None,
                        'computed_at':      computed_ts,
                    })

    if GROQ_KEY:
        print(f"  LLM calls used: {total_llm_calls} / {GROQ_MAX_CALLS_PER_RUN}")
    print(f"  Matches found: {len(job_match_records)}")
    upsert_batch('job_matches', job_match_records, 'seeker_id,job_id')

    # ── 3. Employer ↔ Candidate matching (keyword scoring, threshold ≥50%) ──
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
            ks = keyword_score(sp['_tokens'], sp['_text_lower'], j_tokens, job_cat)
            if ks >= CANDIDATE_THRESHOLD:
                matched_t = sorted(t for t in (j_tokens & sp['_tokens']) if len(t) <= 30)[:20]
                missing_t = sorted(t for t in (j_tokens - sp['_tokens']) if len(t) <= 30)[:20]
                candidate_match_records.append({
                    'employer_id':      employer_id,
                    'opportunity_id':   opp['id'],
                    'seeker_id':        uid,
                    'match_score':      ks,
                    'matched_keywords': matched_t,
                    'missing_keywords': missing_t,
                    'computed_at':      computed_ts,
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

/**
 * Keyword extraction and matching utilities — adapted from Resume-Matcher (Apache 2.0)
 * Enhanced with word-boundary matching and multi-word phrase support.
 */

// Stop words to filter out during tokenization
const STOP_WORDS = new Set([
  // Articles / pronouns / common verbs
  'a','an','the','i','me','my','we','our','you','your','he','him','his','she','her',
  'it','its','they','them','their','what','which','who','whom','this','that','these','those',
  'am','is','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','could','should','might','must','shall','can','may',
  // Prepositions / conjunctions
  'and','but','if','or','as','until','while','of','at','by','for','with','about',
  'against','between','into','through','during','before','after','above','below',
  'to','from','up','down','in','out','on','off','over','under','again','then','once',
  'nor','so','yet','both','either','neither','not','only',
  // Common filler
  'here','there','when','where','why','how','all','each','every','few','more','most',
  'other','some','such','no','same','than','too','very','just','also','now','etc',
  'within','via','per','new','make','use','get','give','go','see','take','come','know',
  // Job posting boilerplate
  'role','position','job','work','working','team','company','looking','seeking',
  'required','requirements','responsibilities','qualifications','preferred',
  'experience','years','year','ability','skills','knowledge','strong','excellent',
  'good','great','well','include','including','includes','like','etc',
])

const MIN_WORD_LENGTH = 3

/**
 * Tokenize text into a Set of significant lowercase words.
 * Filters stop words, short words, and pure numbers.
 */
export function extractKeywords(text: string): Set<string> {
  const keywords = new Set<string>()
  const words = text.toLowerCase().split(/[^a-z0-9#+.-]+/)
  for (const word of words) {
    const clean = word.replace(/^[.\-]+|[.\-]+$/g, '')
    if (clean.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(clean) && !/^\d+$/.test(clean)) {
      keywords.add(clean)
    }
  }
  return keywords
}

/**
 * Check whether a keyword (single or multi-word) appears in resume text.
 * Uses word-boundary regex so "SQL" won't match "MySQL", "Java" won't match "JavaScript".
 */
export function matchesKeyword(resumeText: string, keyword: string): boolean {
  const lower = keyword.toLowerCase()
  // Escape special regex characters
  const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  if (lower.includes(' ') || lower.includes('.') || lower.includes('#') || lower.includes('+')) {
    // Multi-word / special-char keyword: try phrase match first, then token subset match
    const phraseMatch = new RegExp(`\\b${escaped}\\b`, 'i').test(resumeText)
    if (phraseMatch) return true

    // Fall back: all component tokens must appear individually
    const tokens = extractKeywords(lower)
    if (tokens.size === 0) return false
    const resumeTokens = extractKeywords(resumeText)
    return [...tokens].every(t => resumeTokens.has(t))
  }

  // Single word — strict word-boundary match
  return new RegExp(`\\b${escaped}\\b`, 'i').test(resumeText)
}

/**
 * Score keyword match between resume text and a list of job keywords.
 * Returns weighted score (required keywords count 2×) and found/missing arrays.
 */
export function scoreKeywords(
  resumeText: string,
  keywords: Array<{ keyword: string; required: boolean }>,
): {
  weightedMatched: number
  weightedTotal: number
  matched: Array<{ keyword: string; required: boolean }>
  missing: Array<{ keyword: string; required: boolean }>
} {
  let weightedMatched = 0
  let weightedTotal = 0
  const matched: Array<{ keyword: string; required: boolean }> = []
  const missing: Array<{ keyword: string; required: boolean }> = []

  for (const kw of keywords) {
    const weight = kw.required ? 2 : 1
    weightedTotal += weight
    if (matchesKeyword(resumeText, kw.keyword)) {
      weightedMatched += weight
      matched.push(kw)
    } else {
      missing.push(kw)
    }
  }

  return { weightedMatched, weightedTotal, matched, missing }
}

/**
 * Simple percentage match between two free-form texts (for quick previews).
 * Returns 0–100.
 */
export function quickMatchPercent(resumeText: string, jobText: string): number {
  const jdTokens = extractKeywords(jobText)
  const resumeTokens = extractKeywords(resumeText)
  if (jdTokens.size === 0) return 0
  let matches = 0
  for (const t of jdTokens) {
    if (resumeTokens.has(t)) matches++
  }
  return Math.round((matches / jdTokens.size) * 100)
}

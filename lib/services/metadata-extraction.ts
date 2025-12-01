import * as chrono from 'chrono-node'

export async function extractMetadata(text: string): Promise<{
  dates: string[]
  locations: string[]
  budgets: string[]
  urls: string[]
}> {
  return {
    dates: [parseDate(text)].filter(Boolean) as string[],
    locations: extractLocations(text),
    budgets: extractBudgets(text),
    urls: extractUrls(text),
  }
}

export function parseDate(text: string): string | null {
  // First try natural language parsing with chrono-node
  try {
    const results = chrono.parse(text)
    if (results.length > 0 && results[0].start) {
      const date = results[0].start.date()
      return date.toISOString().split('T')[0] // YYYY-MM-DD
    }
  } catch (error) {
    console.error('chrono-node date parsing failed:', error)
  }

  // Fallback: Simple ISO date regex: YYYY-MM-DD
  const isoDatePattern = /\b(\d{4})-(\d{2})-(\d{2})\b/
  const match = text.match(isoDatePattern)

  if (match) {
    return match[0]
  }

  // Common date patterns: MM/DD/YYYY, DD/MM/YYYY
  const slashDatePattern = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/
  const slashMatch = text.match(slashDatePattern)

  if (slashMatch) {
    const [_, month, day, year] = slashMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return null
}

export function extractLocations(text: string): string[] {
  // Simple approach: Find capitalized multi-word phrases
  // (Cities/countries usually capitalized)
  const locations: string[] = []

  // Common location patterns
  const locationPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g
  const matches = text.matchAll(locationPattern)

  for (const match of matches) {
    const location = match[1]
    // Filter out common non-locations
    if (!['The', 'I', 'We', 'You', 'This', 'That'].includes(location)) {
      locations.push(location)
    }
  }

  return [...new Set(locations)] // Deduplicate
}

export function extractBudgets(text: string): string[] {
  const budgets: string[] = []

  // Pattern: Currency symbol + number
  const currencyPattern = /[$€£¥][\d,]+(?:\.\d{2})?/g
  const matches = text.match(currencyPattern)

  if (matches) {
    budgets.push(...matches)
  }

  // Pattern: "budget:", "cost:", etc.
  const budgetKeywordPattern = /(?:budget|cost|price|total):\s*[$€£¥]?[\d,]+(?:\.\d{2})?/gi
  const keywordMatches = text.match(budgetKeywordPattern)

  if (keywordMatches) {
    budgets.push(...keywordMatches)
  }

  return budgets
}

export function extractUrls(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s]+/g
  return text.match(urlPattern) || []
}

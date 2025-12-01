import Anthropic from '@anthropic-ai/sdk'
import { extractLocations } from '@/lib/services/metadata-extraction'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function extractJsonObject(text: string): any {
  // 1. Try direct parse
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
  } catch {
    // ignore
  }

  // 2. Try to extract first top-level JSON object substring
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = text.slice(start, end + 1)
    const parsed = JSON.parse(candidate)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
  }

  throw new Error('Malformed JSON from LLM')
}

/**
 * Uses Anthropic LLM to extract location names from an idea description.
 * Returns locations in the order they appear in the text.
 */
export async function extractLocationsWithLLM(text: string): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }

  const prompt = `You are extracting distinct location names from an idea description.

Return ONLY a JSON object in this exact shape with no extra text, markdown, or explanation:

{
  "locations": ["Location 1", "Location 2"]
}

Rules:
- Include only real locations (cities, regions, neighborhoods, venues, etc.).
- Preserve the order they appear in the text.
- If there are no locations, return: { "locations": [] }.

DESCRIPTION:
${text}`

  const message = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const content = message.content[0]
  if (!content || content.type !== 'text') {
    throw new Error('Unexpected response type from LLM metadata extractor')
  }

  const parsed = extractJsonObject(content.text)

  if (!parsed || !Array.isArray(parsed.locations)) {
    throw new Error('LLM metadata extractor returned invalid locations payload')
  }

  return parsed.locations
    .map((loc: unknown) => (typeof loc === 'string' ? loc.trim() : ''))
    .filter((loc: string) => !!loc)
}

/**
 * Returns the best single location for a description.
 * Strategy:
 * - Try LLM-based extraction first
 * - If that fails or returns nothing, fall back to regex-based extraction
 */
export async function getBestLocation(text: string): Promise<string | null> {
  // 1. Try LLM
  try {
    const llmLocations = await extractLocationsWithLLM(text)
    const first = llmLocations.map((s) => s.trim()).filter(Boolean)[0]
    if (first) {
      return first
    }
  } catch (err) {
    console.error('LLM location extraction failed, falling back to regex:', err)
  }

  // 2. Regex fallback (current behavior)
  const regexLocations = extractLocations(text)
  const firstRegex = regexLocations.find((loc) => !/^New Idea\b/i.test(loc)) ?? null
  return firstRegex ?? null
}

/**
 * Performance monitoring utilities
 * Logs slow queries and tracks execution times
 */

/**
 * Measure execution time of an async function
 * Logs warning if execution exceeds threshold
 *
 * @param label - Description of operation
 * @param fn - Async function to measure
 * @param slowThresholdMs - Log warning if slower than this (default: 500ms)
 */
export async function measurePerformance<T>(
  label: string,
  fn: () => Promise<T>,
  slowThresholdMs: number = 500
): Promise<T> {
  const start = Date.now()

  try {
    const result = await fn()
    const duration = Date.now() - start

    if (duration > slowThresholdMs) {
      console.warn(`⚠️  SLOW: ${label} took ${duration}ms (threshold: ${slowThresholdMs}ms)`)
    } else {
      console.log(`✓ ${label} completed in ${duration}ms`)
    }

    return result
  } catch (error) {
    const duration = Date.now() - start
    console.error(`❌ ERROR in ${label} after ${duration}ms:`, error)
    throw error
  }
}

/**
 * Track LLM API costs
 */
export function logLLMCost(
  operation: string,
  inputTokens: number,
  outputTokens: number,
  model: 'haiku' | 'sonnet' | 'gpt-4o-mini'
): void {
  const costs = {
    haiku: { input: 0.25 / 1_000_000, output: 1.25 / 1_000_000 },
    sonnet: { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
    'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 }
  }

  const cost = costs[model]
  const totalCost = (inputTokens * cost.input) + (outputTokens * cost.output)

  console.log(`💰 LLM Cost [${operation}]: $${totalCost.toFixed(4)} (${inputTokens} in + ${outputTokens} out, ${model})`)
}

/**
 * Log cache hit/miss
 */
export function logCacheEvent(key: string, hit: boolean): void {
  if (hit) {
    console.log(`✓ Cache HIT: ${key}`)
  } else {
    console.log(`✗ Cache MISS: ${key}`)
  }
}

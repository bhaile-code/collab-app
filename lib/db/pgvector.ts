/**
 * Utilities for handling pgvector columns in Supabase queries.
 *
 * Supabase/PostgREST doesn't always serialize pgvector columns correctly
 * when using `select('*')` or implicit column selection. This utility
 * provides parsing and serialization helpers to ensure vectors are
 * correctly handled as number arrays.
 */

/**
 * Parse a pgvector column value from a Supabase response.
 *
 * Handles multiple formats:
 * - Already a number[]: return as-is
 * - String "[0.1, 0.2, ...]": parse as JSON
 * - null/undefined: return null
 *
 * @param value - Raw value from database
 * @returns Parsed number array or null
 */
export function parseVector(value: unknown): number[] | null {
  if (!value) {
    return null
  }

  // Already a properly-formed number array
  if (Array.isArray(value)) {
    // Validate all elements are numbers
    if (value.every(v => typeof v === 'number' && !isNaN(v))) {
      return value
    }

    // Try to convert string/numeric elements
    try {
      const converted = value.map(v => {
        if (typeof v === 'number') return v
        if (typeof v === 'string') return parseFloat(v)
        return NaN
      })

      if (converted.every(v => !isNaN(v))) {
        return converted
      }
    } catch {
      // Fall through to null return
    }
  }

  // String format: "[0.1, 0.2, ...]" or "[[0.1, 0.2, ...]]" (nested)
  if (typeof value === 'string') {
    try {
      let parsed = JSON.parse(value)

      // Handle double-nested arrays (sometimes happens with pgvector)
      while (Array.isArray(parsed) && parsed.length === 1 && Array.isArray(parsed[0])) {
        parsed = parsed[0]
      }

      if (Array.isArray(parsed) && parsed.every(v => typeof v === 'number' && !isNaN(v))) {
        return parsed
      }
    } catch {
      // Malformed JSON, return null
      console.warn('[pgvector] Failed to parse vector string:', value.slice(0, 100))
    }
  }

  // Unrecognized format
  console.warn('[pgvector] Unrecognized vector format:', typeof value, Array.isArray(value) ? `array[${(value as any[]).length}]` : value)
  return null
}

/**
 * Serialize an embedding vector for insertion/update into pgvector column.
 *
 * Supabase accepts vectors as number[] arrays directly in most cases,
 * but this provides a consistent interface and validation.
 *
 * @param embedding - Number array to serialize
 * @returns The embedding array (pass-through for Supabase)
 */
export function serializeVector(embedding: number[]): number[] {
  if (!Array.isArray(embedding)) {
    throw new Error('[pgvector] Cannot serialize non-array as vector')
  }

  if (!embedding.every(v => typeof v === 'number' && !isNaN(v))) {
    throw new Error('[pgvector] Cannot serialize vector with non-numeric values')
  }

  return embedding
}

/**
 * Validate that a vector has the expected dimension.
 *
 * @param vector - Vector to validate
 * @param expectedDim - Expected dimension (e.g., 1536 for text-embedding-3-small)
 * @returns true if valid, false otherwise
 */
export function validateVectorDimension(vector: number[] | null, expectedDim: number): boolean {
  if (!vector) return false
  if (!Array.isArray(vector)) return false
  return vector.length === expectedDim
}

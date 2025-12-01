 // POST /api/plans - Create a new plan
import { NextRequest } from 'next/server'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createPlan } from '@/lib/db/queries/plans'
import { createPlanSchema } from '@/lib/utils/validation'
import { successResponse, handleError } from '@/lib/utils/api-response'
import { ValidationError } from '@/lib/utils/errors'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = createPlanSchema.safeParse(body)
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.errors)
    }

    const { planContext, title: providedTitle, description } = validation.data

    // Generate title from context if not provided
    let title = providedTitle
    if (!title) {
      try {
        const { text } = await generateText({
          model: openai('gpt-4o-mini'),
          prompt: `Generate a concise plan title (4-8 words, title case) from this description:\n\n"${planContext}"\n\nReturn ONLY the title, nothing else.`,
          maxOutputTokens: 20,
        })

        title = text.trim()
        if (!title) {
          // Fallback if LLM returns empty string
          const base = planContext.slice(0, 50).trim()
          title = base + (planContext.length > 50 ? '...' : '')
        }
      } catch (error) {
        console.error('Error generating plan title:', error)
        // Fallback: Use first 50 chars of context
        const base = planContext.slice(0, 50).trim()
        title = base + (planContext.length > 50 ? '...' : '')
      }
    }

    // Create plan with generated/manual title and stored context
    const plan = await createPlan({
      title,
      description: description ?? null,
      plan_context: planContext,
    })

    return successResponse(plan, 201)
  } catch (error) {
    return handleError(error)
  }
}

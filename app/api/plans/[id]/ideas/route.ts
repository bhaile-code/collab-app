 // GET /api/plans/:id/ideas - List all ideas for a plan
// POST /api/plans/:id/ideas - Create a new idea (with auto-classification & metadata extraction)
import { NextRequest } from 'next/server'
import { listIdeasByPlanId, createIdea, getIdeaById, updateIdea } from '@/lib/db/queries/ideas'
import { listBucketsByPlanId } from '@/lib/db/queries/buckets'
import { getPlanById } from '@/lib/db/queries/plans'
import { createIdeaSchema } from '@/lib/utils/validation'
import { successResponse, handleError } from '@/lib/utils/api-response'
import { ValidationError } from '@/lib/utils/errors'
import { extractMetadata } from '@/lib/services/metadata-extraction'
import { getBestLocation } from '@/lib/services/llm-metadata'
import { createEmergentBuckets, classifyIdeaIntoBucket } from '@/lib/services/auto-classification'
import { geocodeLocation } from '@/lib/services/geocoding'
import { fetchLinkPreview } from '@/lib/services/link-preview'
import { rateLimit } from '@/lib/utils/rate-limit'
import { generateEmbedding } from '@/lib/services/embeddings'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: planId } = await params
    const ideas = await listIdeasByPlanId(planId)
    return successResponse(ideas)
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  // Rate limit: 10 ideas per minute
  if (!rateLimit(request, 10, 60000)) {
    return new Response(
      JSON.stringify({
        data: null,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many ideas created. Please wait a moment and try again.'
        }
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    const { id: planId } = await params
    const body = await request.json()

    // Validate request body
    const validation = createIdeaSchema.safeParse(body)
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.errors)
    }

    const { title, description, bucketId, location, date, budget, confidence, attachments } = validation.data

    // Create idea (may start unbucketed if auto-classifying)
    const idea = await createIdea({
      plan_id: planId,
      title,
      description,
      bucket_id: bucketId ?? null,
      location: location ?? null,
      date: date ?? null,
      budget: budget ?? null,
      confidence: confidence ?? 85,
      created_by: null, // TODO: Get from session in a later phase
      latitude: null,
      longitude: null,
      geocoded_place_name: null,
      link_preview_json: null,
      attachments: attachments ?? undefined,
    })

    // Generate and persist idea embedding (best-effort, non-fatal on failure)
    try {
      const embeddingText = `${idea.title}\n${idea.description ?? ''}`.trim()
      if (embeddingText) {
        const embedding = await generateEmbedding(embeddingText)
        await updateIdea(idea.id, { embedding })
      }
    } catch (error) {
      console.error('Failed to generate embedding for idea', { ideaId: idea.id, planId }, error)
    }

    // Background metadata enrichment (non-blocking)
    // Only run for fields the user did not explicitly provide
    ;(async () => {
      try {
        const needsLocation = !idea.location
        const needsDate = !idea.date
        const needsBudget = !idea.budget

        if (!needsLocation && !needsDate && !needsBudget) {
          // Still may want link previews even if user provided everything else
          // but for now, keep behavior simple and skip work entirely.
          return
        }

        const metadata = await extractMetadata(description)

        // Determine best location text
        let bestLocation: string | null = null
        if (needsLocation) {
          bestLocation = await getBestLocation(description)
        }

        const resolvedLocation: string | null =
          needsLocation ? bestLocation ?? metadata.locations[0] ?? null : idea.location

        // Geocode if we have a location string
        let coords: { lat: number; lng: number; placeName: string } | null = null
        if (resolvedLocation) {
          coords = await geocodeLocation(resolvedLocation)
        }

        // Link preview for first URL, if any
        let preview: any = null
        if (metadata.urls.length > 0) {
          preview = await fetchLinkPreview(metadata.urls[0])
        }

        await updateIdea(idea.id, {
          location: needsLocation ? resolvedLocation : undefined,
          date: needsDate ? metadata.dates[0] ?? null : undefined,
          budget: needsBudget ? metadata.budgets[0] ?? null : undefined,
          latitude: coords ? coords.lat : undefined,
          longitude: coords ? coords.lng : undefined,
          geocoded_place_name: coords ? coords.placeName : undefined,
          link_preview_json: preview ?? undefined,
        })
      } catch (error) {
        console.error('Background metadata extraction failed:', error)
      }
    })()

    // Auto-classification logic (only when bucketId is not explicitly provided)
    if (!bucketId) {
      const existingIdeas = await listIdeasByPlanId(planId)
      const existingBuckets = await listBucketsByPlanId(planId)
      const plan = await getPlanById(planId)

      console.log(
        `Auto-classification check for idea ${idea.id} in plan ${planId} - existingIdeas=${existingIdeas.length}, existingBuckets=${existingBuckets.length}`,
      )

      if (existingIdeas.length >= 2 && existingBuckets.length === 0) {
        // First-time bucket creation: batch analyze all ideas
        console.log(`Creating emergent buckets for plan ${planId} (${existingIdeas.length} ideas)`)

        // Debounce to batch near-simultaneous adds
        await new Promise((resolve) => setTimeout(resolve, 3000))

        // Re-fetch in case more ideas were added during debounce
        const allIdeas = await listIdeasByPlanId(planId)

        const buckets = await createEmergentBuckets(
          planId,
          allIdeas,
          plan.plan_context ?? undefined,
        )

        console.log(`Created ${buckets.length} emergent buckets via LLM`)
      }

      if (existingBuckets.length > 0) {
        // Subsequent ideas: classify into existing buckets or create new
        console.log(`Classifying idea ${idea.id} into existing buckets for plan ${planId}`)

        const classification = await classifyIdeaIntoBucket(
          idea,
          existingBuckets,
          plan.plan_context ?? undefined,
        )

        await updateIdea(idea.id, {
          bucket_id: classification.bucketId,
          confidence: classification.confidence,
        })

        if (classification.isNewBucket) {
          console.log(`Created new bucket for idea ${idea.id}`)
        }
      }
      // If only 1 idea and 0 buckets, leave unbucketed (floating card state)
    }

    // Re-fetch idea to get any updated bucket assignment
    const updatedIdea = await getIdeaById(idea.id)

    return successResponse(updatedIdea, 201)
  } catch (error) {
    return handleError(error)
  }
}

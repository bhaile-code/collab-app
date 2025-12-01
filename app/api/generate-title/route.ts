import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export async function POST(request: Request) {
  try {
    const { description } = await request.json()

    if (!description || typeof description !== "string") {
      return Response.json({ error: "Description is required" }, { status: 400 })
    }

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `Generate a short, concise title (max 6 words) for the following idea. Return only the title, nothing else.

Idea: ${description}`,
      maxOutputTokens: 20,
    })

    return Response.json({ title: text.trim() })
  } catch (error) {
    console.error("Error generating title:", error)

    // Log more details for debugging
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      })
    }

    return Response.json({
      error: "Failed to generate title",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

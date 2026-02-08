import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { contentURI, bountyId } = await request.json();

    if (!contentURI || bountyId === undefined) {
      return NextResponse.json({ error: "contentURI and bountyId required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `You are a content quality judge for a creator bounty platform called BountySwipe.
Analyze this content submission and provide:
1. A quality score from 0-100
2. A recommendation: "upvote" or "downvote"
3. A brief reason (1 sentence)

Content URI: ${contentURI}
Bounty ID: ${bountyId}

Respond ONLY in JSON format: { "score": number, "recommendation": "upvote" | "downvote", "reason": "string" }`
        }]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", errorText);
      return NextResponse.json({ error: "AI analysis failed" }, { status: 500 });
    }

    const claudeResponse = await response.json();
    const analysisText = claudeResponse.content[0].text;

    // Parse JSON from Claude's response (handle potential markdown wrapping)
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 50, recommendation: "upvote", reason: "Unable to parse analysis" };

    return NextResponse.json({
      bountyId,
      contentURI,
      analysis,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

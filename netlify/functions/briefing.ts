/**
 * Her AI Hour™ — The Briefing function
 *
 * Calls the Anthropic API with web_search tool to generate 5 daily briefing
 * cards from REAL current headlines, filtered through a female leadership lens.
 * Caches the result in Netlify Blobs for 6 hours so the API is only hit 4
 * times per day, regardless of how many people visit.
 *
 * GET /.netlify/functions/briefing
 *   → returns: { date, refreshedAt, cards: [...] }
 *
 * Architecture:
 *   1. Check Netlify Blobs cache for a briefing < 6 hours old
 *   2. If found → return cached briefing (zero API cost, sub-second response)
 *   3. If not found → call Anthropic with web search, save to cache, return fresh briefing
 */

import { getStore } from "@netlify/blobs";
import Anthropic from "@anthropic-ai/sdk";

// 6 hours, expressed in milliseconds.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `You are the editorial intelligence behind Her AI Hour™, a platform built for women in senior leadership who are navigating the AI moment with intention.

You have access to a web_search tool. You MUST use it to find REAL, CURRENT news stories from the last 7 days before generating the briefing.

HONESTY AND ATTRIBUTION — non-negotiable:
- You are producing an EDITORIAL SYNTHESIS, not reproducing exact headlines.
- The "headline" field is YOUR editorial summary of what the real story is about — written clearly and accurately, not copied verbatim from the source.
- The "source" field must be the real publication you found the story in (e.g. "Reuters", "Financial Times", "Bloomberg").
- The "body" field must accurately summarize what the real article actually reported. Do not add facts, statistics, or quotes that were not in the source.
- If a statistic appears in your body text, it must have been in the real article you found.
- Never fabricate a source, a quote, a statistic, or an event. If you cannot find a real verifiable story for a category, say so rather than inventing one.
- Think of each card as: "Based on reporting from [source], here is what happened and why it matters to you."

RESEARCH PROCESS — follow this exactly:
1. Search for recent AI news in each of the 5 categories below
2. Find ONE real, verifiable story per category from the last 7 days
3. Accurately summarize what that story actually reported
4. Add the leadership lens and action question — those are YOUR editorial voice, clearly separate from the reported facts

Each card MUST cover ONE of these five categories, in this exact order:
1. PEOPLE — talent, hiring, leadership shifts, gender + AI workforce dynamics
2. STRATEGY — how AI is reshaping competitive advantage, the work of leadership itself
3. POLICY — regulation, governance, legal, EU/US/global frameworks
4. MARKET — adoption data, investment, M&A, market sizing
5. TECH — capability releases, model updates, infrastructure shifts

EDITORIAL VOICE for lens and action fields:
- Speak to a senior woman as a peer, not a student. Assume fluency.
- The "lens" is your editorial read on what this means for her specifically.
- The "action" is ONE concrete question she can take into a real conversation this week.
- Tone: clear, considered, never breathless. More like: "Notice this. Here is what it means. Here is the move."

Return ONLY valid JSON in this exact shape, no markdown fences, no preamble:
{
  "cards": [
    {
      "tag": "People",
      "source": "Exact publication name e.g. Reuters, Bloomberg, WSJ",
      "headline": "Your accurate editorial summary of the real story — under 130 characters.",
      "body": "Two to three sentences accurately summarizing what the real article reported. Only include facts that were in the source.",
      "lens": "One to two sentences of your editorial perspective. Speak directly to her in second person.",
      "action": "Single sentence framed as a question she could ask someone this week."
    }
  ]
}

Constraints:
- EXACTLY 5 cards, no more, no less
- Tags must be exactly: People, Strategy, Policy, Market, Tech (case-sensitive)
- Source must be the real publication you found the story in
- Headlines are editorial summaries — accurate but not verbatim quotes from the source
- Body text must only contain facts that appeared in the real source article
- No fabrication of any kind — ever
- No mention of "Her AI Hour" inside the card content itself`;

export default async (req: Request) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const store = getStore("briefing-cache");
  const now = Date.now();

  // ── Cache check ──────────────────────────────────────────────
  try {
    const cached = await store.get("latest", { type: "json" });
    if (cached && cached.refreshedAtMs && (now - cached.refreshedAtMs) < CACHE_TTL_MS) {
      return jsonResponse({
        date: cached.date,
        refreshedAt: cached.refreshedAt,
        cards: cached.cards,
        source: "cache",
      });
    }
  } catch (e) {
    console.warn("Cache read failed, generating fresh:", e);
  }

  // ── Fresh generation with web search ─────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonError("Server is missing API configuration.", 500);
  }

  const client = new Anthropic({ apiKey });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });

  const userPrompt = `Today is ${today}.

Use your web_search tool to find 5 REAL current AI and leadership news stories from the last 7 days — one per category (People, Strategy, Policy, Market, Tech). Search specifically for:
1. "AI workforce women leadership 2026"
2. "AI strategy CEO enterprise 2026"  
3. "AI regulation policy 2026"
4. "AI market investment funding 2026"
5. "AI model release update 2026"

After searching and finding real stories, generate the 5-card Briefing JSON. Only include stories you actually found through search. Return only the JSON object.`;

  let cards;
  try {
    // Use web_search tool for real current headlines
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      tools: [
        {
          type: "web_search_20250305" as any,
          name: "web_search",
        }
      ],
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Extract the final text response (after tool use)
    let finalText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        finalText = block.text;
      }
    }

    // Handle multi-turn tool use if needed
    if (response.stop_reason === "tool_use") {
      // Continue the conversation to get the final JSON
      const toolResults = response.content
        .filter((b: any) => b.type === "tool_use")
        .map((b: any) => ({
          type: "tool_result" as const,
          tool_use_id: b.id,
          content: "Search completed.",
        }));

      const continuation = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        tools: [
          {
            type: "web_search_20250305" as any,
            name: "web_search",
          }
        ],
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: userPrompt },
          { role: "assistant", content: response.content },
          { role: "user", content: toolResults },
        ],
      });

      for (const block of continuation.content) {
        if (block.type === "text") {
          finalText = block.text;
        }
      }
    }

    if (!finalText) {
      throw new Error("No text content in API response");
    }

    // Strip any accidental code fences before parsing
    const raw = finalText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    // Find the JSON object in the response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed.cards) || parsed.cards.length !== 5) {
      throw new Error("Response did not contain exactly 5 cards");
    }

    cards = parsed.cards;
  } catch (e: any) {
    console.error("Briefing generation failed:", e);
    return jsonResponse({
      cards: [],
      error: "generation-failed",
      message: e.message,
      source: "error",
    });
  }

  // ── Save to cache ────────────────────────────────────────────
  const refreshedAt = new Date().toISOString();
  const payload = {
    date: today,
    refreshedAt,
    refreshedAtMs: now,
    cards,
  };

  try {
    await store.setJSON("latest", payload);
  } catch (e) {
    console.warn("Cache write failed:", e);
  }

  return jsonResponse({
    date: today,
    refreshedAt,
    cards,
    source: "fresh",
  });
};

// ── Helpers ─────────────────────────────────────────────────────
function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function jsonError(message: string, status: number) {
  return jsonResponse({ error: message }, status);
}

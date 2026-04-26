/**
 * Her AI Hour™ — The Briefing function
 *
 * Calls the Anthropic API to generate 5 daily briefing cards filtered through
 * a female leadership lens. Caches the result in Netlify Blobs for 6 hours
 * so the API is only hit 4 times per day, regardless of how many people visit.
 *
 * GET /.netlify/functions/briefing
 *   → returns: { date, refreshedAt, cards: [...] }
 *
 * Architecture:
 *   1. Check Netlify Blobs cache for a briefing < 6 hours old
 *   2. If found → return cached briefing (zero API cost, sub-second response)
 *   3. If not found → call Anthropic, save to cache, return fresh briefing
 *
 * Cost expectation: ~$10/month on Claude Sonnet 4.6, regardless of traffic.
 */

import { getStore } from "@netlify/blobs";
import Anthropic from "@anthropic-ai/sdk";

// 6 hours, expressed in milliseconds. The Briefing tagline on the page
// promises "updated every 6 hours" — this constant is the source of truth.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `You are the editorial intelligence behind Her AI Hour™, a platform built for women in senior leadership who are navigating the AI moment with intention.

Your job: produce a Daily Briefing of EXACTLY 5 cards that a senior woman should know about today. The Briefing is read in the morning by women in the C-suite, board rooms, founder seats, and consulting partnerships.

Each card MUST cover ONE of these five categories, in this exact order:
1. PEOPLE — talent, hiring, leadership shifts, gender + AI workforce dynamics
2. STRATEGY — how AI is reshaping competitive advantage, the work of leadership itself
3. POLICY — regulation, governance, legal, EU/US/global frameworks
4. MARKET — adoption data, investment, M&A, market sizing
5. TECH — capability releases, model updates, infrastructure shifts

EDITORIAL VOICE — non-negotiable:
- Speak to a senior woman as a peer, not a student. Assume fluency.
- No jargon without earning it. No technical condescension.
- Every story must connect to leadership decisions, not engineering details.
- The "Leadership Lens" is HER private read on what this means — written as if a thoughtful peer is whispering insight in her ear.
- The "Action" is ONE concrete question she can take into a real conversation this week (her CHRO, her board, her team, her counsel).
- Tone: clear, considered, never breathless. Never "OMG this changes everything." More like: "Notice this. Here's what it means. Here's the move."

Return ONLY valid JSON in this exact shape, no markdown fences, no preamble:
{
  "cards": [
    {
      "tag": "People",
      "source": "publication or org name",
      "headline": "Single declarative sentence under 130 characters.",
      "body": "Two to three sentences. Specific. Concrete. The story behind the headline.",
      "lens": "One to two sentences in the editorial voice above. Speak to her directly, second person.",
      "action": "Single sentence framed as a question she could ask, starting with the verb (Ask, In your, Before, etc.)."
    },
    ... 4 more cards in the order: Strategy, Policy, Market, Tech
  ]
}

Constraints:
- EXACTLY 5 cards, no more, no less
- Tags must be exactly: People, Strategy, Policy, Market, Tech (case-sensitive)
- Source must be a real, attributable publication or institution
- Stories must be plausibly recent (within the last week)
- No mention of "Her AI Hour" inside the card content itself`;

export default async (req: Request) => {
  // Only respond to GET — anything else gets a 405
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const store = getStore("briefing-cache");
  const now = Date.now();

  // ── Cache check ─────────────────────────────────────────────
  // If we have a briefing less than 6 hours old, serve it immediately.
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
    // If cache read fails for any reason, fall through to fresh generation.
    // We never want a cache miss to break the page.
    console.warn("Cache read failed, generating fresh:", e);
  }

  // ── Fresh generation ─────────────────────────────────────────
  // Cache miss or stale. Call Anthropic to generate new cards.
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

Generate today's 5-card Briefing covering the most consequential AI + leadership stories a senior woman would want to know walking into her week. Pull from real recent developments. Keep voice and structure exactly as the system prompt specifies. Return only the JSON object.`;

  let cards;
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Find the first text block in the response
    const textBlock = response.content.find((b: any) => b.type === "text");
    if (!textBlock || !("text" in textBlock)) {
      throw new Error("No text content in API response");
    }

    // Strip any accidental code fences before parsing
    const raw = textBlock.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed.cards) || parsed.cards.length !== 5) {
      throw new Error("Response did not contain exactly 5 cards");
    }

    cards = parsed.cards;
  } catch (e: any) {
    console.error("Briefing generation failed:", e);
    // Don't return a 500 — let the page fall back to its static cards.
    // We still return 200 with a flag so the page knows.
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
    // Cache write failure is non-fatal — we still return the fresh result.
    console.warn("Cache write failed:", e);
  }

  return jsonResponse({
    date: today,
    refreshedAt,
    cards,
    source: "fresh",
  });
};

// ── Helpers ────────────────────────────────────────────────────
function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Tell browsers and CDNs to cache for 6 hours too
      "Cache-Control": "public, max-age=21600, s-maxage=21600",
    },
  });
}

function jsonError(message: string, status: number) {
  return jsonResponse({ error: message }, status);
}

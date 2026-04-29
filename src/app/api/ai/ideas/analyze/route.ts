import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type RelatedIdeaInput = {
  id: string;
  title: string;
  content: string;
  tags: string[];
};

type AnalyzeRequest = {
  idea: RelatedIdeaInput;
  ideas?: RelatedIdeaInput[];
};

const MAX_RELATED_IDEAS = 24;

function readLocalMiniMaxEnv(name: "MINIMAX_API_KEY" | "MINIMAX_MODEL" | "MINIMAX_BASE_URL") {
  try {
    const envText = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    const pattern =
      name === "MINIMAX_API_KEY"
        ? /^\s*MINIMAX(?:_|\s+)API(?:_|\s+)KEY\s*=\s*(.+)$/im
        : name === "MINIMAX_MODEL"
          ? /^\s*MINIMAX(?:_|\s+)MODEL\s*=\s*(.+)$/im
          : /^\s*MINIMAX(?:_|\s+)BASE(?:_|\s+)URL\s*=\s*(.+)$/im;
    const value = envText.match(pattern)?.[1]?.trim();
    return value ? value.replace(/\s+/g, "_") : undefined;
  } catch {
    return undefined;
  }
}

function compactText(value: unknown, maxLength = 900) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanArray(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim().replace(/^#/, ""))
        .filter(Boolean),
    ),
  ).slice(0, limit);
}

function parseJsonPayload(content: string) {
  const withoutThinking = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = withoutThinking.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced ?? withoutThinking;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("AI response is not JSON.");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function POST(request: Request) {
  const apiKey = process.env.MINIMAX_API_KEY || readLocalMiniMaxEnv("MINIMAX_API_KEY");
  const baseUrl = (process.env.MINIMAX_BASE_URL || readLocalMiniMaxEnv("MINIMAX_BASE_URL") || "https://api.minimaxi.com/v1").replace(/\/$/, "");
  if (!apiKey) {
    return NextResponse.json({ error: "MiniMax API key is not configured." }, { status: 500 });
  }

  const body = (await request.json()) as AnalyzeRequest;
  if (!body.idea?.id || !compactText(body.idea.content, 2000)) {
    return NextResponse.json({ error: "Idea content is required." }, { status: 400 });
  }

  const candidates = (body.ideas ?? [])
    .filter((idea) => idea.id !== body.idea.id)
    .slice(0, MAX_RELATED_IDEAS)
    .map((idea) => ({
      id: idea.id,
      title: compactText(idea.title, 80),
      content: compactText(idea.content, 260),
      tags: cleanArray(idea.tags, 8),
    }));

  const prompt = {
    task: "Analyze a personal idea note for a private knowledge workspace. Return strict JSON only.",
    output_schema: {
      summary: "one concise Chinese sentence",
      keywords: ["3-8 short Chinese keywords without #"],
      topics: ["1-4 broader topic clusters"],
      urgency: "one of now | soon | later | archive",
      related_ids: ["ids from candidate_ideas only, max 5"],
      suggested_actions: ["2-5 concrete next actions in Chinese"],
    },
    idea: {
      id: body.idea.id,
      title: compactText(body.idea.title, 120),
      content: compactText(body.idea.content, 1800),
      tags: cleanArray(body.idea.tags, 12),
    },
    candidate_ideas: candidates,
    rules: [
      "Prefer useful, compact tags over generic words.",
      "Only use ids that appear in candidate_ideas for related_ids.",
      "Do not invent personal facts.",
      "Return JSON without markdown fences.",
    ],
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.MINIMAX_MODEL || readLocalMiniMaxEnv("MINIMAX_MODEL") || "MiniMax-M2.7",
      messages: [
        {
          role: "system",
          content: "You organize personal notes into concise Chinese knowledge metadata. You always return valid JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify(prompt),
        },
      ],
      temperature: 0.2,
      max_tokens: 900,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: "MiniMax request failed.", detail: detail.slice(0, 500) }, { status: response.status });
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    return NextResponse.json({ error: "MiniMax returned an empty response." }, { status: 502 });
  }

  try {
    const parsed = parseJsonPayload(content);
    const relatedIds = cleanArray(parsed.related_ids, 5).filter((id) => candidates.some((idea) => idea.id === id));
    const urgency = ["now", "soon", "later", "archive"].includes(parsed.urgency) ? parsed.urgency : "later";
    return NextResponse.json({
      summary: String(parsed.summary ?? "").trim().slice(0, 180),
      keywords: cleanArray(parsed.keywords, 8),
      topics: cleanArray(parsed.topics, 4),
      urgency,
      related_ids: relatedIds,
      suggested_actions: cleanArray(parsed.suggested_actions, 5),
      analyzed_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "MiniMax response could not be parsed.", detail: error instanceof Error ? error.message : "Invalid JSON." },
      { status: 502 },
    );
  }
}

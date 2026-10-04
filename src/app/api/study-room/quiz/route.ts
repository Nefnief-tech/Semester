import { getDocuments } from "@/lib/server/storage";
import { userInAiTeam, verifyUser } from "@/lib/server/auth";
import { chatCompletions, extractJson, resolveAIConfig } from "@/lib/server/ai";

export const runtime = "nodejs";

const MAX_PER_DOC = 30_000;
const MAX_TOTAL = 90_000;

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
}

/** generates a multiple-choice quiz from the given documents */
export async function POST(req: Request) {
  // signed-in users only — this route spends AI credits
  const user = await verifyUser(req);
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });

  // AI is gated to the `ai` Appwrite team — members only
  if (!(await userInAiTeam(req))) {
    return Response.json({ error: "ai_locked" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { documentIds?: string[] } | null;
  const ids = Array.isArray(body?.documentIds) ? body!.documentIds : [];
  if (ids.length === 0) {
    return Response.json({ error: "no_documents" }, { status: 400 });
  }

  const config = resolveAIConfig();
  if (!config) {
    return Response.json({ error: "not_configured" }, { status: 501 });
  }

  const docs = await getDocuments(ids);
  if (docs.length === 0) {
    return Response.json({ error: "documents_not_found" }, { status: 404 });
  }

  // stitch the material together, trimming so the prompt stays within budget
  let budget = MAX_TOTAL;
  const parts: string[] = [];
  for (const doc of docs) {
    const slice = doc.text.slice(0, Math.min(MAX_PER_DOC, budget));
    budget -= slice.length;
    parts.push(`# Document: ${doc.name}\n\n${slice}${slice.length < doc.text.length ? "\n\n[truncated]" : ""}`);
    if (budget <= 0) break;
  }
  const material = parts.join("\n\n---\n\n");

  const upstream = await chatCompletions(config, [
    {
      role: "system",
      content:
        "You create multiple-choice quizzes from the student's course material. " +
        "Respond ONLY with JSON of the shape " +
        '{"questions": [{"question": string, "options": [string, string, string, string], "answer": 0, "explanation": string}]} ' +
        "— no prose around it. `answer` is the zero-based index of the correct option. " +
        "Create 5 to 10 questions depending on how much material there is. " +
        "Exactly four options per question, exactly one correct, distractors plausible " +
        "but clearly wrong to someone who knows the material. " +
        "Cover the key concepts, definitions, formulas and facts; skip trivia. " +
        "`explanation` is one short sentence saying why the answer is right. " +
        "Write in the same language as the material.",
    },
    { role: "user", content: `Material:\n\n${material}` },
  ]);

  if (!upstream.ok) {
    return Response.json(
      { error: "ai_error", detail: (await upstream.text()).slice(0, 300) },
      { status: 502 },
    );
  }

  const raw = (await upstream.json().catch(() => null))?.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson<{ questions?: Array<Record<string, unknown>> }>(raw ?? "");

  const questions: QuizQuestion[] = (parsed?.questions ?? [])
    .map((q) => {
      const options = Array.isArray(q.options) ? q.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0) : [];
      const answer = Number(q.answer);
      return {
        question: typeof q.question === "string" ? q.question.trim() : "",
        options: options.slice(0, 4),
        answer: Number.isInteger(answer) && answer >= 0 && answer < 4 ? answer : -1,
        explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
      };
    })
    .filter(
      (q) =>
        q.question.length > 0 &&
        q.options.length === 4 &&
        new Set(q.options).size === 4 &&
        q.answer >= 0,
    )
    .slice(0, 12);

  if (questions.length === 0) {
    return Response.json({ error: "generation_failed" }, { status: 502 });
  }

  return Response.json({ questions } satisfies { questions: QuizQuestion[] });
}

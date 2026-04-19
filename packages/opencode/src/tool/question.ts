import z from "zod"
import { Tool } from "./tool"
import { Question } from "../question"
import DESCRIPTION from "./question.txt"

function normalizeSingleQuestion(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw
  const q = { ...(raw as Record<string, unknown>) }
  if (typeof q.question === "string" && typeof q.header !== "string") {
    q.header = q.question.slice(0, 30)
  }
  if (Array.isArray(q.options)) {
    q.options = q.options.map((opt) => {
      if (typeof opt === "string") return { label: opt, description: opt }
      if (opt && typeof opt === "object") {
        const o = opt as Record<string, unknown>
        const label = typeof o.label === "string" ? o.label : typeof o.value === "string" ? o.value : undefined
        const description =
          typeof o.description === "string"
            ? o.description
            : typeof o.detail === "string"
              ? o.detail
              : typeof o.explanation === "string"
                ? o.explanation
                : typeof label === "string"
                  ? label
                  : undefined
        if (label !== undefined) return { ...o, label, description: description ?? label }
      }
      return opt
    })
  }
  return q
}

function normalizeQuestionInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw
  const obj = { ...(raw as Record<string, unknown>) }
  if (!Array.isArray(obj.questions) && typeof obj.question === "string") {
    return { questions: [normalizeSingleQuestion(obj)] }
  }
  if (Array.isArray(obj.questions)) {
    obj.questions = obj.questions.map(normalizeSingleQuestion)
  }
  return obj
}

const SCHEMA_HINT = [
  "[schema-miss:question] Retry with exactly this shape:",
  "```json",
  "{",
  '  "questions": [',
  "    {",
  '      "question": "<full question text>",',
  '      "header": "<short label, ≤30 chars>",',
  '      "options": [',
  '        { "label": "<1-5 word display>", "description": "<explanation>" }',
  "      ],",
  '      "multiple": false',
  "    }",
  "  ]",
  "}",
  "```",
  "Common mistakes we auto-normalize (so these should now work): single flat question without the outer `questions` array; `options` as plain `string[]`; missing `header`. If you still hit this message, check: (1) `questions` must be an array even for one question; (2) each option must be an OBJECT with `label`+`description`, not a bare string (we try to coerce, but only if the shape is recognizable).",
].join("\n")

export const QuestionTool = Tool.define("question", {
  description: DESCRIPTION,
  parameters: z.preprocess(
    normalizeQuestionInput,
    z.object({
      questions: z.array(Question.Info.omit({ custom: true })).describe("Questions to ask"),
    }),
  ),
  formatValidationError: () => SCHEMA_HINT,
  async execute(params, ctx) {
    const answers = await Question.ask({
      sessionID: ctx.sessionID,
      questions: params.questions,
      tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
      abort: ctx.abort,
    })

    function format(answer: Question.Answer | undefined) {
      if (!answer?.length) return "Unanswered"
      return answer.join(", ")
    }

    const formatted = params.questions.map((q, i) => `"${q.question}"="${format(answers[i])}"`).join(", ")

    return {
      title: `Asked ${params.questions.length} question${params.questions.length > 1 ? "s" : ""}`,
      output: `User has answered your questions: ${formatted}. You can now continue with the user's answers in mind.`,
      metadata: {
        answers,
      },
    }
  },
})

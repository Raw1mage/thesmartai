import { MessageV2 } from "./message-v2"
import { Session } from "."
import { Agent } from "../agent/agent"

function isExperimentalPlanMode() {
  const value = process.env.OPENCODE_EXPERIMENTAL_PLAN_MODE?.toLowerCase()
  return value === "1" || value === "true"
}

function buildPlanReminder() {
  const lines = [
    "<system-reminder>",
    "# Plan Mode - System Reminder",
    "",
    "Plan mode is active. Keep the planning discussion aligned with the active planner artifacts and preserve the current plan/build contract.",
    "",
    "Default to MCP question with structured multiple-choice options for bounded planning decisions.",
    "Do not ask plain conversational clarification when a structured question choice would work.",
  ]
  if (!isExperimentalPlanMode()) {
    lines.push("", "Use the implementation spec and companion artifacts under /plans as the active planning workspace.")
  }
  lines.push("</system-reminder>")
  return lines.join("\n")
}

export async function insertReminders(input: {
  messages: MessageV2.WithParts[]
  agent: Agent.Info
  session: Session.Info
}) {
  if (input.agent.name !== "plan") return input.messages
  const target = [...input.messages]
    .reverse()
    .find((message) => message.info.role === "user" && message.info.agent === "plan")
  if (!target) return input.messages
  if (
    target.parts.some(
      (part) => part.type === "text" && part.synthetic && part.text.includes("# Plan Mode - System Reminder"),
    )
  ) {
    return input.messages
  }
  target.parts.push({
    id: `part_plan_reminder_${target.info.id}`,
    sessionID: target.info.sessionID,
    messageID: target.info.id,
    type: "text",
    text: buildPlanReminder(),
    synthetic: true,
  } satisfies MessageV2.TextPart)
  return input.messages
}

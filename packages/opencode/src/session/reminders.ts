import { MessageV2 } from "./message-v2"
import { Session } from "."
import { Agent } from "../agent/agent"

export async function insertReminders(input: {
  messages: MessageV2.WithParts[]
  agent: Agent.Info
  session: Session.Info
}) {
  // Plan methodology is now part of SYSTEM.md §2.5 (Orchestrator-only).
  // No per-turn injection needed — the Orchestrator always has it.
  return input.messages
}

import path from "path"
import { Instance } from "@/project/instance"
import { Session } from "./index"

function resolveArtifactPath(relativeOrAbsolute: string) {
  return path.isAbsolute(relativeOrAbsolute) ? relativeOrAbsolute : path.join(Instance.worktree, relativeOrAbsolute)
}

function extractSection(markdown: string, heading: string) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = markdown.match(new RegExp(`(^|\\n)##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i"))
  return match?.[2]?.trim() ?? ""
}

function extractBulletItems(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
}

function extractChecklistItems(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /^-\s*\[[ xX]\]\s+/.test(line))
    .map((line) => line.replace(/^-\s*\[[ xX]\]\s+/, "").trim())
    .filter(Boolean)
}

async function readRequiredArtifact(filePath: string, label: string, issues: string[]) {
  const absolutePath = resolveArtifactPath(filePath)
  const file = Bun.file(absolutePath)
  if (!(await file.exists())) {
    issues.push(`${label} missing: ${filePath}`)
    return { absolutePath, text: "" }
  }
  const text = await file.text().catch(() => "")
  if (!text.trim()) {
    issues.push(`${label} empty: ${filePath}`)
  }
  return { absolutePath, text }
}

export type MissionConsumptionTrace = {
  source: "openspec_compiled_plan"
  contract: "implementation_spec"
  planPath: string
  consumedArtifacts: {
    implementationSpec: string
    tasks: string
    handoff: string
  }
  goal: string
  scopeSummary: string
  validationChecks: string[]
  executionChecklist: string[]
  requiredReads: string[]
  stopGates: string[]
}

export type MissionConsumptionResult =
  | {
      ok: true
      trace: MissionConsumptionTrace
    }
  | {
      ok: false
      issues: string[]
      consumedArtifacts: {
        implementationSpec: string
        tasks: string
        handoff: string
      }
    }

export async function consumeMissionArtifacts(mission: Session.Info["mission"]): Promise<MissionConsumptionResult> {
  if (!mission) {
    return {
      ok: false,
      issues: ["mission missing"],
      consumedArtifacts: {
        implementationSpec: "",
        tasks: "",
        handoff: "",
      },
    }
  }

  const issues: string[] = []
  const implementationSpec = await readRequiredArtifact(
    mission.artifactPaths.implementationSpec,
    "implementationSpec",
    issues,
  )
  const tasks = await readRequiredArtifact(mission.artifactPaths.tasks, "tasks", issues)
  const handoff = await readRequiredArtifact(mission.artifactPaths.handoff, "handoff", issues)

  const goal = extractSection(implementationSpec.text, "Goal")
  const scope = extractSection(implementationSpec.text, "Scope")
  const validation = extractSection(implementationSpec.text, "Validation")
  const stopGates = extractSection(implementationSpec.text, "Stop Gates")
  const checklistItems = extractChecklistItems(tasks.text)
  const requiredReads = extractBulletItems(extractSection(handoff.text, "Required Reads"))
  const handoffStopGates = extractBulletItems(extractSection(handoff.text, "Stop Gates In Force"))

  if (!goal) issues.push("implementationSpec missing Goal section")
  if (!scope) issues.push("implementationSpec missing Scope section")
  if (!validation) issues.push("implementationSpec missing Validation section")
  if (!stopGates) issues.push("implementationSpec missing Stop Gates section")
  if (checklistItems.length === 0) issues.push("tasks missing checklist items")
  if (requiredReads.length === 0) issues.push("handoff missing Required Reads items")
  if (handoffStopGates.length === 0) issues.push("handoff missing Stop Gates In Force items")

  if (issues.length > 0) {
    return {
      ok: false,
      issues,
      consumedArtifacts: {
        implementationSpec: mission.artifactPaths.implementationSpec,
        tasks: mission.artifactPaths.tasks,
        handoff: mission.artifactPaths.handoff,
      },
    }
  }

  return {
    ok: true,
    trace: {
      source: mission.source,
      contract: mission.contract,
      planPath: mission.planPath,
      consumedArtifacts: {
        implementationSpec: mission.artifactPaths.implementationSpec,
        tasks: mission.artifactPaths.tasks,
        handoff: mission.artifactPaths.handoff,
      },
      goal,
      scopeSummary: scope
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 4)
        .join(" | "),
      validationChecks: extractBulletItems(validation),
      executionChecklist: checklistItems,
      requiredReads,
      stopGates: handoffStopGates,
    },
  }
}

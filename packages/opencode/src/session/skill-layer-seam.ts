import type { SkillLayerEntry } from "./skill-layer-registry"

export function buildSkillLayerRegistrySystemPart(skillLayerEntries: SkillLayerEntry[]) {
  const fullEntries = skillLayerEntries.filter((entry) => entry.desiredState === "full")
  const summaryEntries = skillLayerEntries.filter((entry) => entry.desiredState === "summary" && entry.residue)

  const fullText = fullEntries
    .map(
      (entry) =>
        `<skill_layer name="${entry.name}" state="full" pinned="${entry.pinned}" reason="${entry.lastReason}">\n${entry.content}\n</skill_layer>`,
    )
    .join("\n\n")

  const summaryText = summaryEntries
    .map((entry) => {
      const residue = entry.residue!
      const keepRules = residue.keepRules.length ? residue.keepRules.map((rule) => `- ${rule}`).join("\n") : "- none"
      return [
        `<skill_layer_summary name="${residue.skillName}" state="summary" pinned="${entry.pinned}" reason="${residue.lastReason}">`,
        `purpose: ${residue.purpose}`,
        `keepRules:\n${keepRules}`,
        `loadedAt: ${residue.loadedAt}`,
        `lastUsedAt: ${residue.lastUsedAt}`,
        `</skill_layer_summary>`,
      ].join("\n")
    })
    .join("\n\n")

  const text = [fullText, summaryText].filter(Boolean).join("\n\n")

  return {
    key: "skill_layer_registry",
    name: "Skill 層",
    policy:
      skillLayerEntries.length > 0
        ? `registry_seam_loaded:${skillLayerEntries.length}:full=${fullEntries.length}:summary=${summaryEntries.length}`
        : "registry_seam_empty",
    text,
  }
}

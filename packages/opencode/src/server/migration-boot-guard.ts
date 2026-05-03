/**
 * @spec specs/provider-account-decoupling DD-6
 *
 * Daemon boot guard — refuses to start if the on-disk migration marker is
 * missing or outdated. Per AGENTS.md rule 1 (no silent fallback), the daemon
 * exits with code 1 and prints a remediation hint pointing at the migration
 * script. Operator unblocks by running:
 *
 *   bun run packages/opencode/scripts/migrate-provider-account-decoupling.ts --apply
 */
import fs from "fs/promises"
import path from "path"
import { Global } from "../global"
import { MigrationRequiredError } from "../provider/registry-shape"

const EXPECTED_VERSION = "1"
const MIGRATION_SCRIPT = "packages/opencode/scripts/migrate-provider-account-decoupling.ts"

interface Marker {
  version?: unknown
}

export async function assertMigrationApplied(): Promise<void> {
  const markerPath = path.join(Global.Path.data, "storage", ".migration-state.json")

  let raw: string
  try {
    raw = await fs.readFile(markerPath, "utf8")
  } catch (e: any) {
    if (e?.code === "ENOENT") {
      throw new MigrationRequiredError({
        expectedVersion: EXPECTED_VERSION,
        found: null,
        markerPath,
        message:
          `migration marker missing at ${markerPath}; ` +
          `daemon refuses to start. Run "bun run ${MIGRATION_SCRIPT} --apply" first ` +
          `(see specs/provider-account-decoupling/ for context).`,
      })
    }
    throw e
  }

  let marker: Marker
  try {
    marker = JSON.parse(raw) as Marker
  } catch {
    throw new MigrationRequiredError({
      expectedVersion: EXPECTED_VERSION,
      found: "<unparseable>",
      markerPath,
      message: `migration marker at ${markerPath} is not valid JSON; refusing to start.`,
    })
  }

  if (marker.version !== EXPECTED_VERSION) {
    throw new MigrationRequiredError({
      expectedVersion: EXPECTED_VERSION,
      found: typeof marker.version === "string" ? marker.version : String(marker.version ?? "<missing>"),
      markerPath,
      message:
        `migration marker version mismatch at ${markerPath}: expected "${EXPECTED_VERSION}", ` +
        `found "${marker.version}". Re-run "bun run ${MIGRATION_SCRIPT} --apply".`,
    })
  }
}

#!/usr/bin/env bun
/**
 * Test concurrent requests like TUI does
 */

import { readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"

async function main() {
  // Load auth
  const authPath = join(homedir(), ".config/opencode/accounts.json")
  const data = JSON.parse(readFileSync(authPath, "utf-8"))
  const account = data.families?.["claude-cli"]?.accounts?.["claude-cli-subscription-claude-cli"]

  if (!account?.accessToken) {
    console.error("✗ No subscription auth found")
    return
  }

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${account.accessToken}`,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14",
    "User-Agent": "claude-cli/2.1.37 (external, cli)",
    "x-anthropic-billing-header": "cc_version=2.1.37.b16; cc_entrypoint=unknown; cch=00000;",
  }

  // Load dumps
  const opusBody = readFileSync("/tmp/claude-cli-final-1770625659342.json", "utf-8")
  const haikuBody = readFileSync("/tmp/claude-cli-final-1770625659373.json", "utf-8")

  console.log("Sending CONCURRENT requests (like TUI)...\n")

  // Send both at the same time
  const [opusRes, haikuRes] = await Promise.all([
    fetch("https://api.anthropic.com/v1/messages?beta=true", {
      method: "POST",
      headers,
      body: opusBody,
    }),
    fetch("https://api.anthropic.com/v1/messages?beta=true", {
      method: "POST",
      headers,
      body: haikuBody,
    }),
  ])

  console.log("Opus (96KB):", opusRes.status, opusRes.ok ? "✓" : "✗")
  if (!opusRes.ok) {
    const text = await opusRes.text()
    console.log("  Error:", text.slice(0, 200))
  }

  console.log("Haiku (10KB):", haikuRes.status, haikuRes.ok ? "✓" : "✗")
  if (!haikuRes.ok) {
    const text = await haikuRes.text()
    console.log("  Error:", text.slice(0, 200))
  }
}

main().catch(console.error)

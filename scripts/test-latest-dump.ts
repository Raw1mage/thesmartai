#!/usr/bin/env bun
/**
 * Test latest TUI dump directly
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

  console.log("Token prefix:", account.accessToken.slice(0, 20))

  // Test latest haiku dump
  const haikuBody = readFileSync("/tmp/claude-cli-final-1770625659373.json", "utf-8")
  console.log("\n--- Haiku body (latest) ---")
  console.log("Size:", haikuBody.length)

  const response = await fetch("https://api.anthropic.com/v1/messages?beta=true", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${account.accessToken}`,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14",
      "User-Agent": "claude-cli/2.1.37 (external, cli)",
    },
    body: haikuBody,
  })

  console.log("Status:", response.status)
  if (!response.ok) {
    const text = await response.text()
    console.log("Error:", text.slice(0, 300))
  } else {
    console.log("SUCCESS!")
  }
}

main().catch(console.error)

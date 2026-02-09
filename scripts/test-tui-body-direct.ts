#!/usr/bin/env bun
/**
 * Test: Use exact TUI request body directly
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

  // Load exact TUI request body
  const body = readFileSync("/tmp/claude-cli-final-1770625449579.json", "utf-8")
  console.log("Body size:", body.length, "bytes")

  // Parse to check structure
  const parsed = JSON.parse(body)
  console.log("Model:", parsed.model)
  console.log("System blocks:", parsed.system?.length || 0)
  console.log("First system text preview:", parsed.system?.[0]?.text?.slice(0, 80))
  console.log("Tools:", parsed.tools?.length || 0)
  console.log("Has cache_control:", body.includes("cache_control"))

  // Send exact same request
  const response = await fetch("https://api.anthropic.com/v1/messages?beta=true", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${account.accessToken}`,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14",
      "User-Agent": "claude-cli/2.1.37 (external, cli)",
    },
    body,
  })

  console.log("\nResponse status:", response.status)
  if (!response.ok) {
    const text = await response.text()
    console.log("Error:", text.slice(0, 300))
  } else {
    console.log("SUCCESS!")
  }
}

main().catch(console.error)

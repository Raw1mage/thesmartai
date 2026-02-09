#!/usr/bin/env bun
/**
 * Direct Opus test - bypasses plugin and SDK completely
 */

import { readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"

const VERSION = "2.1.37"

async function main() {
  console.log("=== Direct Opus API Test ===\n")

  // Load auth
  const authPath = join(homedir(), ".config/opencode/accounts.json")
  const data = JSON.parse(readFileSync(authPath, "utf-8"))
  const account = data.families?.["claude-cli"]?.accounts?.["claude-cli-subscription-claude-cli"]

  if (!account?.accessToken) {
    console.error("✗ No auth found")
    return
  }
  console.log("✓ Auth loaded")

  const headers = new Headers()
  headers.set("Authorization", `Bearer ${account.accessToken}`)
  headers.set("anthropic-version", "2023-06-01")
  headers.set("Content-Type", "application/json")
  headers.set("User-Agent", `claude-cli/${VERSION} (external, cli)`)
  headers.set("anthropic-beta", "oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14")
  headers.set("x-anthropic-additional-protection", "true")  // From official claude-cli

  const models = [
    "claude-haiku-4-5",
    "claude-sonnet-4-5-20250929",
    "claude-opus-4-5-20251101",
  ]

  for (const model of models) {
    console.log(`\n--- Testing: ${model} ---`)

    const body = {
      model,
      max_tokens: 50,
      system: "You are Claude Code, Anthropic's official CLI for Claude.",  // Official system prompt
      messages: [{ role: "user", content: "Say hi" }],
      tools: [
        {
          name: "mcp_read_file",
          description: "Read a file",
          input_schema: { type: "object", properties: { path: { type: "string" } } },
        },
      ],
      stream: false,
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages?beta=true", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const json = await response.json()
        console.log(`✓ SUCCESS (${response.status})`)
        console.log(`  Response:`, json.content?.[0]?.text?.slice(0, 50) || "...")
      } else {
        const text = await response.text()
        console.log(`✗ FAILED (${response.status})`)
        console.log(`  Error:`, text.slice(0, 100))
      }
    } catch (e: any) {
      console.log(`✗ ERROR:`, e.message)
    }
  }

  console.log("\n=== Test Complete ===")
}

main().catch(console.error)

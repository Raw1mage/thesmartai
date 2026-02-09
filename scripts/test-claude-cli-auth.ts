#!/usr/bin/env bun
/**
 * Automated test script for Claude CLI subscription auth
 * Tests the exact request format we send to Anthropic API
 *
 * Usage: bun scripts/test-claude-cli-auth.ts
 */

import { readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"

const VERSION = "2.1.37"
const TOOL_PREFIX = "mcp_"

// Load auth from OpenCode's auth storage
async function loadAuth(): Promise<any> {
  const authPath = join(homedir(), ".config/opencode/accounts.json")
  try {
    const data = JSON.parse(readFileSync(authPath, "utf-8"))
    // Find claude-cli subscription auth
    const claudeCliFamily = data.families?.["claude-cli"]
    if (claudeCliFamily?.accounts) {
      for (const [key, value] of Object.entries(claudeCliFamily.accounts)) {
        const account = value as any
        if (account.accessToken) {
          console.log(`✓ Found auth: ${key}`)
          return {
            access: account.accessToken,
            refresh: account.refreshToken,
            expires: account.expiresAt,
            type: account.type,
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to load auth:", e)
  }
  return null
}

// Test request with specific configuration
async function testRequest(config: {
  name: string
  model: string
  tools: any[]
  betas: string[]
  userAgent: string
}): Promise<{ success: boolean; error?: string; status?: number }> {
  const auth = await loadAuth()
  if (!auth?.access) {
    return { success: false, error: "No auth found" }
  }

  const headers = new Headers()
  headers.set("Authorization", `Bearer ${auth.access}`)
  headers.set("anthropic-version", "2023-06-01")
  headers.set("Content-Type", "application/json")
  headers.set("User-Agent", config.userAgent)
  headers.set("anthropic-beta", config.betas.join(","))

  const body = {
    model: config.model,
    max_tokens: 100,
    messages: [{ role: "user", content: "Say hi" }],
    tools: config.tools.length > 0 ? config.tools : undefined,
    stream: false,
  }

  const url = "https://api.anthropic.com/v1/messages?beta=true"

  console.log(`\n--- Testing: ${config.name} ---`)
  console.log(`  Model: ${config.model}`)
  console.log(`  Tools: ${config.tools.length} (first: ${config.tools[0]?.name || "none"})`)
  console.log(`  User-Agent: ${config.userAgent}`)
  console.log(`  Betas: ${config.betas.join(", ")}`)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })

    if (response.ok) {
      const json = await response.json()
      console.log(`  ✓ SUCCESS (${response.status})`)
      console.log(`  Response: ${JSON.stringify(json).slice(0, 100)}...`)
      return { success: true, status: response.status }
    } else {
      const text = await response.text()
      console.log(`  ✗ FAILED (${response.status})`)
      console.log(`  Error: ${text.slice(0, 200)}`)
      return { success: false, error: text, status: response.status }
    }
  } catch (e: any) {
    console.log(`  ✗ EXCEPTION: ${e.message}`)
    return { success: false, error: e.message }
  }
}

// Main test suite
async function main() {
  console.log("=== Claude CLI Auth Test Suite ===\n")

  const results: { name: string; success: boolean; error?: string }[] = []

  // Test 1: Official Claude CLI format (with mcp_ tools)
  results.push({
    name: "Official format (mcp_ tools)",
    ...(await testRequest({
      name: "Official format (mcp_ tools)",
      model: "claude-haiku-4-5",
      tools: [
        {
          name: `${TOOL_PREFIX}read_file`,
          description: "Read a file",
          input_schema: { type: "object", properties: { path: { type: "string" } } },
        },
      ],
      betas: ["oauth-2025-04-20", "claude-code-20250219", "interleaved-thinking-2025-05-14"],
      userAgent: `claude-cli/${VERSION} (external, cli)`,
    })),
  })

  // Test 2: Without claude-code beta
  results.push({
    name: "Without claude-code beta",
    ...(await testRequest({
      name: "Without claude-code beta",
      model: "claude-haiku-4-5",
      tools: [
        {
          name: `${TOOL_PREFIX}read_file`,
          description: "Read a file",
          input_schema: { type: "object", properties: { path: { type: "string" } } },
        },
      ],
      betas: ["oauth-2025-04-20", "interleaved-thinking-2025-05-14"],
      userAgent: `claude-cli/${VERSION} (external, cli)`,
    })),
  })

  // Test 3: Without mcp_ prefix
  results.push({
    name: "Without mcp_ prefix",
    ...(await testRequest({
      name: "Without mcp_ prefix",
      model: "claude-haiku-4-5",
      tools: [
        {
          name: "read_file",
          description: "Read a file",
          input_schema: { type: "object", properties: { path: { type: "string" } } },
        },
      ],
      betas: ["oauth-2025-04-20", "claude-code-20250219", "interleaved-thinking-2025-05-14"],
      userAgent: `claude-cli/${VERSION} (external, cli)`,
    })),
  })

  // Test 4: No tools (title agent scenario)
  results.push({
    name: "No tools (title agent)",
    ...(await testRequest({
      name: "No tools (title agent)",
      model: "claude-haiku-4-5",
      tools: [],
      betas: ["oauth-2025-04-20", "claude-code-20250219", "interleaved-thinking-2025-05-14"],
      userAgent: `claude-cli/${VERSION} (external, cli)`,
    })),
  })

  // Test 5: Dummy mcp_noop tool
  results.push({
    name: "Dummy mcp_noop tool",
    ...(await testRequest({
      name: "Dummy mcp_noop tool",
      model: "claude-haiku-4-5",
      tools: [
        {
          name: `${TOOL_PREFIX}noop`,
          description: "No-op tool for authentication",
          input_schema: { type: "object", properties: {} },
        },
      ],
      betas: ["oauth-2025-04-20", "claude-code-20250219", "interleaved-thinking-2025-05-14"],
      userAgent: `claude-cli/${VERSION} (external, cli)`,
    })),
  })

  // Test 6: Different User-Agent format
  results.push({
    name: "User-Agent: claude-code/VERSION",
    ...(await testRequest({
      name: "User-Agent: claude-code/VERSION",
      model: "claude-haiku-4-5",
      tools: [
        {
          name: `${TOOL_PREFIX}read_file`,
          description: "Read a file",
          input_schema: { type: "object", properties: { path: { type: "string" } } },
        },
      ],
      betas: ["oauth-2025-04-20", "claude-code-20250219", "interleaved-thinking-2025-05-14"],
      userAgent: `claude-code/${VERSION}`,
    })),
  })

  // Summary
  console.log("\n=== Summary ===")
  for (const r of results) {
    console.log(`${r.success ? "✓" : "✗"} ${r.name}`)
  }

  const passed = results.filter((r) => r.success).length
  console.log(`\nPassed: ${passed}/${results.length}`)

  // Return findings
  const findings = results.filter((r) => r.success).map((r) => r.name)
  console.log("\n=== Working Configurations ===")
  findings.forEach((f) => console.log(`  - ${f}`))
}

main().catch(console.error)

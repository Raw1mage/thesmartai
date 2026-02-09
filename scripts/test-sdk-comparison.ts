#!/usr/bin/env bun
/**
 * Compare direct fetch vs AI SDK fetch for Claude CLI auth
 * This helps identify what the SDK might be modifying
 */

import { readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import { createAnthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"

const VERSION = "2.1.37"
const TOOL_PREFIX = "mcp_"

// Load auth
function loadAuth(): any {
  const authPath = join(homedir(), ".config/opencode/accounts.json")
  const data = JSON.parse(readFileSync(authPath, "utf-8"))
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
  return null
}

// Create a fetch interceptor to log what SDK sends
function createInterceptor(auth: any) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString()
    const headers = new Headers(init?.headers)

    console.log("\n=== SDK REQUEST ===")
    console.log("URL:", url)
    console.log("Method:", init?.method)
    console.log("Headers:")
    headers.forEach((v, k) => console.log(`  ${k}: ${k === "authorization" ? v.slice(0, 30) + "..." : v}`))

    if (init?.body) {
      const body = JSON.parse(init.body as string)
      console.log("Body:")
      console.log("  model:", body.model)
      console.log("  tools:", body.tools?.length || 0)
      console.log("  first tool:", body.tools?.[0]?.name)
    }

    // Now apply our modifications (like the plugin does)
    const requestHeaders = new Headers(init?.headers)
    requestHeaders.set("Authorization", `Bearer ${auth.access}`)
    requestHeaders.set("anthropic-version", "2023-06-01")
    requestHeaders.set("User-Agent", `claude-cli/${VERSION} (external, cli)`)
    requestHeaders.set(
      "anthropic-beta",
      "oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14"
    )
    requestHeaders.delete("x-api-key")

    // Modify URL
    let finalUrl = url
    if (url.includes("/messages") && !url.includes("beta=true")) {
      const urlObj = new URL(url)
      urlObj.searchParams.set("beta", "true")
      finalUrl = urlObj.toString()
    }

    // Modify body - add mcp_ prefix
    let body = init?.body
    if (body && typeof body === "string") {
      const parsed = JSON.parse(body)
      if (parsed.tools && Array.isArray(parsed.tools)) {
        parsed.tools = parsed.tools.map((tool: any) => ({
          ...tool,
          name: tool.name?.startsWith(TOOL_PREFIX) ? tool.name : `${TOOL_PREFIX}${tool.name}`,
        }))
      } else {
        // Add dummy tool
        parsed.tools = [{ name: `${TOOL_PREFIX}noop`, description: "noop", input_schema: { type: "object" } }]
      }
      body = JSON.stringify(parsed)
    }

    console.log("\n=== MODIFIED REQUEST ===")
    console.log("URL:", finalUrl)
    console.log("Headers after modification:")
    requestHeaders.forEach((v, k) => console.log(`  ${k}: ${k === "authorization" ? v.slice(0, 30) + "..." : v}`))

    // Make the actual request
    const response = await fetch(finalUrl, { ...init, body, headers: requestHeaders })

    console.log("\n=== RESPONSE ===")
    console.log("Status:", response.status)

    if (!response.ok) {
      const text = await response.text()
      console.log("Error:", text)
      // Return a fake response to avoid SDK errors
      return new Response(JSON.stringify({ error: text }), { status: response.status })
    }

    return response
  }
}

async function main() {
  const auth = loadAuth()
  if (!auth) {
    console.error("No auth found")
    return
  }

  console.log("=== Testing with @ai-sdk/anthropic ===\n")

  const anthropic = createAnthropic({
    apiKey: "dummy", // Will be overwritten by our fetch
    fetch: createInterceptor(auth) as any,
  })

  try {
    // Test: Simple message without tools
    console.log("\n--- Test: Simple message (no tools) ---")
    const result = await generateText({
      model: anthropic("claude-haiku-4-5"),
      maxTokens: 50,
      prompt: "Say hi",
    })
    console.log("✓ SUCCESS:", result.text)
  } catch (e: any) {
    console.log("✗ FAILED:", e.message)
  }
}

main().catch(console.error)

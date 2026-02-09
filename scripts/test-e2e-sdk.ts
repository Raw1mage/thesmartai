#!/usr/bin/env bun
/**
 * E2E test that simulates TUI flow using AI SDK
 * This is the closest approximation to actual bun run dev behavior
 */

import { readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import { createAnthropic } from "@ai-sdk/anthropic"
import { generateText, tool } from "ai"
import { z } from "zod"
import { AnthropicAuthPlugin } from "../src/plugin/anthropic"

async function main() {
  console.log("=== E2E SDK Test ===\n")

  // 1. Load auth (same as TUI)
  const authPath = join(homedir(), ".config/opencode/accounts.json")
  const data = JSON.parse(readFileSync(authPath, "utf-8"))
  const account = data.families?.["claude-cli"]?.accounts?.["claude-cli-subscription-claude-cli"]

  if (!account?.accessToken) {
    console.error("✗ No subscription auth found")
    return
  }

  console.log("✓ Auth loaded:", account.email || "claude-cli-subscription")

  // 2. Initialize plugin (same as TUI)
  const mockClient = {
    auth: {
      get: async () => ({
        type: "subscription",
        access: account.accessToken,
        refresh: account.refreshToken,
        expires: account.expiresAt,
        accountId: "claude-cli-subscription-claude-cli",
      }),
      set: async () => {},
    },
  }

  const plugin = await AnthropicAuthPlugin({ client: mockClient } as any)
  const getAuth = () => mockClient.auth.get()
  const mockProvider = { models: {} }
  const options = await plugin.auth!.loader!(getAuth, mockProvider as any)

  if (!options?.fetch) {
    console.error("✗ No custom fetch from plugin")
    return
  }

  console.log("✓ Plugin initialized with fetchId:", options.fetchId)

  // 3. Create AI SDK provider with custom fetch (same as TUI)
  const anthropic = createAnthropic({
    apiKey: "dummy", // Overwritten by our fetch
    fetch: options.fetch as any,
  })

  // 4. Test all models via AI SDK
  const models = [
    { id: "claude-haiku-4-5-20251001", name: "Haiku" },
    { id: "claude-sonnet-4-5-20250929", name: "Sonnet" },
    { id: "claude-opus-4-5-20251101", name: "Opus" },
  ]

  for (const model of models) {
    console.log(`\n--- Test: ${model.name} ---`)
    try {
      const result = await generateText({
        model: anthropic(model.id),
        maxTokens: 50,
        prompt: `Say 'Hello from ${model.name}' in 5 words.`,
      })
      console.log(`✓ ${model.name} SUCCESS:`, result.text.slice(0, 60))
    } catch (e: any) {
      console.log(`✗ ${model.name} FAILED:`, e.message.slice(0, 100))
    }
  }

  console.log("\n=== E2E Test Complete ===")
}

main().catch(console.error)

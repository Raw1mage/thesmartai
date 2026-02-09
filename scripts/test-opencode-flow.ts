#!/usr/bin/env bun
/**
 * Automated test that simulates OpenCode's full flow
 * Tests the plugin → provider → SDK → API chain
 */

// Import OpenCode modules directly
import { AnthropicAuthPlugin } from "../src/plugin/anthropic"

async function main() {
  console.log("=== OpenCode Flow Test ===\n")

  // Mock client API
  const mockClient = {
    auth: {
      get: async () => {
        // Load real auth from accounts.json
        const { readFileSync } = await import("fs")
        const { homedir } = await import("os")
        const { join } = await import("path")
        const authPath = join(homedir(), ".config/opencode/accounts.json")
        const data = JSON.parse(readFileSync(authPath, "utf-8"))
        const account = data.families?.["claude-cli"]?.accounts?.["claude-cli-subscription-claude-cli"]
        if (account) {
          return {
            type: "subscription",
            access: account.accessToken,
            refresh: account.refreshToken,
            expires: account.expiresAt,
            accountId: "claude-cli-subscription-claude-cli",
          }
        }
        return null
      },
      set: async () => {},
    },
  }

  // Initialize plugin
  console.log("1. Initializing plugin...")
  const plugin = await AnthropicAuthPlugin({ client: mockClient } as any)

  if (!plugin.auth?.loader) {
    console.error("✗ Plugin loader not found")
    return
  }

  // Get auth options from loader
  console.log("2. Loading auth options...")
  const getAuth = () => mockClient.auth.get()
  const mockProvider = { models: {} } // Empty models is fine for testing
  const options = await plugin.auth.loader(getAuth, mockProvider as any)

  if (!options?.fetch) {
    console.error("✗ Custom fetch not found in options")
    return
  }

  console.log("✓ Plugin initialized with custom fetch")
  console.log("  fetchId:", options.fetchId)

  // Now test the fetch directly
  console.log("\n3. Testing custom fetch...")

  const testBody = {
    model: "claude-haiku-4-5",
    max_tokens: 50,
    messages: [{ role: "user", content: "Say hi" }],
    stream: true,
  }

  try {
    const response = await options.fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "session_id": "test-session", // This should be removed by plugin
        "x-opencode-account-id": "test", // This should be removed by plugin
      },
      body: JSON.stringify(testBody),
    })

    console.log("\n=== Response ===")
    console.log("Status:", response.status)
    console.log("OK:", response.ok)

    if (response.ok) {
      // Read stream
      const reader = response.body?.getReader()
      if (reader) {
        let fullText = ""
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })
        }
        console.log("Response preview:", fullText.slice(0, 200))
      }
      console.log("\n✓ SUCCESS!")
    } else {
      const text = await response.text()
      console.log("Error:", text)
      console.log("\n✗ FAILED")
    }
  } catch (e: any) {
    console.error("Exception:", e.message)
    console.log("\n✗ FAILED")
  }
}

main().catch(console.error)

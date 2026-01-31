import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { Log } from "../util/log"

const log = Log.create({ service: "plugin.anthropic" })

export async function AnthropicAuthPlugin(input: PluginInput): Promise<Hooks> {
    return {
        auth: {
            provider: "anthropic",
            async loader(getAuth, provider) {
                const auth = await getAuth()

                if (auth.type === "api") {
                    return {
                        apiKey: auth.key
                    }
                }

                if (auth.type === "oauth") {
                    // Subscription / "Claude Code" support
                    return {
                        headers: {
                            "User-Agent": "anthropic-claude-code/0.5.1",
                            "anthropic-client": "claude-code/0.5.1",
                            "anthropic-beta":
                                "claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
                        },
                        fetch: async (reqInput: RequestInfo | URL, init?: RequestInit) => {
                            const headers = new Headers(init?.headers)
                            if (auth.access) {
                                headers.set("Authorization", `Bearer ${auth.access}`)
                            }
                            // Remove x-api-key if it was accidentally set
                            headers.delete("x-api-key")

                            return fetch(reqInput, {
                                ...init,
                                headers
                            })
                        }
                    }
                }

                return {}
            },
            methods: [
                {
                    label: "Anthropic API Key",
                    type: "api",
                },
            ],
        },
    }
}

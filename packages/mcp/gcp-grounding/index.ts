import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js"
import { GoogleGenAI } from "@google/genai"

import * as dotenv from "dotenv"
dotenv.config()

// The GoogleGenAI SDK will automatically use GEMINI_API_KEY from environment
const ai = new GoogleGenAI({})

const server = new Server(
  {
    name: "gcp-grounding-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "google_search_grounding",
        description:
          "Perform a Google Search to get real-time, up-to-date information from the web. Highly recommended whenever the user asks for current news, facts, or topics that require web access.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query to execute on Google.",
            },
          },
          required: ["query"],
        },
      },
    ],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "google_search_grounding": {
      const query = request.params.arguments?.query
      if (typeof query !== "string") {
        throw new McpError(ErrorCode.InvalidParams, "query must be a string")
      }

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: query,
          config: {
            tools: [{ googleSearch: {} }],
          },
        })

        return {
          content: [
            {
              type: "text",
              text: response.text || "No response generated.",
            },
          ],
        }
      } catch (error: any) {
        console.error("Error executing google search:", error)
        return {
          content: [
            {
              type: "text",
              text: `Search failed: ${error.message || String(error)}`,
            },
          ],
          isError: true,
        }
      }
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`)
  }
})

async function startServer() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.log("GCP Grounding MCP Server running on stdio")
}

startServer().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})

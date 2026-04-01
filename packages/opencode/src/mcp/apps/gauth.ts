/**
 * Shared Google OAuth token management for all Google MCP apps (Gmail, Calendar, etc.).
 * Tokens are stored in `~/.config/opencode/gauth.json` and shared across apps.
 */
import path from "path"
import fs from "fs/promises"
import { Global } from "@/global"
import { ManagedAppRegistry } from "@/mcp/app-registry"
import { Log } from "@/util/log"

const log = Log.create({ service: "gauth" })

export interface GAuthTokens {
  access_token: string
  refresh_token: string
  expires_at: number
  token_type: string
  updated_at: number
}

/** Refresh 5 minutes before actual expiry to avoid edge-case failures */
const EXPIRY_MARGIN_MS = 5 * 60 * 1000

function gauthPath() {
  return path.join(Global.Path.config, "gauth.json")
}

export async function readGAuthTokens(): Promise<GAuthTokens | null> {
  try {
    const file = Bun.file(gauthPath())
    if (!(await file.exists())) return null
    return (await file.json()) as GAuthTokens
  } catch {
    return null
  }
}

async function writeGAuthTokens(tokens: GAuthTokens): Promise<void> {
  const p = gauthPath()
  await Bun.write(p, JSON.stringify(tokens, null, 2))
  await fs.chmod(p, 0o600)
}

/**
 * Refresh access_token using the stored refresh_token.
 * Persists updated tokens back to gauth.json.
 */
async function refreshAccessToken(appId: string, tokens: GAuthTokens): Promise<string> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  const tokenUri = process.env.GOOGLE_CALENDAR_TOKEN_URI || "https://oauth2.googleapis.com/token"

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client credentials not configured — cannot refresh token")
  }
  if (!tokens.refresh_token) {
    throw new ManagedAppRegistry.UsageStateError({
      appId,
      status: "pending_auth",
      reason: "unauthenticated",
      code: "MANAGED_APP_AUTH_REQUIRED",
      message: "No refresh_token available — re-authorize to obtain one",
    })
  }

  log.info("refreshing Google access token", { appId })
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    log.error("token refresh failed", { appId, status: res.status, body })
    throw new ManagedAppRegistry.UsageStateError({
      appId,
      status: "pending_auth",
      reason: "unauthenticated",
      code: "MANAGED_APP_AUTH_REQUIRED",
      message: `Token refresh failed (${res.status}): ${body}`,
    })
  }

  const data = (await res.json()) as {
    access_token: string
    expires_in: number
    token_type: string
    refresh_token?: string
  }

  const updated: GAuthTokens = {
    access_token: data.access_token,
    // Google may rotate the refresh_token; keep the new one if provided
    refresh_token: data.refresh_token || tokens.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type || tokens.token_type,
    updated_at: Date.now(),
  }

  await writeGAuthTokens(updated)
  log.info("access token refreshed", { appId, expiresIn: data.expires_in })
  return updated.access_token
}

/**
 * Resolve a valid access token for the given Google MCP app.
 * Auto-refreshes if the stored token is expired or about to expire.
 */
export async function resolveGoogleAccessToken(appId: string): Promise<string> {
  await ManagedAppRegistry.requireReady(appId)

  const tokens = await readGAuthTokens()
  if (!tokens || !tokens.access_token) {
    throw new ManagedAppRegistry.UsageStateError({
      appId,
      status: "pending_auth",
      reason: "unauthenticated",
      code: "MANAGED_APP_AUTH_REQUIRED",
      message: "Google OAuth tokens not found in gauth.json",
    })
  }

  // Auto-refresh if token is expired or about to expire
  if (tokens.expires_at && Date.now() >= tokens.expires_at - EXPIRY_MARGIN_MS) {
    return refreshAccessToken(appId, tokens)
  }

  return tokens.access_token
}

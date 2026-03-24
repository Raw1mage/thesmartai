import { Log } from "@/util/log"

const log = Log.create({ service: "google-calendar-client" })
const BASE_URL = "https://www.googleapis.com/calendar/v3"

export namespace GoogleCalendarClient {
  export interface CalendarListEntry {
    id: string
    summary: string
    description?: string
    primary?: boolean
    timeZone?: string
    accessRole?: string
  }

  export interface EventDateTime {
    dateTime?: string
    date?: string
    timeZone?: string
  }

  export interface Attendee {
    email: string
    displayName?: string
    responseStatus?: string
  }

  export interface CalendarEvent {
    id: string
    summary?: string
    description?: string
    location?: string
    start: EventDateTime
    end: EventDateTime
    status?: string
    htmlLink?: string
    created?: string
    updated?: string
    attendees?: Attendee[]
    organizer?: { email?: string; displayName?: string }
    recurringEventId?: string
    recurrence?: string[]
  }

  export interface FreeBusyCalendar {
    busy: Array<{ start: string; end: string }>
    errors?: Array<{ domain: string; reason: string }>
  }

  export interface FreeBusyResponse {
    kind: string
    timeMin: string
    timeMax: string
    calendars: Record<string, FreeBusyCalendar>
  }

  class ApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly body: unknown,
    ) {
      const msg = typeof body === "object" && body !== null && "error" in body
        ? JSON.stringify((body as Record<string, unknown>).error)
        : String(body)
      super(`Google Calendar API error ${status}: ${msg}`)
      this.name = "GoogleCalendarApiError"
    }
  }

  async function request<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
    const url = path.startsWith("https://") ? path : `${BASE_URL}${path}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    }

    log.info("google calendar api request", { method: init?.method ?? "GET", path })

    const response = await fetch(url, { ...init, headers })
    if (!response.ok) {
      const body = await response.json().catch(() => response.text())
      throw new ApiError(response.status, body)
    }
    return response.json() as Promise<T>
  }

  export async function listCalendars(accessToken: string): Promise<CalendarListEntry[]> {
    const data = await request<{ items?: CalendarListEntry[] }>(
      accessToken,
      "/users/me/calendarList?maxResults=250",
    )
    return data.items ?? []
  }

  export async function listEvents(
    accessToken: string,
    calendarId: string,
    opts?: {
      timeMin?: string
      timeMax?: string
      query?: string
      limit?: number
    },
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({ singleEvents: "true", orderBy: "startTime" })
    if (opts?.timeMin) params.set("timeMin", opts.timeMin)
    if (opts?.timeMax) params.set("timeMax", opts.timeMax)
    if (opts?.query) params.set("q", opts.query)
    if (opts?.limit) params.set("maxResults", String(opts.limit))

    const data = await request<{ items?: CalendarEvent[] }>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    )
    return data.items ?? []
  }

  export async function getEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<CalendarEvent> {
    return request<CalendarEvent>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    )
  }

  export async function createEvent(
    accessToken: string,
    calendarId: string,
    event: {
      summary: string
      start: string
      end: string
      description?: string
      location?: string
      attendees?: string[]
      timeZone?: string
    },
  ): Promise<CalendarEvent> {
    const tz = event.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    const body = {
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: { dateTime: event.start, timeZone: tz },
      end: { dateTime: event.end, timeZone: tz },
      attendees: event.attendees?.map((email: string) => ({ email })),
    }
    return request<CalendarEvent>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      { method: "POST", body: JSON.stringify(body) },
    )
  }

  export async function updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    patch: {
      summary?: string
      start?: string
      end?: string
      description?: string
      location?: string
      attendees?: string[]
    },
  ): Promise<CalendarEvent> {
    const body: Record<string, unknown> = {}
    if (patch.summary !== undefined) body.summary = patch.summary
    if (patch.description !== undefined) body.description = patch.description
    if (patch.location !== undefined) body.location = patch.location
    if (patch.start !== undefined) body.start = { dateTime: patch.start }
    if (patch.end !== undefined) body.end = { dateTime: patch.end }
    if (patch.attendees !== undefined) body.attendees = patch.attendees.map((email: string) => ({ email }))

    return request<CalendarEvent>(
      accessToken,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    )
  }

  export async function deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    sendUpdates?: boolean,
  ): Promise<void> {
    const params = sendUpdates ? "?sendUpdates=all" : ""
    const url = `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}${params}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    }
    const response = await fetch(`${BASE_URL}${url}`, { method: "DELETE", headers })
    if (!response.ok) {
      const body = await response.json().catch(() => response.text())
      throw new ApiError(response.status, body)
    }
  }

  export async function freeBusy(
    accessToken: string,
    calendarIds: string[],
    timeMin: string,
    timeMax: string,
    timeZone?: string,
  ): Promise<FreeBusyResponse> {
    const body = {
      timeMin,
      timeMax,
      timeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      items: calendarIds.map((id: string) => ({ id })),
    }
    return request<FreeBusyResponse>(
      accessToken,
      "/freeBusy",
      { method: "POST", body: JSON.stringify(body) },
    )
  }
}

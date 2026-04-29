import { ActivityBeacon } from "@/util/activity-beacon"

const beacon = ActivityBeacon.scope("session_storage")

type Tags = Record<string, string | number | boolean | undefined>

function suffix(tags?: Tags): string {
  if (!tags) return ""
  const parts = Object.entries(tags)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}_${String(value).replace(/[^a-zA-Z0-9_-]/g, "_")}`)
  return parts.length ? `.${parts.join(".")}` : ""
}

export namespace SessionStorageMetrics {
  export function observeMs(name: string, value: number, tags?: Tags): void {
    const key = `${name}${suffix(tags)}`
    beacon.hit(`${key}.count`)
    beacon.setGauge(`${key}.last_ms`, Math.max(0, Math.round(value)))
  }

  export function increment(name: string, tags?: Tags): void {
    beacon.hit(`${name}${suffix(tags)}`)
  }

  export function gauge(name: string, value: number): void {
    beacon.setGauge(name, value)
  }
}

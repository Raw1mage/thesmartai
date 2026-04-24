export type DiscoveryScannerField = "hostname" | "operating_system" | "mac_address" | "available_protocols"

export type DiscoveryRunPhase = "idle" | "loading" | "running" | "final" | "historical"

export type DiscoverySyncState = "idle" | "refreshing" | "stale" | "error"

export type DiscoveryDisplayStatus = null | "pending" | "probing" | "partial" | "resolved" | "failed"

export type DiscoveryRowMode = "persisted" | "provisional" | "historical"

export interface LiveRunState {
  runId: number | null
  workbookId: number | null
  isRunning: boolean
  phase: DiscoveryRunPhase
  syncState: DiscoverySyncState
  lastSyncedAt: string | null
  errorSummary: string | null
}

export interface PreparedScannerCell {
  field: DiscoveryScannerField
  runId: number | null
  candidateId: number | null
  displayValue: string
  displayStatus: DiscoveryDisplayStatus
  source: string | null
  updatedAt: string | null
  traceAvailable: boolean
  isHistorical: boolean
}

export interface PreparedDiscoveryRow {
  rowId: string
  workbookRowId: number | null
  candidateId: number | null
  primaryIP: string
  rowMode: DiscoveryRowMode
  hostname: PreparedScannerCell
  operatingSystem: PreparedScannerCell
  macAddress: PreparedScannerCell
  availableProtocols: PreparedScannerCell
}

export interface SnapshotFallbackState {
  workbookId: number | null
  hasHistoricalRun: boolean
  historicalRunId: number | null
  historicalStatus: string | null
  candidateCount: number
}

export interface ScanLogTargetState {
  runId: number | null
  candidateId: number | null
  field: DiscoveryScannerField | null
}

export interface CandidateRowState {
  candidateId: number | null
  primaryIP: string
  fields: Partial<Record<DiscoveryScannerField, PreparedScannerCell>>
}

export interface DiscoveryRuntimeControllerState {
  liveRunState: LiveRunState
  candidateRowStates: CandidateRowState[]
  snapshotFallbackState: SnapshotFallbackState
  scanLogTargetState: ScanLogTargetState
}

export interface DiscoveryEventLogItem {
  id: string
  runId: number | null
  candidateId: number | null
  field: DiscoveryScannerField | null
  kind: "info" | "status" | "error"
  message: string
  timestamp: string | null
}

export interface DiscoveryEventLogViewModel {
  summary: string
  items: DiscoveryEventLogItem[]
}

export interface DiscoveryScanLogLine {
  id: string
  text: string
  timestamp: string | null
}

export interface DiscoveryScanLogViewModel {
  target: ScanLogTargetState
  lines: DiscoveryScanLogLine[]
}

export interface DiscoveryGridColumnBinding {
  field: DiscoveryScannerField
  rowKey: keyof Pick<PreparedDiscoveryRow, "hostname" | "operatingSystem" | "macAddress" | "availableProtocols">
}

export const DISCOVERY_SCANNER_FIELDS: DiscoveryScannerField[] = [
  "hostname",
  "operating_system",
  "mac_address",
  "available_protocols",
]

export const DISCOVERY_GRID_COLUMN_BINDINGS: DiscoveryGridColumnBinding[] = [
  { field: "hostname", rowKey: "hostname" },
  { field: "operating_system", rowKey: "operatingSystem" },
  { field: "mac_address", rowKey: "macAddress" },
  { field: "available_protocols", rowKey: "availableProtocols" },
]

export function createEmptyPreparedScannerCell(field: DiscoveryScannerField): PreparedScannerCell {
  return {
    field,
    runId: null,
    candidateId: null,
    displayValue: "",
    displayStatus: null,
    source: null,
    updatedAt: null,
    traceAvailable: false,
    isHistorical: false,
  }
}

export function createEmptyLiveRunState(): LiveRunState {
  return {
    runId: null,
    workbookId: null,
    isRunning: false,
    phase: "idle",
    syncState: "idle",
    lastSyncedAt: null,
    errorSummary: null,
  }
}

export function createEmptySnapshotFallbackState(): SnapshotFallbackState {
  return {
    workbookId: null,
    hasHistoricalRun: false,
    historicalRunId: null,
    historicalStatus: null,
    candidateCount: 0,
  }
}

export function createEmptyScanLogTargetState(): ScanLogTargetState {
  return {
    runId: null,
    candidateId: null,
    field: null,
  }
}

export function createEmptyDiscoveryRuntimeControllerState(): DiscoveryRuntimeControllerState {
  return {
    liveRunState: createEmptyLiveRunState(),
    candidateRowStates: [],
    snapshotFallbackState: createEmptySnapshotFallbackState(),
    scanLogTargetState: createEmptyScanLogTargetState(),
  }
}

export function createEmptyDiscoveryEventLogViewModel(): DiscoveryEventLogViewModel {
  return {
    summary: "",
    items: [],
  }
}

export function createEmptyDiscoveryScanLogViewModel(): DiscoveryScanLogViewModel {
  return {
    target: createEmptyScanLogTargetState(),
    lines: [],
  }
}

import {
  createEmptyPreparedScannerCell,
  type CandidateRowState,
  type DiscoveryScannerField,
  type PreparedDiscoveryRow,
  type PreparedScannerCell,
} from "./types"

export function prepareScannerCell(
  cell: PreparedScannerCell | undefined,
  field: DiscoveryScannerField,
): PreparedScannerCell {
  return cell ?? createEmptyPreparedScannerCell(field)
}

export function prepareDiscoveryRow(row: CandidateRowState): PreparedDiscoveryRow {
  return {
    rowId: row.candidateId == null ? `candidate:missing:${row.primaryIP}` : `candidate:${row.candidateId}`,
    workbookRowId: null,
    candidateId: row.candidateId,
    primaryIP: row.primaryIP,
    rowMode: "provisional",
    hostname: prepareScannerCell(row.fields.hostname, "hostname"),
    operatingSystem: prepareScannerCell(row.fields.operating_system, "operating_system"),
    macAddress: prepareScannerCell(row.fields.mac_address, "mac_address"),
    availableProtocols: prepareScannerCell(row.fields.available_protocols, "available_protocols"),
  }
}

export function prepareDiscoveryRows(rows: CandidateRowState[]): PreparedDiscoveryRow[] {
  return rows.map(prepareDiscoveryRow)
}

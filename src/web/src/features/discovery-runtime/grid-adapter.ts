import { DISCOVERY_GRID_COLUMN_BINDINGS, type DiscoveryGridColumnBinding, type PreparedDiscoveryRow } from "./types"

export interface DiscoveryGridAdapterState {
  rows: PreparedDiscoveryRow[]
  columnBindings: DiscoveryGridColumnBinding[]
}

export interface DiscoveryGridAdapter {
  getState(): DiscoveryGridAdapterState
  getRowId(row: PreparedDiscoveryRow): string
}

class StaticDiscoveryGridAdapter implements DiscoveryGridAdapter {
  constructor(private readonly state: DiscoveryGridAdapterState) {}

  getState(): DiscoveryGridAdapterState {
    return this.state
  }

  getRowId(row: PreparedDiscoveryRow): string {
    return row.rowId
  }
}

export function createDiscoveryGridAdapter(rows: PreparedDiscoveryRow[]): DiscoveryGridAdapter {
  return new StaticDiscoveryGridAdapter({
    rows,
    columnBindings: DISCOVERY_GRID_COLUMN_BINDINGS,
  })
}

import {
  createEmptyDiscoveryRuntimeControllerState,
  type DiscoveryRuntimeControllerState,
  type ScanLogTargetState,
} from "./types"

export interface DiscoveryRuntimeController {
  getState(): DiscoveryRuntimeControllerState
  setScanLogTarget(target: ScanLogTargetState): void
  reset(): void
}

class StaticDiscoveryRuntimeController implements DiscoveryRuntimeController {
  private state: DiscoveryRuntimeControllerState

  constructor(initialState?: DiscoveryRuntimeControllerState) {
    this.state = initialState ?? createEmptyDiscoveryRuntimeControllerState()
  }

  getState(): DiscoveryRuntimeControllerState {
    return this.state
  }

  setScanLogTarget(target: ScanLogTargetState): void {
    this.state = {
      ...this.state,
      scanLogTargetState: target,
    }
  }

  reset(): void {
    this.state = createEmptyDiscoveryRuntimeControllerState()
  }
}

export function createDiscoveryRuntimeController(
  initialState?: DiscoveryRuntimeControllerState,
): DiscoveryRuntimeController {
  return new StaticDiscoveryRuntimeController(initialState)
}

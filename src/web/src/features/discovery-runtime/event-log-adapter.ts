import {
  createEmptyDiscoveryEventLogViewModel,
  type CandidateRowState,
  type DiscoveryEventLogItem,
  type DiscoveryEventLogViewModel,
  type LiveRunState,
} from "./types"

export interface DiscoveryEventLogAdapter {
  getViewModel(): DiscoveryEventLogViewModel
}

class StaticDiscoveryEventLogAdapter implements DiscoveryEventLogAdapter {
  constructor(private readonly viewModel: DiscoveryEventLogViewModel) {}

  getViewModel(): DiscoveryEventLogViewModel {
    return this.viewModel
  }
}

export function createDiscoveryEventLogAdapter(
  liveRunState: LiveRunState,
  candidateRowStates: CandidateRowState[],
  items: DiscoveryEventLogItem[] = [],
): DiscoveryEventLogAdapter {
  if (liveRunState.runId == null && candidateRowStates.length === 0 && items.length === 0) {
    return new StaticDiscoveryEventLogAdapter(createEmptyDiscoveryEventLogViewModel())
  }

  return new StaticDiscoveryEventLogAdapter({
    summary: "",
    items,
  })
}

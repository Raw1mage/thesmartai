import {
  createEmptyDiscoveryScanLogViewModel,
  type DiscoveryScanLogLine,
  type DiscoveryScanLogViewModel,
  type ScanLogTargetState,
} from "./types"

export interface DiscoveryScanLogAdapter {
  getViewModel(): DiscoveryScanLogViewModel
}

class StaticDiscoveryScanLogAdapter implements DiscoveryScanLogAdapter {
  constructor(private readonly viewModel: DiscoveryScanLogViewModel) {}

  getViewModel(): DiscoveryScanLogViewModel {
    return this.viewModel
  }
}

export function createDiscoveryScanLogAdapter(
  target: ScanLogTargetState,
  lines: DiscoveryScanLogLine[] = [],
): DiscoveryScanLogAdapter {
  if (target.runId == null && target.candidateId == null && target.field == null) {
    return new StaticDiscoveryScanLogAdapter(createEmptyDiscoveryScanLogViewModel())
  }

  return new StaticDiscoveryScanLogAdapter({
    target,
    lines,
  })
}

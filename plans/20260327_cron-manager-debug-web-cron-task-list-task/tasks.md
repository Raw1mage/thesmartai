# Tasks

## 1. Child Session Contract
- [ ] 1.1 Read the approved implementation spec and companion artifacts
- [ ] 1.2 Replace child-session submit-capable prompt input with a read-only prompt placeholder
- [ ] 1.3 Add clear child-session copy explaining that subagent sessions are observation-only

## 2. Running Indicator And Kill Control
- [ ] 2.1 Wire child-session running visibility to authoritative active-child state
- [ ] 2.2 Expose a child-session kill switch using the existing active-child termination contract
- [ ] 2.3 Ensure kill-switch visibility clears when the child is no longer authoritative/running

## 3. Consistency Validation
- [ ] 3.1 Validate child page / bottom status / session list consistency for the same active child
- [ ] 3.2 Validate stop flow and stale-running cleanup
- [ ] 3.3 Record targeted validation evidence

## 4. Documentation / Retrospective
- [ ] 4.1 Sync relevant event / architecture docs
- [ ] 4.2 Compare implementation against the proposal's effective requirement description
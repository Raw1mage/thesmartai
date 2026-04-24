package discovery

import (
	"context"
	"fmt"
	"sync"
)

type MemoryRuntimeAuthority struct {
	mu          sync.RWMutex
	runCancels  map[int64]context.CancelFunc
	cellCancels map[string]context.CancelFunc
}

func NewMemoryRuntimeAuthority() *MemoryRuntimeAuthority {
	return &MemoryRuntimeAuthority{
		runCancels:  make(map[int64]context.CancelFunc),
		cellCancels: make(map[string]context.CancelFunc),
	}
}

func (a *MemoryRuntimeAuthority) IsRunLive(runID int64) bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	_, ok := a.runCancels[runID]
	return ok
}

func (a *MemoryRuntimeAuthority) IsCellLive(candidateID int64, field string) bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	_, ok := a.cellCancels[cellKey(candidateID, field)]
	return ok
}

func (a *MemoryRuntimeAuthority) RegisterRun(runID int64, cancel context.CancelFunc) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.runCancels[runID] = cancel
}

func (a *MemoryRuntimeAuthority) ClearRun(runID int64) {
	a.mu.Lock()
	defer a.mu.Unlock()
	delete(a.runCancels, runID)
}

func (a *MemoryRuntimeAuthority) RegisterCell(candidateID int64, field string, cancel context.CancelFunc) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.cellCancels[cellKey(candidateID, field)] = cancel
}

func (a *MemoryRuntimeAuthority) ClearCell(candidateID int64, field string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	delete(a.cellCancels, cellKey(candidateID, field))
}

func cellKey(candidateID int64, field string) string {
	return fmt.Sprintf("%d:%s", candidateID, field)
}

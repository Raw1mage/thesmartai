package discovery

import (
	"context"
	"time"
)

type RuntimeAuthority interface {
	IsRunLive(runID int64) bool
	IsCellLive(candidateID int64, field string) bool
	RegisterRun(runID int64, cancel context.CancelFunc)
	ClearRun(runID int64)
	RegisterCell(candidateID int64, field string, cancel context.CancelFunc)
	ClearCell(candidateID int64, field string)
}

type FieldTruth struct {
	Field     string
	Status    string
	Value     any
	Source    string
	UpdatedAt *time.Time
	Trace     []string
}

type CandidateTruth struct {
	CandidateID int64
	RunID       int64
	PrimaryIP   string
	Fields      map[string]FieldTruth
}

type SnapshotRecord struct {
	WorkbookID   int64
	RunID        int64
	Status       string
	IsHistorical bool
}

type RunReadNormalizer interface {
	NormalizeRunLiveness(status string, isLive bool) string
}

package discovery

type FailClosedRunReadNormalizer struct{}

func NewFailClosedRunReadNormalizer() FailClosedRunReadNormalizer {
	return FailClosedRunReadNormalizer{}
}

func (FailClosedRunReadNormalizer) NormalizeRunLiveness(status string, isLive bool) string {
	if isLive {
		return status
	}
	if status == "running" {
		return "completed"
	}
	return status
}

package main

import (
	"math"
	"sync"
	"time"

	"github.com/cockroachdb/pebble/v2"
)

const (
	cpuHistoryWindow = 5 * time.Minute
	maxHistoryPoints = 150
	maxHistoryNodes  = 1024
)

type cpuObservation struct {
	At         int64   `json:"at"` // Unix milliseconds for the browser.
	Average    float64 `json:"average"`
	Peak       float64 `json:"peak"`
	TTLSeconds int     `json:"ttlSeconds"`
	timestamp  int64
}

// History is local to this serving process. Gossip and Pebble still carry only
// the latest heartbeat; the ring records snapshots we have actually observed.
type cpuHistory struct {
	mu    sync.Mutex
	nodes map[string][]cpuObservation
}

func newCPUHistory() *cpuHistory {
	return &cpuHistory{nodes: make(map[string][]cpuObservation)}
}

func (h *cpuHistory) observe(nodes []NodeStats, now time.Time) {
	h.mu.Lock()
	defer h.mu.Unlock()
	cutoff := now.Add(-cpuHistoryWindow).UnixNano()
	for name, points := range h.nodes {
		first := 0
		for first < len(points) && points[first].timestamp < cutoff {
			first++
		}
		if first == len(points) {
			delete(h.nodes, name)
		} else if first > 0 {
			h.nodes[name] = append([]cpuObservation(nil), points[first:]...)
		}
	}
	for _, s := range nodes {
		if s.UpdatedAt < cutoff || s.UpdatedAt <= 0 || s.UpdatedAt > now.UnixNano() ||
			now.Sub(time.Unix(0, s.UpdatedAt)) > nodeTTL(s) || len(s.CPU) == 0 {
			continue
		}
		valid := true
		for _, value := range s.CPU {
			if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 || value > 100 {
				valid = false
				break
			}
		}
		if !valid {
			continue
		}
		points := h.nodes[s.Name]
		if len(points) > 0 && points[len(points)-1].timestamp >= s.UpdatedAt {
			continue
		}
		if len(points) == 0 && len(h.nodes) >= maxHistoryNodes {
			continue
		}
		points = append(points, cpuObservation{
			At: s.UpdatedAt / int64(time.Millisecond), Average: avgCPU(s), Peak: maxCPU(s),
			TTLSeconds: int(nodeTTL(s) / time.Second), timestamp: s.UpdatedAt,
		})
		if len(points) > maxHistoryPoints {
			points = append([]cpuObservation(nil), points[len(points)-maxHistoryPoints:]...)
		}
		h.nodes[s.Name] = points
	}
}

func (h *cpuHistory) snapshot() map[string][]cpuObservation {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := make(map[string][]cpuObservation, len(h.nodes))
	for name, points := range h.nodes {
		out[name] = append([]cpuObservation(nil), points...)
	}
	return out
}

func (h *cpuHistory) collect(db *pebble.DB, done <-chan struct{}) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-done:
			return
		case <-ticker.C:
			if nodes, err := dbScanAll(db); err == nil {
				h.observe(nodes, time.Now())
			}
		}
	}
}

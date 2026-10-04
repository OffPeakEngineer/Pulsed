package main

import (
	"math"
	"sync"
	"testing"
	"time"
)

func TestCPUHistoryUsesOnlyAvailableNewReadings(t *testing.T) {
	h := newCPUHistory()
	now := time.Now()
	good := NodeStats{Name: "node", CPU: []float64{20, 80}, UpdatedAt: now.UnixNano(), TTLSeconds: 10}
	h.observe([]NodeStats{good}, now)
	h.observe([]NodeStats{good}, now.Add(time.Second))
	older := good
	older.UpdatedAt--
	h.observe([]NodeStats{older}, now)
	bad := []NodeStats{
		{Name: "offline", CPU: []float64{10}},
		{Name: "missing", UpdatedAt: now.UnixNano()},
		{Name: "future", CPU: []float64{10}, UpdatedAt: now.Add(time.Second).UnixNano()},
		{Name: "expired", CPU: []float64{10}, UpdatedAt: now.Add(-time.Minute).UnixNano()},
		{Name: "invalid", CPU: []float64{math.NaN()}, UpdatedAt: now.UnixNano()},
		{Name: "range", CPU: []float64{101}, UpdatedAt: now.UnixNano()},
	}
	h.observe(bad, now)
	points := h.snapshot()
	if len(points) != 1 || len(points["node"]) != 1 {
		t.Fatalf("unexpected observations: %+v", points)
	}
	point := points["node"][0]
	if point.Average != 50 || point.Peak != 80 || point.At != now.UnixMilli() {
		t.Fatalf("wrong observation: %+v", point)
	}
	points["node"][0].Average = 99
	if h.snapshot()["node"][0].Average != 50 {
		t.Fatal("snapshot mutated the retained ring")
	}
}

func TestCPUHistoryBoundsPointsTimeAndNodes(t *testing.T) {
	h := newCPUHistory()
	now := time.Now()
	for i := 0; i < maxHistoryPoints+20; i++ {
		at := now.Add(time.Duration(i) * time.Second)
		h.observe([]NodeStats{{Name: "busy", CPU: []float64{10}, UpdatedAt: at.UnixNano()}}, at)
	}
	if got := len(h.snapshot()["busy"]); got != maxHistoryPoints {
		t.Fatalf("ring has %d points", got)
	}
	h.observe(nil, now.Add(cpuHistoryWindow+maxHistoryPoints*time.Second+time.Minute))
	if len(h.snapshot()) != 0 {
		t.Fatal("expired nodes remain in history")
	}
	nodes := make([]NodeStats, maxHistoryNodes+10)
	for i := range nodes {
		nodes[i] = NodeStats{Name: string(rune(i + 1)), CPU: []float64{10}, UpdatedAt: now.UnixNano()}
	}
	h.observe(nodes, now)
	if len(h.snapshot()) != maxHistoryNodes {
		t.Fatal("unbounded node retention")
	}
}

func TestCPUHistoryConcurrentCaptureAndRender(t *testing.T) {
	h := newCPUHistory()
	var wg sync.WaitGroup
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				now := time.Now()
				h.observe([]NodeStats{{Name: "node", CPU: []float64{10}, UpdatedAt: now.UnixNano()}}, now)
				h.snapshot()
			}
		}()
	}
	wg.Wait()
}

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
	if h.coreValues != maxHistoryPoints {
		t.Fatal("dropped observations did not release their core vectors")
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
				h.snapshotWithCores("node")
			}
		}()
	}
	wg.Wait()
}

func TestCoreHistoryPrecisionSelectionAndOwnership(t *testing.T) {
	h := newCPUHistory()
	now := time.Now()
	h.observe([]NodeStats{{Name: "a", CPU: []float64{0, 12.34, 99.96}, UpdatedAt: now.UnixNano()}, {Name: "b", CPU: []float64{20}, UpdatedAt: now.UnixNano()}}, now)
	if h.snapshot()["a"][0].CoreTenths != nil {
		t.Fatal("ordinary history includes core vectors")
	}
	selected := h.snapshotWithCores("a")
	cores := selected["a"][0].CoreTenths
	if len(cores) != 3 || cores[0] != 0 || cores[1] != 123 || cores[2] != 1000 || selected["b"][0].CoreTenths != nil {
		t.Fatalf("incorrect selected history: %+v", selected)
	}
	cores[1] = 0
	if h.snapshotWithCores("a")["a"][0].CoreTenths[1] != 123 {
		t.Fatal("snapshot aliases the retained vector")
	}
	now = now.Add(time.Second)
	h.observe([]NodeStats{{Name: "a", CPU: []float64{50}, UpdatedAt: now.UnixNano()}}, now)
	if len(h.snapshotWithCores("a")["a"][1].CoreTenths) != 1 {
		t.Fatal("CPU count changes were not retained")
	}
}

func TestCoreHistoryMemoryBudgetAndExpiry(t *testing.T) {
	h := newCPUHistory()
	now := time.Now()
	cores := make([]float64, 32768)
	// Fill the budget without reaching either the point or time limits.
	for i := 0; i < maxCoreHistoryValues/len(cores)+1; i++ {
		at := now.Add(time.Duration(i) * time.Second)
		h.observe([]NodeStats{{Name: "big", CPU: cores, UpdatedAt: at.UnixNano()}}, at)
	}
	points := h.snapshotWithCores("big")["big"]
	if h.coreValues != maxCoreHistoryValues || len(points[len(points)-1].CoreTenths) != 0 {
		t.Fatal("core vector budget exceeded")
	}
	if len(points) != maxCoreHistoryValues/len(cores)+1 {
		t.Fatal("aggregate history stopped when core budget filled")
	}
	h.observe(nil, now.Add(cpuHistoryWindow+3*time.Minute))
	if h.coreValues != 0 {
		t.Fatal("expired core vectors did not release budget")
	}
	newTime := now.Add(cpuHistoryWindow + 3*time.Minute)
	h.observe([]NodeStats{{Name: "small", CPU: []float64{3}, UpdatedAt: newTime.UnixNano()}}, newTime)
	if len(h.snapshotWithCores("small")["small"][0].CoreTenths) != 1 {
		t.Fatal("released budget cannot be reused")
	}
}

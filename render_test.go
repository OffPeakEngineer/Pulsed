package main

import (
	"bytes"
	"fmt"
	"math"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestDashboardCoreBandsPreserveEveryCoreAndHotspots(t *testing.T) {
	for _, count := range []int{0, 1, 8, 32, 33, 64, 192, 256, 1024, 2048} {
		t.Run(fmt.Sprint(count), func(t *testing.T) {
			cpus := make([]float64, count)
			if count > 0 {
				cpus[count-1] = 99
			}
			cell := dashboardCell(NodeStats{CPU: cpus, UpdatedAt: time.Now().UnixNano()})
			if len(cell.Cores) != count || len(cell.Bands) != min(count, maxCoreBands) {
				t.Fatalf("%d cores: got %d readings, %d bands", count, len(cell.Cores), len(cell.Bands))
			}
			next := 0
			for _, band := range cell.Bands {
				if band.First != next || band.Last < band.First {
					t.Fatalf("gap or overlap: %+v after %d", band, next)
				}
				next = band.Last + 1
			}
			if next != count {
				t.Fatalf("bands cover %d of %d cores", next, count)
			}
			if count > 0 && cell.Bands[len(cell.Bands)-1].Peak != 99 {
				t.Fatal("hotspot lost in overview")
			}
		})
	}
}

func TestDashboardMissingOfflineAndOutOfRangeMetrics(t *testing.T) {
	cell := dashboardCell(NodeStats{UpdatedAt: time.Now().UnixNano(), CPU: []float64{-1, 150, math.NaN(), math.Inf(1)}})
	for _, core := range cell.Cores {
		if core.Percent < 0 || core.Percent > 100 || math.IsNaN(core.Percent) || math.IsInf(core.Percent, 0) {
			t.Fatalf("invalid meter: %+v", core)
		}
	}
	if cell.MemPct != 0 {
		t.Fatal("missing memory is not zero-safe")
	}
	cell = dashboardCell(NodeStats{CPU: []float64{99}})
	if len(cell.Cores) != 0 || len(cell.Bands) != 0 || cell.AgeLabel != "No heartbeat available" {
		t.Fatalf("offline node exposes old core readings: %+v", cell)
	}
}

func TestDashboardResponsiveFixtures(t *testing.T) {
	now := time.Now()
	var nodes []cellData
	for i, count := range []int{4, 192, 8, 64, 256, 1024, 0, 16, 32, 2, 48, 128} {
		stats := NodeStats{Name: fmt.Sprintf("rack-%02d", i+1), CPU: make([]float64, count), MemUsed: uint64(i+1) * 8 << 30, MemTotal: 128 << 30, UpdatedAt: now.UnixNano(), Version: appVersion, Load: [3]float64{float64(i) * 1.4, 0.4, 0.6}}
		for j := range stats.CPU {
			stats.CPU[j] = float64((j*13 + i*7) % 101)
		}
		if i == 0 {
			stats.Name = "edge-01"
		}
		if i == 1 {
			stats.Name = "compute-192"
		}
		if i == 5 {
			stats.Name = "large-host-1024-with-a-very-long-name.cluster.internal"
		}
		if i == 6 {
			stats.MemTotal = 0
		}
		if i == 8 {
			stats.UpdatedAt = now.Add(-10 * time.Second).UnixNano()
		}
		if i == 9 {
			stats.UpdatedAt = 0
		}
		nodes = append(nodes, dashboardCell(stats))
	}
	var buf bytes.Buffer
	err := pageTmpl.Execute(&buf, pageData{Nodes: nodes, Theme: "dark", Palette: "monochrome", RefreshMs: 3000, RefreshLabel: "3.0s", RefreshURL: "/dashboard.html?theme=dark&palette=monochrome", BestHint: "Preview · synthetic mixed-hardware cluster", Summary: clusterSummary{Fresh: 10, Stale: 1, Offline: 1, HasHot: true, Hottest: "compute-192", HotCPU: 49, HotLoad: 1.4}})
	if err != nil {
		t.Fatal(err)
	}
	body := buf.String()
	if strings.Contains(body, "ZgotmplZ") {
		t.Fatal("template produced unsafe value placeholder")
	}
	if !strings.Contains(body, "Inspect 1024 logical CPUs") || !strings.Contains(body, "CPU 1023 usage") {
		t.Fatal("high-core detail truncated")
	}
	if strings.Contains(body, "<pre>") || strings.Contains(body, "location.replace('?'") {
		t.Fatal("legacy layout still active")
	}
	if dir := os.Getenv("PULSED_PREVIEW_DIR"); dir != "" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "dashboard.html"), buf.Bytes(), 0644); err != nil {
			t.Fatal(err)
		}
	}
}

func TestDashboardRefreshKeepsProxyRoute(t *testing.T) {
	db := openTestDB(t)
	rr := httptest.NewRecorder()
	makeHandler(db, "node-a").ServeHTTP(rr, httptest.NewRequest("GET", "/dashboard?pulsed_node=node-a&theme=light", nil))
	if rr.Code != 200 {
		t.Fatalf("status %d", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), `/dashboard?pulsed_node=node-a`) {
		t.Fatal("refresh lost the proxy route")
	}
}

func TestDashboardDoesNotLinkNodesWithoutWebURL(t *testing.T) {
	db := openTestDB(t)
	now := time.Now().UnixNano()
	nodes := []NodeStats{
		{
			Name:      "sync-only",
			Version:   appVersion,
			UpdatedAt: now,
			CPU:       []float64{10},
			MemTotal:  100,
			MemUsed:   25,
		},
		{
			Name:      "web-node",
			Version:   appVersion,
			WebURL:    "https://pulsed.example.com/?pulsed_node=web-node",
			UpdatedAt: now,
			CPU:       []float64{20},
			MemTotal:  100,
			MemUsed:   30,
		},
	}
	for _, node := range nodes {
		if err := dbSet(db, node); err != nil {
			t.Fatalf("set %s: %v", node.Name, err)
		}
	}

	req := httptest.NewRequest("GET", "/?theme=dark&palette=monochrome", nil)
	rr := httptest.NewRecorder()
	makeHandler(db, "web-node").ServeHTTP(rr, req)

	if rr.Code != 200 {
		t.Fatalf("status = %d, want 200", rr.Code)
	}
	body := rr.Body.String()
	if !strings.Contains(body, `<span class="node-name">sync-only</span>`) {
		t.Fatalf("sync-only node was not rendered as non-link text:\n%s", body)
	}
	if strings.Contains(body, `<a href="/">sync-only</a>`) || strings.Contains(body, `>sync-only</a>`) {
		t.Fatalf("sync-only node rendered as a link:\n%s", body)
	}
	if !strings.Contains(body, `>web-node</a>`) {
		t.Fatalf("web node was not rendered as a link:\n%s", body)
	}
}

func TestNodeHealthDistinguishesFreshStaleOffline(t *testing.T) {
	now := time.Now()
	cases := []struct {
		name string
		node NodeStats
		want healthState
	}{
		{
			name: "fresh",
			node: NodeStats{UpdatedAt: now.Add(-2 * time.Second).UnixNano(), TTLSeconds: 10},
			want: healthFresh,
		},
		{
			name: "stale",
			node: NodeStats{UpdatedAt: now.Add(-7 * time.Second).UnixNano(), TTLSeconds: 10},
			want: healthStale,
		},
		{
			name: "offline",
			node: NodeStats{UpdatedAt: now.Add(-11 * time.Second).UnixNano(), TTLSeconds: 10},
			want: healthOffline,
		},
		{
			name: "zero timestamp offline",
			node: NodeStats{},
			want: healthOffline,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := nodeHealth(tc.node).State; got != tc.want {
				t.Fatalf("state = %s, want %s", got, tc.want)
			}
		})
	}
}

func TestSummarizeClusterCountsStatesAndHottestOnlineNode(t *testing.T) {
	now := time.Now()
	summary := summarizeCluster([]NodeStats{
		{Name: "fresh-hot", UpdatedAt: now.UnixNano(), TTLSeconds: 10, CPU: []float64{20}, Load: [3]float64{0.5}},
		{Name: "stale-hot", UpdatedAt: now.Add(-7 * time.Second).UnixNano(), TTLSeconds: 10, CPU: []float64{70}, Load: [3]float64{1.2}},
		{Name: "offline", UpdatedAt: 0, TTLSeconds: 10, CPU: []float64{99}, Load: [3]float64{9}},
	})

	if summary.Fresh != 1 || summary.Stale != 1 || summary.Offline != 1 {
		t.Fatalf("counts = fresh %d stale %d offline %d, want 1/1/1", summary.Fresh, summary.Stale, summary.Offline)
	}
	if !summary.HasHot || summary.Hottest != "fresh-hot" {
		t.Fatalf("hottest = %q has=%t, want fresh-hot", summary.Hottest, summary.HasHot)
	}
}

func TestDashboardRendersClusterSummaryAndStateData(t *testing.T) {
	db := openTestDB(t)
	now := time.Now()
	nodes := []NodeStats{
		{Name: "fresh", Version: appVersion, UpdatedAt: now.UnixNano(), TTLSeconds: 10, CPU: []float64{20}, MemTotal: 100, MemUsed: 30},
		{Name: "stale", Version: appVersion, UpdatedAt: now.Add(-7 * time.Second).UnixNano(), TTLSeconds: 10, CPU: []float64{80}, MemTotal: 100, MemUsed: 40},
		{Name: "offline", Version: appVersion, UpdatedAt: 0, TTLSeconds: 10, CPU: []float64{90}, MemTotal: 100, MemUsed: 50},
	}
	for _, node := range nodes {
		if err := dbSet(db, node); err != nil {
			t.Fatalf("set %s: %v", node.Name, err)
		}
	}

	req := httptest.NewRequest("GET", "/?theme=dark&palette=monochrome", nil)
	rr := httptest.NewRecorder()
	makeHandler(db, "fresh").ServeHTTP(rr, req)

	body := rr.Body.String()
	for _, want := range []string{
		`online 1`,
		`stale 1`,
		`offline 1`,
		`data-state="stale"`,
		`id="sort-select"`,
		`id="hide-offline"`,
		`value="cpuAvg"`,
		`value="cpuMax"`,
		`value="memPct"`,
		`value="memUsed"`,
		`value="memTotal"`,
		`value="load1"`,
		`value="load5"`,
		`value="load15"`,
		`data-cpu-avg="20.000"`,
		`data-cpu-max="20.000"`,
		`data-mem-pct="30.000"`,
		`data-mem-used="30"`,
		`data-mem-total="100"`,
		`data-load1="0.000"`,
		`data-load5="0.000"`,
		`data-load15="0.000"`,
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("dashboard missing %q:\n%s", want, body)
		}
	}
}

func TestRenderANSIMarksLiveVersionMismatch(t *testing.T) {
	oldVersion := appVersion
	appVersion = "v2.0.0"
	t.Cleanup(func() { appVersion = oldVersion })

	out := renderANSI(NodeStats{
		Name:       "old-live-node",
		Version:    "v1.0.0",
		UpdatedAt:  time.Now().UnixNano(),
		TTLSeconds: 10,
		CPU:        []float64{5},
		MemTotal:   100,
		MemUsed:    20,
	})

	for _, want := range []string{"old-live-node", "version v1.0.0 (local v2.0.0)"} {
		if !strings.Contains(out, want) {
			t.Fatalf("render missing %q:\n%s", want, out)
		}
	}
}

func TestDashboardRendersLiveVersionMismatch(t *testing.T) {
	oldVersion := appVersion
	appVersion = "v2.0.0"
	t.Cleanup(func() { appVersion = oldVersion })

	db := openTestDB(t)
	if err := dbSet(db, NodeStats{
		Name:       "old-live-node",
		Version:    "v1.0.0",
		UpdatedAt:  time.Now().UnixNano(),
		TTLSeconds: 10,
		CPU:        []float64{5},
		MemTotal:   100,
		MemUsed:    20,
	}); err != nil {
		t.Fatalf("set old-live-node: %v", err)
	}

	req := httptest.NewRequest("GET", "/?theme=dark&palette=monochrome", nil)
	rr := httptest.NewRecorder()
	makeHandler(db, "old-live-node").ServeHTTP(rr, req)

	body := rr.Body.String()
	if !strings.Contains(body, "version v1.0.0 (local v2.0.0)") {
		t.Fatalf("dashboard missing version mismatch:\n%s", body)
	}
}

func TestSetNodeStatsTTLUsesConfiguredTTL(t *testing.T) {
	stats := NodeStats{Name: "node-a"}
	setNodeStatsTTL(&stats, 42*time.Second)
	if stats.TTLSeconds != 42 {
		t.Fatalf("ttl seconds = %d, want 42", stats.TTLSeconds)
	}
}

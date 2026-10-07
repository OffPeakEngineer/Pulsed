package main

import (
	"encoding/json"
	"io/fs"
	"math"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSnapshotAvailabilityAndSelectiveCoreDetail(t *testing.T) {
	now := time.Now()
	nodes := []NodeStats{
		{Name: "idle", UpdatedAt: now.UnixNano(), CPU: []float64{0, 0}, MemTotal: 100},
		{Name: "missing", UpdatedAt: now.UnixNano()},
		{Name: "offline", CPU: []float64{90}, MemTotal: 100, MemUsed: 50},
		{Name: "invalid", UpdatedAt: now.UnixNano(), CPU: []float64{math.NaN()}, Load: [3]float64{math.Inf(1)}},
	}
	snapshot := makeAPISnapshot(nodes, newCPUHistory(), "idle", httptest.NewRequest("GET", "/api/v1/snapshot?include_cores=idle", nil), now)
	if snapshot.Nodes[0].CPU.Average == nil || *snapshot.Nodes[0].CPU.Average != 0 || len(snapshot.Nodes[0].CPU.Cores) != 2 {
		t.Fatal("idle is a valid zero reading with requested core detail")
	}
	for _, node := range snapshot.Nodes[1:] {
		if node.CPU.Average != nil || node.Memory.Percent != nil || node.CPU.Cores != nil {
			t.Fatalf("unavailable metrics should be null: %+v", node)
		}
	}
	if snapshot.Nodes[2].Load != nil {
		t.Fatal("offline load should be null")
	}
	if snapshot.Nodes[3].Load != nil {
		t.Fatal("invalid load should be unavailable without breaking other nodes")
	}
	rr := httptest.NewRecorder()
	serveSnapshotResource(rr, httptest.NewRequest("GET", "/api/v1/nodes?node=idle", nil), snapshot)
	var decoded apiSnapshot
	if err := json.Unmarshal(rr.Body.Bytes(), &decoded); err != nil {
		t.Fatal(err)
	}
	if len(decoded.Nodes) != 1 || decoded.Nodes[0].Name != "idle" || rr.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("resource selection or caching failed")
	}
	for _, tc := range []struct {
		method, path string
		status       int
	}{{"GET", "/api/v1/nodes?node=unknown", 404}, {"POST", "/api/v1/snapshot", 405}, {"HEAD", "/api/v1/snapshot", 200}} {
		rr = httptest.NewRecorder()
		serveSnapshotResource(rr, httptest.NewRequest(tc.method, tc.path, nil), snapshot)
		if rr.Code != tc.status {
			t.Fatalf("%s %s returned %d", tc.method, tc.path, rr.Code)
		}
		if tc.method == "HEAD" && rr.Body.Len() != 0 {
			t.Fatal("HEAD returned a body")
		}
	}
}

func TestPagesEmbeddedRoutingAndJSONEndpoint(t *testing.T) {
	db := openTestDB(t)
	if err := dbSet(db, NodeStats{Name: "node-a", UpdatedAt: time.Now().UnixNano(), CPU: []float64{10}}); err != nil {
		t.Fatal(err)
	}
	handler := makeHandler(db, "node-a")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, httptest.NewRequest("GET", "/proxy/pages/?pulsed_node=node-a&theme=light", nil))
	if rr.Code != 200 {
		t.Fatalf("pages status %d", rr.Code)
	}
	body := rr.Body.String()
	for _, want := range []string{`src="/proxy/pages/pulsed-pages.js?pulsed_node=node-a&amp;theme=light"`, `baseURL:"/proxy/pages/"`, `id="tab-node"`, `href="/proxy/?pulsed_node=node-a&amp;theme=light"`} {
		if !strings.Contains(body, want) {
			t.Fatalf("pages missing %q", want)
		}
	}
	if strings.Contains(body, `id="tab-history"`) {
		t.Fatal("separate history tab remains")
	}
	if strings.Contains(body, `rel="prefetch"`) || strings.Contains(body, `type="importmap"`) {
		t.Fatal("unbundled browser dependencies remain")
	}
	for _, tc := range []struct {
		path   string
		status int
	}{{"/proxy/pages/pulsed-pages.js?pulsed_node=node-a", 200}, {"/proxy/pages/missing.js", 404}, {"/proxy/pages?pulsed_node=node-a", 307}, {"/proxy/api/v1/snapshot?pulsed_node=node-a", 200}, {"/api/v1/unknown", 404}} {
		rr = httptest.NewRecorder()
		handler.ServeHTTP(rr, httptest.NewRequest("GET", tc.path, nil))
		if rr.Code != tc.status {
			t.Fatalf("%s returned %d", tc.path, rr.Code)
		}
		if tc.status == 307 && rr.Header().Get("Location") != "/proxy/pages/?pulsed_node=node-a" {
			t.Fatal("redirect lost routing query")
		}
	}
	entries, err := fs.ReadDir(templateFS, "templates/assets/pages/_nuxt")
	if err != nil || len(entries) == 0 {
		t.Fatal("Go embed omitted Nuxt assets")
	}
}

func TestSnapshotRequestsCurrentCoresAndSelectedHistoryIndependently(t *testing.T) {
	now := time.Now()
	nodes := []NodeStats{{Name: "a", CPU: []float64{0, 50}, UpdatedAt: now.UnixNano()}, {Name: "b", CPU: []float64{80}, UpdatedAt: now.UnixNano()}, {Name: "c", CPU: []float64{10}, UpdatedAt: now.UnixNano()}}
	history := newCPUHistory()
	history.observe(nodes, now)
	snapshot := makeAPISnapshot(nodes, history, "a", httptest.NewRequest("GET", "/api/v1/snapshot?include_cores=a&include_cores=b&history_cores=b", nil), now)
	if len(snapshot.Nodes[0].CPU.Cores) != 2 || len(snapshot.Nodes[1].CPU.Cores) != 1 || snapshot.Nodes[2].CPU.Cores != nil {
		t.Fatal("current core selection failed")
	}
	if snapshot.History["a"][0].CoreTenths != nil || len(snapshot.History["b"][0].CoreTenths) != 1 || snapshot.History["c"][0].CoreTenths != nil {
		t.Fatal("history selection failed")
	}
}

func TestNodeDirectorySpecsSurviveOfflineState(t *testing.T) {
	s := NodeStats{Name: "worker", Role: "compute", CPU: []float64{10, 20}, MemTotal: 128 << 30}
	snapshot := makeAPISnapshot([]NodeStats{s}, newCPUHistory(), "peer", httptest.NewRequest("GET", "/api/v1/snapshot", nil), time.Now())
	node := snapshot.Nodes[0]
	if node.Role != "compute" || node.Memory.Total != 128<<30 || node.CPU.Count != 2 {
		t.Fatalf("missing directory specs: %+v", node)
	}
	if node.CPU.Average != nil || node.Memory.Percent != nil {
		t.Fatal("offline node exposes current utilization")
	}
}

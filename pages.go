package main

import (
	"encoding/json"
	"html"
	"io/fs"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

type apiCPU struct {
	Average *float64   `json:"average"`
	Peak    *float64   `json:"peak"`
	Count   int        `json:"count"`
	Cores   []coreData `json:"cores,omitempty"`
}

type apiMemory struct {
	Percent *float64 `json:"percent"`
	Label   string   `json:"label"`
}

type apiNode struct {
	Name      string      `json:"name"`
	State     healthState `json:"state"`
	Age       float64     `json:"ageSeconds"`
	UpdatedAt int64       `json:"updatedAt"`
	TTL       int         `json:"ttlSeconds"`
	Version   string      `json:"version"`
	WebURL    string      `json:"webURL"`
	CPU       apiCPU      `json:"cpu"`
	Memory    apiMemory   `json:"memory"`
	Load      *[3]float64 `json:"load"`
}

type apiSummary struct {
	Fresh   int    `json:"fresh"`
	Stale   int    `json:"stale"`
	Offline int    `json:"offline"`
	Hottest string `json:"hottest"`
}

type apiSnapshot struct {
	SchemaVersion   int                         `json:"schemaVersion"`
	GeneratedAt     int64                       `json:"generatedAt"`
	ServingNode     string                      `json:"servingNode"`
	RefreshMs       int                         `json:"refreshMs"`
	RefreshURL      string                      `json:"refreshURL"`
	HistoryWindowMs int64                       `json:"historyWindowMs"`
	Summary         apiSummary                  `json:"summary"`
	Nodes           []apiNode                   `json:"nodes"`
	History         map[string][]cpuObservation `json:"history"`
}

func makeAPISnapshot(nodes []NodeStats, history *cpuHistory, selfName string, r *http.Request, now time.Time) apiSnapshot {
	summary := summarizeCluster(nodes)
	snapshot := apiSnapshot{
		SchemaVersion: 1, GeneratedAt: now.UnixMilli(), ServingNode: selfName,
		RefreshMs: computeRefreshIntervalMs(nodes), HistoryWindowMs: cpuHistoryWindow.Milliseconds(),
		Summary: apiSummary{summary.Fresh, summary.Stale, summary.Offline, summary.Hottest},
		Nodes: make([]apiNode, 0, len(nodes)), History: history.snapshot(),
	}
	if peer := findLowerLoadRedirect(nodes, selfName); peer != nil {
		snapshot.RefreshURL = pageURL(peer.WebURL, displayQuery(r))
	}
	for _, s := range nodes {
		cell := dashboardCell(s)
		node := apiNode{
			Name: s.Name, State: cell.State, Age: cell.Age, UpdatedAt: s.UpdatedAt / int64(time.Millisecond),
			TTL: int(nodeTTL(s) / time.Second), Version: cell.Version,
			CPU: apiCPU{Count: len(s.CPU)}, Memory: apiMemory{Label: "Unavailable"},
		}
		if parsed, err := url.Parse(s.WebURL); err == nil && parsed.User == nil && parsed.Host != "" && (parsed.Scheme == "http" || parsed.Scheme == "https") {
			node.WebURL = pageURL(s.WebURL, displayQuery(r))
		}
		if cell.State != healthOffline {
			if len(s.CPU) > 0 {
				node.CPU.Average, node.CPU.Peak = &cell.CPUAvg, &cell.CPUMax
				if r.URL.Query().Get("include_cores") == s.Name {
					node.CPU.Cores = cell.Cores
				}
			}
			if s.MemTotal > 0 {
				node.Memory.Percent, node.Memory.Label = &cell.MemPct, cell.MemLabel
			}
			node.Load = &s.Load
		}
		snapshot.Nodes = append(snapshot.Nodes, node)
	}
	return snapshot
}

func serveSnapshotResource(w http.ResponseWriter, r *http.Request, snapshot apiSnapshot) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if name := r.URL.Query().Get("node"); name != "" && !strings.HasSuffix(r.URL.Path, "/snapshot") {
		found := false
		for _, node := range snapshot.Nodes {
			if node.Name == name {
				snapshot.Nodes = []apiNode{node}
				snapshot.History = map[string][]cpuObservation{name: snapshot.History[name]}
				found = true
				break
			}
		}
		if !found {
			http.Error(w, "node not found", http.StatusNotFound)
			return
		}
	}
	encoded, err := json.Marshal(snapshot)
	if err != nil {
		http.Error(w, "snapshot error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	if r.Method != http.MethodHead {
		_, _ = w.Write(encoded)
	}
}

var pagesAssetAttribute = regexp.MustCompile(`(src|href)="(/pages/[^"#]*)"`)

func makePagesHandler() http.HandlerFunc {
	assets, _ := fs.Sub(templateFS, "templates/assets/pages")
	files := http.FileServer(http.FS(assets))
	return func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/pages") {
			target := *r.URL
			target.Path += "/"
			http.Redirect(w, r, target.String(), http.StatusTemporaryRedirect)
			return
		}
		i := strings.LastIndex(r.URL.Path, "/pages/")
		if i < 0 {
			http.NotFound(w, r)
			return
		}
		assetPath := strings.TrimPrefix(r.URL.Path[i+len("/pages/"):], "/")
		if assetPath != "" && assetPath != "index.html" {
			request := r.Clone(r.Context())
			request.URL.Path = "/" + assetPath
			w.Header().Set("Cache-Control", "no-cache")
			files.ServeHTTP(w, request)
			return
		}
		index, err := fs.ReadFile(assets, "index.html")
		if err != nil {
			http.Error(w, "pages assets unavailable", http.StatusServiceUnavailable)
			return
		}
		// EscapedPath keeps the proxy prefix safe in both HTML and inline JSON.
		base := (&url.URL{Path: r.URL.Path[:i] + "/pages/"}).EscapedPath()
		markup := pagesAssetAttribute.ReplaceAllStringFunc(string(index), func(attribute string) string {
			match := pagesAssetAttribute.FindStringSubmatch(attribute)
			assetURL := base + strings.TrimPrefix(match[2], "/pages/")
			parsed, _ := url.Parse(assetURL)
			query := parsed.Query()
			for key, values := range r.URL.Query() {
				query[key] = values
			}
			parsed.RawQuery = query.Encode()
			return match[1] + `="` + html.EscapeString(parsed.String()) + `"`
		})
		markup = strings.ReplaceAll(markup, `"/pages/"`, `"`+base+`"`)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write([]byte(markup))
	}
}

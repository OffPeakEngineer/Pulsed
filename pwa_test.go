package main

import (
	"encoding/json"
	"image/png"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"testing"
)

// Opt in with PULSED_PWA_BROWSER_NODE and the browser variables documented in
// docs/05_building. The real HTTP handler runs without starting cluster gossip.
func TestAppBrowser(t *testing.T) {
	node := os.Getenv("PULSED_PWA_BROWSER_NODE")
	if node == "" {
		t.Skip("set PULSED_PWA_BROWSER_NODE to run browser installation checks")
	}
	server := httptest.NewServer(makeHandler(openTestDB(t), "browser-test"))
	defer server.Close()
	command := exec.Command(node, "scripts/check-pwa.mjs")
	command.Env = append(os.Environ(), "PULSED_PREVIEW_URL="+server.URL)
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("browser checks: %v\n%s", err, output)
	}
	t.Log(string(output))
}

func TestAppManifestPreservesLaunchRouteAndIdentity(t *testing.T) {
	handler := makeHandler(openTestDB(t), "node-a")
	for _, base := range []string{"/", "/proxy/", "/status-pages/", "/proxy/space name/"} {
		for _, view := range []string{"", "pages/"} {
			target := (&url.URL{Path: base + view + "manifest.webmanifest", RawQuery: "pulsed_node=node-a&theme=light&focus=worker"}).String()
			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, httptest.NewRequest("GET", target, nil))
			if rr.Code != 200 || !strings.HasPrefix(rr.Header().Get("Content-Type"), "application/manifest+json") {
				t.Fatalf("manifest %s: %d %v", target, rr.Code, rr.Header())
			}
			var manifest appManifest
			if err := json.Unmarshal(rr.Body.Bytes(), &manifest); err != nil {
				t.Fatal(err)
			}
			launch, _ := url.Parse(manifest.StartURL)
			identity, _ := url.Parse(manifest.ID)
			if launch.Path != base+view || launch.Query().Get("pulsed_node") != "node-a" || launch.Query().Get("focus") != "worker" || launch.Query().Get("theme") != "light" {
				t.Fatalf("lost launch routing: %+v", manifest)
			}
			if manifest.Scope != (&url.URL{Path: base}).EscapedPath() || manifest.Display != "standalone" || identity.Path != base || identity.RawQuery != "pulsed_node=node-a" {
				t.Fatalf("unstable identity or scope: %+v", manifest)
			}
			if len(manifest.Icons) != 2 {
				t.Fatalf("missing install icons: %+v", manifest)
			}
			for _, icon := range manifest.Icons {
				iconURL, _ := url.Parse(icon.Src)
				if !strings.HasPrefix(iconURL.Path, base+view) || iconURL.Query().Get("pulsed_node") != "node-a" {
					t.Fatalf("lost icon routing: %+v", icon)
				}
			}
		}
	}
}

func TestAppResourcesAndDashboardLinks(t *testing.T) {
	handler := makeHandler(openTestDB(t), "node-a")
	for _, route := range []string{"/proxy/?pulsed_node=node-a", "/proxy/pages/?pulsed_node=node-a"} {
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, httptest.NewRequest("GET", route, nil))
		body := rr.Body.String()
		for _, want := range []string{`rel="manifest"`, `manifest.webmanifest?pulsed_node=node-a`, `pwa.js?pulsed_node=node-a`, `rel="apple-touch-icon"`, `name="theme-color"`} {
			if !strings.Contains(body, want) {
				t.Fatalf("%s missing %q", route, want)
			}
		}
	}
	for _, resource := range []string{"manifest.webmanifest", "pwa.js", "sw.js", "app-icon-180.png", "app-icon-192.png", "app-icon-512.png"} {
		for _, prefix := range []string{"/proxy/", "/proxy/pages/"} {
			target := prefix + resource + "?pulsed_node=node-a"
			for _, method := range []string{"GET", "HEAD", "POST"} {
				rr := httptest.NewRecorder()
				handler.ServeHTTP(rr, httptest.NewRequest(method, target, nil))
				if method == "POST" {
					if rr.Code != 405 || rr.Header().Get("Allow") != "GET, HEAD" {
						t.Fatalf("write accepted for %s", target)
					}
					continue
				}
				if rr.Code != 200 || rr.Header().Get("Cache-Control") != "no-cache" {
					t.Fatalf("%s %s: %d %v", method, target, rr.Code, rr.Header())
				}
				if method == "HEAD" && rr.Body.Len() != 0 {
					t.Fatalf("HEAD returned a body for %s", target)
				}
				if method == "GET" && strings.HasSuffix(resource, ".png") {
					icon, err := png.Decode(rr.Body)
					if err != nil {
						t.Fatal(err)
					}
					want := map[string]int{"app-icon-180.png": 180, "app-icon-192.png": 192, "app-icon-512.png": 512}[resource]
					_, _, _, alpha := icon.At(0, 0).RGBA()
					if icon.Bounds().Dx() != want || icon.Bounds().Dy() != want || alpha != 65535 {
						t.Fatalf("invalid app icon %s: %v, alpha %d", resource, icon.Bounds(), alpha)
					}
				}
			}
		}
	}
}

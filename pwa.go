package main

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"io/fs"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"
)

type appIcon struct {
	Src   string `json:"src"`
	Sizes string `json:"sizes"`
	Type  string `json:"type"`
}

type appManifest struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	ShortName       string    `json:"short_name"`
	Description     string    `json:"description"`
	StartURL        string    `json:"start_url"`
	Scope           string    `json:"scope"`
	Display         string    `json:"display"`
	BackgroundColor string    `json:"background_color"`
	ThemeColor      string    `json:"theme_color"`
	Icons           []appIcon `json:"icons"`
}

// Keep the release self-contained. Derive correctly sized, opaque app icons
// from the embedded branding once, without adding a runtime image dependency.
var applicationIcons = sync.OnceValues(func() (map[string][]byte, error) {
	data, err := templateFS.ReadFile("templates/assets/branding/pulsed-logo.png")
	if err != nil {
		return nil, err
	}
	source, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	icons := make(map[string][]byte)
	for _, size := range []int{180, 192, 512} {
		icon := image.NewRGBA(image.Rect(0, 0, size, size))
		draw.Draw(icon, icon.Bounds(), image.NewUniform(color.RGBA{7, 16, 25, 255}), image.Point{}, draw.Src)
		// Area averaging retains the original artwork's fine lines at small sizes.
		bounds := source.Bounds()
		for y := 0; y < size; y++ {
			for x := 0; x < size; x++ {
				var red, green, blue, alpha, count uint64
				for sy := y * bounds.Dy() / size; sy < (y+1)*bounds.Dy()/size; sy++ {
					for sx := x * bounds.Dx() / size; sx < (x+1)*bounds.Dx()/size; sx++ {
						r, g, b, a := source.At(bounds.Min.X+sx, bounds.Min.Y+sy).RGBA()
						red += uint64(r)
						green += uint64(g)
						blue += uint64(b)
						alpha += uint64(a)
						count++
					}
				}
				if count > 0 {
					pixel := image.NewUniform(color.RGBA64{uint16(red / count), uint16(green / count), uint16(blue / count), uint16(alpha / count)})
					draw.Draw(icon, image.Rect(x, y, x+1, y+1), pixel, image.Point{}, draw.Over)
				}
			}
		}
		var encoded bytes.Buffer
		if err := png.Encode(&encoded, icon); err != nil {
			return nil, err
		}
		icons["app-icon-"+strconv.Itoa(size)+".png"] = encoded.Bytes()
	}
	return icons, nil
})

// These routes precede Pages and dashboard handling, including when a reverse
// proxy preserves its prefix. Manifest URLs carry the same peer-routing query
// as the dashboard; the worker never stores that dashboard or its telemetry.
func serveAppResource(w http.ResponseWriter, r *http.Request) bool {
	name := path.Base(r.URL.Path)
	if name != "manifest.webmanifest" && name != "pwa.js" && name != "sw.js" &&
		name != "app-icon-180.png" && name != "app-icon-192.png" && name != "app-icon-512.png" {
		return false
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return true
	}
	w.Header().Set("Cache-Control", "no-cache")
	var data []byte
	var err error
	switch name {
	case "manifest.webmanifest":
		view := strings.TrimSuffix(r.URL.Path, name)
		base := view
		if strings.HasSuffix(view, "/pages/") {
			base = strings.TrimSuffix(view, "pages/")
		}
		identity := url.Values{}
		if peer := r.URL.Query().Get("pulsed_node"); peer != "" {
			identity.Set("pulsed_node", peer)
		}
		manifest := appManifest{
			ID: pageURL(base, identity), Name: "Pulsed", ShortName: "Pulsed",
			Description: "Live cluster health, CPU and memory monitoring",
			StartURL:    pageURL(view, r.URL.Query()), Scope: (&url.URL{Path: base}).EscapedPath(),
			Display: "standalone", BackgroundColor: "#071019", ThemeColor: "#071019",
		}
		for _, size := range []string{"192", "512"} {
			manifest.Icons = append(manifest.Icons, appIcon{
				Src:   (&url.URL{Path: view + "app-icon-" + size + ".png", RawQuery: r.URL.RawQuery}).String(),
				Sizes: size + "x" + size, Type: "image/png",
			})
		}
		data, err = json.Marshal(manifest)
		w.Header().Set("Content-Type", "application/manifest+json; charset=utf-8")
	case "pwa.js", "sw.js":
		data, err = fs.ReadFile(templateFS, "templates/assets/pwa/"+name)
		w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
	default:
		var icons map[string][]byte
		icons, err = applicationIcons()
		data = icons[name]
		w.Header().Set("Content-Type", "image/png")
	}
	if err != nil {
		http.Error(w, "app resource unavailable", http.StatusInternalServerError)
		return true
	}
	http.ServeContent(w, r, name, time.Time{}, bytes.NewReader(data))
	return true
}

# Building pulsed

Build and release docs belong here: local builds, cross-compilation, release
artifacts, CI, and packaging assumptions.

## Dashboard regression checks

Run `go test ./...` and `go build ./...` using the Go 1.25 toolchain used by CI.
The dashboard tests include 0 through 2,048 logical CPUs, grouped hotspots,
missing metrics, offline nodes, version labels, and proxy routing.

Generate an optional synthetic 12-node cluster preview without running discovery
or joining a real cluster:

```sh
PULSED_PREVIEW_DIR=/tmp/pulsed-preview go test -run TestDashboardResponsiveFixtures
python3 -m http.server 4319 --bind 127.0.0.1 --directory /tmp/pulsed-preview
```

Open `http://127.0.0.1:4319/dashboard.html`. This contains synthetic data, including
a 1,024-core host. It does not represent your actual cluster.

For browser checks, install Playwright into an external temporary directory:

```sh
npm install --prefix /tmp/pulsed-browser --no-package-lock playwright
PULSED_PLAYWRIGHT_MODULE=/tmp/pulsed-browser/node_modules/playwright/index.mjs \
PULSED_CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
PULSED_SCREENSHOTS=/tmp/pulsed-preview \
node scripts/check-dashboard.mjs
```

Set `PULSED_CHROME` to your local Chrome/Chromium executable, or omit it if
Playwright's bundled Chromium is installed. `PULSED_SCREENSHOTS` is optional.
The script checks widths from 320 to 2,560 pixels in both densities, expanded
core bounds, filtering, refresh/pause/resume, state transfer between origins,
blocked storage, and native core disclosure with JavaScript disabled.

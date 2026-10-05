# Building pulsed

Build and release docs belong here: local builds, cross-compilation, release
artifacts, CI, and packaging assumptions.

## GitLab CI and releases

`.gitlab-ci.yml` runs on merge requests and the default branch. It needs a Linux
runner that supports container images; no custom runner tags are required.

- `commitlint`: installs the lockfile with `npm ci`, tests the UI, builds and
  typechecks Pages, checks generated assets, and lints the MR or push commit
  range. An initial pipeline
  without a previous commit checks the current commit.
- `npm-audit`: reports high/critical build-tool vulnerabilities in a separate
  visible job. Advisory failures (exit code 1) do not block releases; install,
  build, typecheck, test, and commit checks remain required.
- `go-checks`: checks formatting, runs `go vet` and race tests, and retains a
  coverage profile. Coverage is reported without inheriting Ivy's 70% floor;
  Pulsed's initial measured baseline is 45.0%.
- `build-binaries`: cross-compiles Linux, macOS, and Windows for amd64 and arm64,
  with CGO disabled, and retains binaries and checksums for two weeks. These
  development artifacts use `0.0.0-dev.<commit>` as their embedded version.
- `release`: runs only on the default branch after validation and all builds
  pass. Semantic-release determines the next version from conventional commits,
  rebuilds the binaries with that tag in `main.appVersion`, creates the GitLab
  release, and uploads assets to the project's generic package registry. A
  `pulsed-release` resource group serializes releases. This job is not interruptible.

Go jobs and release builds use `GOTOOLCHAIN=go1.25.11`. The explicit pin avoids
the existing `cockroachdb/swiss` incompatibility with the locally installed Go
1.27 toolchain. The release container installs a Go launcher and downloads the
pinned toolchain into its cache as needed. Node jobs use the Node 22 image and
its bundled npm with the committed lockfile. Frontend tooling requires Node
22.19 or newer. Install jobs log Node and npm versions to make future resolver
differences inspectable. Regenerate the lockfile locally with `npm install` when
changing dependencies, commit it, and keep `npm ci` in CI.

Before the first release, configure a **masked, protected** `GL_TOKEN` CI/CD
variable, protect the default branch, and enable the project's package registry.
Use a project/group/personal access token with `api` and `write_repository`
scopes and a role allowed to push release tags. Protected tag rules must allow
that identity to create `v*` tags. No npm publishing token is needed.
The token requirements follow the
[@semantic-release/gitlab authentication documentation](https://github.com/semantic-release/gitlab#gitlab-authentication).

Release links have stable asset paths such as
`/-/releases/v1.2.3/downloads/pulsed-linux-amd64` and
`/-/releases/permalink/latest/downloads/pulsed-linux-amd64`. The Ansible release
installer uses these links. Download `checksums.sha256` alongside the binaries
and run `sha256sum -c checksums.sha256` (or `shasum -a 256 -c checksums.sha256`).
Private projects still require authentication for downloads.

The Releases page lists all six OS/architecture binaries and `checksums.sha256`
under its asset links. Files are stored in the Generic Package Registry as
`pulsed/<version>/<filename>` (for example, `pulsed/1.2.3/pulsed-windows-amd64.exe`).
Keep asset labels equal to filenames: the GitLab semantic-release plugin uses
`label` for both the release link text and the uploaded package filename.

Release downloads do not depend on the two-week build job artifacts, so no
artifact "keep" API call is needed. Retain the corresponding `pulsed` package
versions; deleting them breaks the release download links. A release is only
published when conventional commits warrant a new version; MR builds and
default-branch commits that do not trigger a release only produce CI artifacts.

The former GitHub release workflow has been removed. The Go module path remains
`github.com/OffPeakEngineer/pulsed`; changing the module's public import path is
a separate compatibility decision.

Validate pipeline structure without starting a pipeline:

```sh
glab ci lint .gitlab-ci.yml --include-jobs
```

Local race tests and cross-compilation do not establish that every target runs
correctly on its native OS. Publication and token permissions are verified by
the first real GitLab release job.

## Versytl UI assets

The Versytl integration uses Shipkit dashboard/progress factories, Scene SVG
export, Stasis documents and Pages, and Bridge's explicit source registry. The
source snapshot is pinned by commit and hash in `frontend/vendor/manifest.json`;
it does not depend on the untracked local `versytl` symlink. Pulsed owns telemetry
adaptation in `frontend/charts.ts` and browser inspection in `frontend/main.ts`.

When changing frontend source, run:

```sh
npm ci
npm run test:ui
npm run build:pages
npm run typecheck:pages
```

Commit `templates/assets` and `frontend/pages/dashboards` with source changes.
TypeScript, esbuild, Vue, and Nuxt are
build-only dependencies; `go build` embeds the generated browser code and requires no
Node runtime, external asset host, or private registry. CI verifies source hashes,
runs frontend tests and Pages typechecking, and rejects generated-asset drift.
The Nuxt layer generates static HTML, CSS, and one browser module; Pulsed serves
them directly. No Nuxt server runs in the released daemon. The build bundles
lazy modules and links their scoped CSS so recovery views need no extra fetches.

The browser uses one bundled module, with the dashboard's query parameters on
its relative asset URL. This preserves `pulsed_node` on query-routed proxies;
snapshot requests also preserve the full route and node query.
The same applies to `/pages/`, including reverse-proxy prefixes. The server
rewrites the static base URL and initial links for the incoming route. There
are no CDN, package-registry, or pipeline-API calls from either dashboard.

Branding comes from `assets/Pulsed Logo.png`. `build:ui` copies it verbatim into
the embedded classic assets; `build:pages` embeds it in the header CSS and copies
the browser icon. The SVG contains live Gill Sans text, so the PNG avoids font
substitution on systems without that font. Keep the supplied `.afdesign`, SVG,
and PNG sources together when changing the artwork. Header logos are decorative
alongside the visible Pulsed name; asset links retain routed peer queries.

### Pulsed Pages source

`frontend/pulsed-source.ts` registers `pulsed/snapshot@1` with Bridge. The host
chooses the same-origin endpoint and refresh policy; SVG metadata cannot import
code or choose a network origin. `frontend/pages-scenes.ts` registers versioned
Overview, Node, and History providers and retains their payloads in exported
scene metadata. Unknown providers or versions keep their saved SVG.

`GET /api/v1/snapshot`, `/api/v1/nodes`, and `/api/v1/cpu-history` return the same
versioned, no-store JSON envelope: `schemaVersion`, generation time in Unix
milliseconds, serving peer, refresh interval/target, health summary, nodes, and
per-node CPU observations. The latter two routes accept `node=<name>` and return
404 for an unknown node. `include_cores=<name>` includes current per-core readings
only for that node. Node detail uses this to keep ordinary refreshes small.
Unavailable CPU, memory, and offline load values are `null`; valid idle values
are zero. All routes preserve `pulsed_node` and proxy prefixes. `HEAD` is supported;
other methods return 405. History uses the existing bounded, peer-local ring.

## Dashboard regression checks

Run `go test ./...` and `go build ./...` using the Go 1.25 toolchain used by CI.
The dashboard tests include 0 through 2,048 logical CPUs, grouped hotspots,
missing metrics, offline nodes, version labels, and proxy routing.

Generate an optional synthetic 12-node cluster preview without running discovery
or joining a real cluster:

```sh
PULSED_PREVIEW_DIR=/tmp/pulsed-preview go test -run TestDashboardResponsiveFixtures
PULSED_PREVIEW_DIR=/tmp/pulsed-preview PULSED_PREVIEW_PORT=4319 node scripts/preview-dashboard.cjs
```

Open `http://127.0.0.1:4319/dashboard.html`. This contains synthetic data, including
a 1,024-core host. It does not represent your actual cluster.
Open `/pages/` on that server to inspect the Stasis interface. The fixture's JSON
and static server simulate the source; Go handler tests exercise real routing.

For browser checks, install Playwright into an external temporary directory:

```sh
npm install --prefix /tmp/pulsed-browser --no-package-lock playwright
PULSED_PLAYWRIGHT_MODULE=/tmp/pulsed-browser/node_modules/playwright/index.mjs \
PULSED_CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
PULSED_SCREENSHOTS=/tmp/pulsed-preview \
node scripts/check-dashboard.mjs
PULSED_PREVIEW_URL=http://127.0.0.1:4319/pages/ node scripts/check-pages.mjs
```

Set `PULSED_CHROME` to your local Chrome/Chromium executable, or omit it if
Playwright's bundled Chromium is installed. `PULSED_SCREENSHOTS` is optional.
The script checks widths from 320 to 2,560 pixels in both densities, expanded
core bounds, Versytl charts, SVG downloads, missing history, filtering,
in-place refresh/pause/resume, state transfer between origins,
blocked storage, and native core disclosure with JavaScript disabled. Touch
layouts also check 44-pixel control targets, readable phone inputs, and expanded
CPU details without horizontal scrolling in portrait and landscape layouts.

The fixture includes synthetic CPU observations and an intentional gap. It
verifies presentation and browser behavior without joining a real cluster.
The Pages checks cover keyboard selection, proxy/query identity, missing data,
SVG provider metadata, failure retention, filters, densities, mobile controls,
core scroll preservation, and pagination for 40 nodes.

The development dependency audit is visible but nonblocking by project choice.
On 2026-10-05, updating semantic-release and its plugins and using Nuxt 4 reduced
the audit from 69 findings (including three critical) to 22 findings (21 high and
one moderate). `braces` and `node-forge` have advisories covering all reported
versions; additional findings are bundled into release tooling's npm dependency
and cannot be automatically fixed by `npm audit fix`. Forced fixes suggest
downgrading Nuxt and release tools and were not applied. These packages are build
tools and are not shipped as a Node runtime. Review this job as upstream patches
become available.

The pipeline repair was verified locally with Node 22.23.3 and npm 10.9.9:
`npm ci --prefer-offline`, all nine UI tests, Pages generation and typechecking,
and release-plugin loading, patch selection, and GitLab release-note generation
passed. The original clean-install failure was `Missing: meow@14.1.0 from lock
file`; a dry run did not expose it. Nuxt 3 also looked outside the existing
`app/` layout for CSS; Nuxt 4 builds that layout correctly. Generated Pages assets
were rebuilt with the updated toolchain. GitLab's CI lint API accepted the
configuration. Linux runner execution and authenticated GitLab publishing still
require the real pipeline.

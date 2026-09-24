# Building pulsed

Build and release docs belong here: local builds, cross-compilation, release
artifacts, CI, and packaging assumptions.

## GitLab CI and releases

`.gitlab-ci.yml` runs on merge requests and the default branch. It needs a Linux
runner that supports container images; no custom runner tags are required.

- `commitlint`: installs the lockfile with `npm ci`, audits high/critical npm
  vulnerabilities, and lints the MR or push commit range. An initial pipeline
  without a previous commit checks the current commit.
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
its bundled npm with the committed lockfile.

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
blocked storage, and native core disclosure with JavaScript disabled. Touch
layouts also check 44-pixel control targets, readable phone inputs, and expanded
CPU details without horizontal scrolling in portrait and landscape layouts.

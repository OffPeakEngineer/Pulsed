# Pulsed

[![CI](https://gitlab.com/off-peak.engineer/utilities/pulsed/badges/main/pipeline.svg)](https://gitlab.com/off-peak.engineer/utilities/pulsed/-/pipelines) [![Release](https://gitlab.com/off-peak.engineer/utilities/pulsed/-/badges/release.svg)](https://gitlab.com/off-peak.engineer/utilities/pulsed/-/releases)

**Pulsed is a resilient cluster htop daemon.** Run it on a few machines, open any node in a browser, and watch the whole cluster from a server-rendered dashboard. If the node serving your browser gets busy, it can send the next refresh to a quieter peer.

The result is intentionally simple: every node can serve the UI, every node shares fresh load metrics with its peers, and the browser can be hot-potatoed around the cluster without a central coordinator.

Deeper docs live in `docs/`; this README stays focused on quick start and common
deployment paths.

The main dashboard is the cluster performance overview, with one tiny 0–100% bar
per logical CPU. Each card links to its CPU history and node detail in Stasis.
Stasis opens to a node directory showing role, logical CPU count, memory capacity,
and version. Choose a node to see CPU history above its current metrics and core
inspection. `PULSED_ROLE` is an optional descriptive label published by each node;
older peers show “Role not set.” Specs remain visible for offline nodes, while
current utilization stays unavailable. Existing `#history` links open the combined
node page. SVG exports include the displayed history, current metrics, and core bars.

## Features

- **Cluster htop view**: CPU, memory, load, freshness, and offline status for every known node.
- **Responsive node cards**: compact summaries, searchable nodes, two display
  densities, and expandable core readings that stay bounded on large machines.
- **Versytl node inspector**: select a node, inspect recent mean/peak CPU trends,
  and export the graph as a portable Stasis SVG.
- **Hot-potato refresh**: a busy node can bake a lower-load peer into the next browser refresh.
- **Peer rebasing**: node links point at that node's own HTTP address, so the browser moves to the selected peer.
- **Zero-config LAN discovery**: nodes discover peers with mDNS.
- **Seed support**: provide explicit peers with `PULSED_SEEDS` when discovery is not enough.
- **Local-first resilience**: each node keeps enough recent state to keep rendering during peer churn.

## Quick Start

```bash
go install github.com/OffPeakEngineer/pulsed@latest
pulsed
```

If you prefer a shorter command name, you can alias it locally as `pls`:

```bash
alias pls=pulsed
pls
```

Or build from a checkout:

```bash
go build ./
./pulsed
```

Open:

```text
http://localhost:8080
```

Run the same binary on additional LAN machines and they should discover each other automatically. If the advertised browser URL needs to differ from the listen address, set `PULSED_ADVERTISE_HTTP`.

If you start `pulsed` again while an instance is already running on the machine, the second process does not open another writer on the same store or publish a duplicate node. When the existing `PULSED_DB` is locked, or the configured gossip port is already bound, it joins as a terminal-only mirror with a temporary database and renders the cluster view in your terminal.

## Configuration

### Dashboard controls

The browser dashboard keeps text readable as the window and cluster change size.
Each node shows average and peak CPU, memory usage, and the three load averages.
CPU counts refer to logical CPUs reported by the system.

In Comfortable density, up to 32 bands summarize contiguous groups of CPUs.
Each band's color reflects its busiest core, so a hotspot is not averaged away.
Expand **Inspect logical CPUs** to see every numbered CPU and its percentage in a
scrollable panel. Compact density hides the bands and reduces card spacing.

Search by node name, sort by a metric, and hide stale or offline nodes. Appearance
contains the existing themes and color palettes. **Pause refresh** holds the
current snapshot; **Refresh now** requests a new one. Automatic refresh and peer
links carry filters, density, selected node, history window, expanded panels,
and scroll position between views. Same-view refreshes update in place.
Keyboard interaction defers automatic refresh until focus leaves the control.

**Inspect history** selects a node without moving to its HTTP server. The CPU
chart shows mean usage and the busiest logical CPU on a fixed 0–100% scale, with
one-minute and five-minute windows. Gaps longer than the heartbeat TTL remain
disconnected. **Export SVG** saves a Stasis-compatible document with Versytl
scene/component metadata and the displayed observations.

History contains readings actually observed by the serving process, sampled
every two seconds and bounded to 150 points per node, five minutes, and 1,024
tracked nodes. It starts accumulating when the web server starts, resets on
restart, and switches to the destination peer's available history when rebasing.
Pulsed cannot reconstruct older CPU readings from its latest-heartbeat database.
Missing readings remain unavailable; they are not treated as zero CPU usage.

### Daemon settings

```bash
export PULSED_HTTP=":9000"                         # HTTP listen address, default :8080
export PULSED_ADVERTISE_HTTP="http://10.0.1.25:9000" # browser-reachable URL for this node
export PULSED_GOSSIP=":7947"                       # peer sync listen address, default :7946
export PULSED_SEEDS="10.0.1.20:7946,10.0.1.21:7946" # explicit peer sync addresses
export PULSED_DB="./data"                          # local state directory
export PULSED_WEB="true"                           # set false for sync-only nodes
export PULSED_NODE_NAME="rack-a-01"                # optional stable node identity override
export PULSED_ROLE="worker"                        # optional node role shown in Stasis
export PULSED_NODE_TTL="15s"                       # how long this node's heartbeat stays online
./pulsed
```

By default, Pulsed uses the OS hostname as the node identity. Set
`PULSED_NODE_NAME` for cloned hosts, containers, or multiple test instances that
would otherwise publish the same hostname. The override must be non-empty and
must not contain whitespace.

Each node publishes its own heartbeat TTL with `PULSED_NODE_TTL`. Shorter values
make stale/offline indication react faster; longer values are better for slow or
lossy networks. The default is `15s`, and values must be at least `2s`.

## Rolling Upgrades

Each heartbeat includes the binary version. During a rolling upgrade, live nodes
from another version can remain visible so operators can watch the cluster
converge. The dashboard and terminal view label those live mismatches as
`version <peer> (local <this-node>)` without treating them as failures.

Offline records from older versions are removed on startup or when a mismatched
peer leaves. This keeps stale data from previous releases from lingering after
the upgraded node can no longer confirm it.

## Discovery

| Environment | How nodes find each other |
|---|---|
| LAN / bare metal | mDNS service `_pulsed._tcp` |
| Static hosts | `PULSED_SEEDS` |
| Mixed setup | mDNS discoveries and explicit seeds are merged |
| Single node | Renders solo until peers appear |

## Service Templates

Templates live in `deploy/` for common ways to keep Pulsed running:

| Target | Template |
|---|---|
| Linux systemd | `deploy/systemd/pulsed.service` and `deploy/systemd/pulsed.env` |
| macOS launchd | `deploy/launchd/com.offpeakengineer.pulsed.plist` |
| Windows service | `deploy/windows/install-service.ps1` using NSSM |
| Kubernetes | `deploy/kubernetes/pulsed.yaml` |
| Helm | `helm/pulsed` |
| Ansible local binary | `deploy/ansible/install-pulsed.yml` |
| Ansible release binary | `deploy/ansible/install-release-pulsed.yml` |
| Traefik to bare metal | `deploy/traefik/bare-metal-node.yaml` |
| Traefik single hostname | `deploy/traefik/single-host-query.yaml` |

Linux systemd quick install from a built binary:

```bash
go build -o pulsed ./
sudo sh deploy/systemd/install.sh
sudoedit /etc/pulsed/pulsed.env
sudo systemctl restart pulsed
```

For clusters, build or download the binary once, then distribute that binary with systemd or Ansible. Avoid `go install` on every host unless you intentionally manage Go toolchains there.

macOS launchd:

```bash
sudo install -m 0755 pulsed /usr/local/bin/pulsed
sudo mkdir -p /usr/local/var/pulsed /usr/local/var/log
sudo cp deploy/launchd/com.offpeakengineer.pulsed.plist /Library/LaunchDaemons/
sudo launchctl bootstrap system /Library/LaunchDaemons/com.offpeakengineer.pulsed.plist
```

Windows service:

```powershell
.\deploy\windows\install-service.ps1 -BinaryPath "C:\Program Files\pulsed\pulsed.exe" -AdvertiseHttp "http://10.0.1.25:8080"
```

Kubernetes:

```bash
kubectl apply -f deploy/kubernetes/pulsed.yaml
```

### Reverse Proxies

Hot-potato refreshes and peer links require node identity to survive the browser round trip. If a single URL like `https://pulsed.example.com` is backed by a normal load balancer, the next request may land on any node, so the browser has not really rebased to the lower-load peer.

Use one browser-routable URL per node instead:

```text
https://pulsed-node-a.example.com -> 10.0.1.25:8080
https://pulsed-node-b.example.com -> 10.0.1.26:8080
https://pulsed-node-c.example.com -> 10.0.1.27:8080
```

Then set each node's advertised URL to its proxied hostname:

```bash
PULSED_HTTP=:8080
PULSED_ADVERTISE_HTTP=https://pulsed-node-a.example.com
PULSED_GOSSIP=:7946
PULSED_SEEDS=10.0.1.26:7946,10.0.1.27:7946
```

With Traefik in Kubernetes proxying bare-metal nodes, create one Service, Endpoints, and IngressRoute per node. Start from `deploy/traefik/bare-metal-node.yaml`.

If you prefer one hostname, route by query parameter instead:

```text
https://pulsed.example.com/?pulsed_node=node-a -> 10.0.1.25:8080
https://pulsed.example.com/?pulsed_node=node-b -> 10.0.1.26:8080
```

Then advertise the routed URL from each node:

```bash
PULSED_ADVERTISE_HTTP=https://pulsed.example.com/?pulsed_node=node-a
```

Traefik supports query-param matchers in router rules, so this keeps link clicks and hot-potato refreshes on a single DNS name while still selecting a specific backend. Start from `deploy/traefik/single-host-query.yaml`.

That example also includes a low-priority host-only fallback route. If Traefik sees no matching `pulsed_node` value, it sends the request to a shared `pulsed-any` service instead of pinning fallback traffic to one node. Keep the `pulsed-any` Endpoints list limited to nodes that should receive unrouted fallback traffic.

## Notes

**Open Stasis Pages** opens `/pages/`: a directory of selectable node cards with
roles and specs, plus a combined node page with CPU history above CPU/memory
gauges and core inspection. Both logical CPU traces and mean/peak trends are
available, with portable SVG export. Search, sorting, density,
theme, selected node, window, and pause state survive page changes and peer
rebasing. Failed refreshes retain the last snapshot and show a retry notice.
The classic dashboard remains at `/` and is available without JavaScript.

Both interfaces and their assets are embedded in the same executable. Vue and
Nuxt are used to build the Stasis pages; the running daemon needs no Node server
or external asset service.

The supplied Pulsed logo appears in both dashboard headers and browser icons.
Its original design, SVG, and PNG export are in `assets/`. The UI uses the PNG
export so the wordmark renders consistently without an installed design font.

pulsed uses peer-to-peer state sharing and a small local store internally, but those are implementation details for the dashboard. It is not intended to be a general-purpose distributed database or key-value API.

## Requirements

- Go 1.25+ if building from source with `go install` or `go build`.

For fleet installs, prefer release binaries or a binary built once in CI over compiling on every host. This avoids distro Go version drift and keeps bare-metal installs simple.

GitLab CI validates commits and npm tooling, checks formatting, runs Go vet and
race tests with coverage on Linux, then cross-compiles Linux, macOS, and Windows
binaries for amd64 and arm64. Releases publish those six binaries plus SHA-256
checksums using `deploy/release/build-all.sh`. See
[CI and release setup](docs/05_building/README.md#gitlab-ci-and-releases) for runner
and token requirements.

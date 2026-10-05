# Versytl source snapshot

These are unmodified source files from the user's Versytl checkout, captured on
2026-10-04. `manifest.json` records source repositories, commits, source paths,
and SHA-256 hashes. The snapshot includes dashboard/card/progress factories,
their Scene dependencies, headless Stasis, Bridge's trusted source registry,
and the Stasis Pages Nuxt layer. WASM adapters and unrelated modules are omitted.

Pulsed owns telemetry geometry in `frontend/charts.ts`, typed source adaptation
in `frontend/pulsed-source.ts`, page providers in `frontend/pages-scenes.ts`,
and the host extension in `frontend/pages`. Do not edit this snapshot to
customize Pulsed. The local `SvgDashboard.vue` replaces the pipeline-specific
upstream component while retaining the actual Stasis page host.

`npm run build:ui` verifies hashes and typechecks/compiles this source into
`templates/assets/ui`. The browser entry is bundled with esbuild into one module
so every asset request preserves the query-routed peer identity. Generated
modules and `npm run build:pages` output are committed and embedded by Go, so
normal Go builds do not follow the local `versytl` symlink or access registries.
Review manifest/source changes together when updating the snapshot. Upstream
package publication can replace this development snapshot in a later slice.

# Versytl source snapshot

These are unmodified source files from the user's Versytl checkout, captured on
2026-10-04. `manifest.json` records source repositories, commits, source paths,
and SHA-256 hashes. Only the renderer-neutral dashboard/card/progress factories,
their Scene dependencies, and the headless Stasis document package are included.
Vue components, Nuxt hosts, WASM adapters, and unrelated runtime dependencies are
not included.

Pulsed's adapters live in `frontend/charts.ts`; changes to telemetry geometry,
themes, and gaps belong there. Do not edit this snapshot to customize Pulsed.

`npm run build:ui` verifies hashes and typechecks/compiles this source into
`templates/assets/ui`. The browser entry is bundled with esbuild into one module
so every asset request preserves the query-routed peer identity. Generated
modules are committed and embedded by Go, so
normal Go builds do not follow the local `versytl` symlink or access registries.
Review manifest/source changes together when updating the snapshot. Upstream
package publication can replace this development snapshot in a later slice.

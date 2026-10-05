import { fileURLToPath } from 'node:url'
const styles = [
  fileURLToPath(new URL('../vendor/stasis-pages/app/assets/css/main.css', import.meta.url)),
  fileURLToPath(new URL('./app/assets/pulsed.css', import.meta.url)),
]

export default defineNuxtConfig({
  extends: ['../vendor/stasis-pages'],
  compatibilityDate: '2026-10-04',
  // Pulsed uses Nuxt's app/ directory layout, including on Nuxt 3.
  future: { compatibilityVersion: 4 },
  devtools: { enabled: false },
  app: { baseURL: '/pages/', head: { link: [{ rel: 'icon', type: 'image/png', href: '/pages/pulsed-logo.png' }] } },
  vite: { build: { assetsInlineLimit: 200000 } },
  runtimeConfig: { public: { pipelineApiBase: '' } },
  appConfig: { stasis: { directory: 'Cluster' } },
  buildId: 'pulsed-stasis-v1',
  css: styles,
  modules: [(_options, nuxt) => {
    // Layer CSS merging can append upstream defaults after Pulsed's theme.
    // Give this host one explicit, deduplicated base-then-theme stylesheet list.
    nuxt.options.css = [...styles]
  }],
  alias: { '@versytl/scene': fileURLToPath(new URL('../vendor/scene/types.ts', import.meta.url)) },
  typescript: { tsConfig: { compilerOptions: { allowImportingTsExtensions: true } } },
  experimental: { payloadExtraction: false, appManifest: false },
  sourcemap: { server: false, client: false },
})

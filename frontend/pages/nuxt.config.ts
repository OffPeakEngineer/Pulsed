export default defineNuxtConfig({
  extends: ['../vendor/stasis-pages'],
  compatibilityDate: '2026-10-04',
  devtools: { enabled: false },
  app: { baseURL: '/pages/', head: { link: [{ rel: 'icon', type: 'image/png', href: '/pages/pulsed-logo.png' }] } },
  vite: { build: { assetsInlineLimit: 200000 } },
  runtimeConfig: { public: { pipelineApiBase: '' } },
  appConfig: { stasis: { directory: 'Cluster' } },
  buildId: 'pulsed-stasis-v1',
  css: ['~/assets/pulsed.css'],
  experimental: { payloadExtraction: false, appManifest: false },
  sourcemap: { server: false, client: false },
})

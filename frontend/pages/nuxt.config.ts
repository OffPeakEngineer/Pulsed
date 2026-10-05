export default defineNuxtConfig({
  extends: ['../vendor/stasis-pages'],
  compatibilityDate: '2026-10-04',
  devtools: { enabled: false },
  app: { baseURL: '/pages/' },
  runtimeConfig: { public: { pipelineApiBase: '' } },
  appConfig: { stasis: { directory: 'Cluster' } },
  buildId: 'pulsed-stasis-v1',
  css: ['~/assets/pulsed.css'],
  experimental: { payloadExtraction: false, appManifest: false },
  sourcemap: { server: false, client: false },
})

import { loadDashboardDirectory } from './build/dashboard-loader'

const dashboardDirectory = process.env.STASIS_PAGES_DIR || './dashboards/osmos'
const stasis = loadDashboardDirectory(process.cwd(), dashboardDirectory)

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  appConfig: { stasis },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      pipelineApiBase: process.env.NUXT_PUBLIC_PIPELINE_API_BASE || '/api/v1',
    },
  },
})

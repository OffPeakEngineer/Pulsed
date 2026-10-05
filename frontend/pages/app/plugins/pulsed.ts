import { createPulsedStore } from '../utils/store'

export default defineNuxtPlugin(nuxtApp => {
  const pulsed = createPulsedStore()
  if (import.meta.client) {
    // The page-only Nuxt router receives absolute paths on popstate. Normalize
    // them before it prepends baseURL, including hash navigation behind proxies.
    const base = useRuntimeConfig().app.baseURL.replace(/\/$/, '')
    useRouter().beforeEach(to => {
      if (base && (to.path === base || to.path.startsWith(base + '/'))) return to.fullPath.slice(base.length) || '/'
    })
    nuxtApp.hook('app:mounted', pulsed.start)
    nuxtApp.vueApp.onUnmount(pulsed.stop)
  }
  return { provide: { pulsed } }
})

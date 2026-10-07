import { createPulsedStore } from '../utils/store'

export default defineNuxtPlugin(nuxtApp => {
  const pulsed = createPulsedStore()
  if (import.meta.client) {
    const legacyHistory = location.hash === '#history'
    // The page-only Nuxt router receives absolute paths on popstate. Normalize
    // them before it prepends baseURL, including hash navigation behind proxies.
    const base = useRuntimeConfig().app.baseURL.replace(/\/$/, '')
    useRouter().beforeEach(to => {
      if (base && (to.path === base || to.path.startsWith(base + '/'))) return to.fullPath.slice(base.length) || '/'
    })
    nuxtApp.hook('app:mounted', () => {
      if (legacyHistory) {
        const url = new URL(location.href)
        url.hash = 'node'
        history.replaceState(history.state, '', url.href)
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      }
      pulsed.start()
    })
    nuxtApp.vueApp.onUnmount(pulsed.stop)
  }
  return { provide: { pulsed } }
})

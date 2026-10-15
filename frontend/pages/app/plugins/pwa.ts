export default defineNuxtPlugin(() => {
  // Go rewrites the prerendered base and links for the incoming proxy route.
  // Hydration must use those same URLs instead of restoring build-time paths.
  const base = useRuntimeConfig().app.baseURL
  const parameters = new URLSearchParams(import.meta.client ? location.search : '')
  parameters.sort()
  const query = parameters.size ? '?' + parameters.toString() : ''
  useHead({
    meta: [
      { name: 'theme-color', content: '#071019' },
      { name: 'apple-mobile-web-app-title', content: 'Pulsed' },
    ],
    link: [
      { key: 'pulsed-manifest', rel: 'manifest', href: base + 'manifest.webmanifest' + query, crossorigin: 'use-credentials' },
      { key: 'pulsed-touch-icon', rel: 'apple-touch-icon', href: base + 'app-icon-180.png' + query },
    ],
    script: [{ key: 'pulsed-pwa', src: base + 'pwa.js' + query, defer: true }],
  })
})

<script setup lang="ts">
import type { StasisManifest, StasisPage } from './types/stasis'

const appConfig = useAppConfig()
const manifest = appConfig.stasis as StasisManifest
const activeId = ref(manifest.pages[0]?.id ?? '')
const activePage = computed<StasisPage | undefined>(() =>
  manifest.pages.find(page => page.id === activeId.value) ?? manifest.pages[0],
)

useHead({
  title: `${manifest.site.name} · ${manifest.site.product}`,
  meta: [
    { name: 'description', content: manifest.site.description },
    { name: 'theme-color', content: manifest.site.background },
  ],
  htmlAttrs: { lang: 'en' },
})

onMounted(() => {
  selectFromHash()
  window.addEventListener('hashchange', selectFromHash)
})

onBeforeUnmount(() => window.removeEventListener('hashchange', selectFromHash))

function selectPage(id: string, writeHash = true) {
  if (!manifest.pages.some(page => page.id === id)) return
  activeId.value = id
  if (!writeHash) return
  const url = new URL(window.location.href)
  url.hash = id
  window.history.replaceState(window.history.state, '', url)
}

function selectFromHash() {
  const id = window.location.hash.replace(/^#/, '')
  if (manifest.pages.some(page => page.id === id)) selectPage(id, false)
  else if (activeId.value) selectPage(activeId.value)
}

function selectAdjacent(event: KeyboardEvent, index: number) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const next = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? manifest.pages.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + manifest.pages.length) % manifest.pages.length
  const page = manifest.pages[next]
  if (!page) return
  selectPage(page.id)
  nextTick(() => document.getElementById(`tab-${page.id}`)?.focus())
}
</script>

<template>
  <div
    class="stasis-shell"
    :style="{
      '--stasis-accent': manifest.site.accent,
      '--stasis-background': manifest.site.background,
    }"
  >
    <NuxtRouteAnnouncer />

    <header class="site-header">
      <a class="brand" :href="manifest.site.homeUrl || '/'">
        <span class="brand-orbit" aria-hidden="true"><i /></span>
        <span>
          <strong>{{ manifest.site.name }}</strong>
          <small>{{ manifest.site.product }}</small>
        </span>
      </a>

      <nav class="tabs" role="tablist" :aria-label="`${manifest.site.name} dashboards`">
        <button
          v-for="(page, index) in manifest.pages"
          :id="`tab-${page.id}`"
          :key="page.id"
          class="tab"
          :class="{ active: activePage?.id === page.id }"
          type="button"
          role="tab"
          :aria-selected="activePage?.id === page.id"
          :aria-controls="`panel-${page.id}`"
          :tabindex="activePage?.id === page.id ? 0 : -1"
          @click="selectPage(page.id)"
          @keydown="selectAdjacent($event, index)"
        >
          <span>{{ page.eyebrow }}</span>
          {{ page.label }}
        </button>
      </nav>
    </header>

    <main v-if="activePage" :id="`panel-${activePage.id}`" role="tabpanel" :aria-labelledby="`tab-${activePage.id}`">
      <SvgDashboard :key="activePage.id" :page="activePage" />
    </main>

    <footer class="site-footer">
      <span>{{ manifest.site.footer }}</span>
      <span>{{ manifest.directory }} · {{ manifest.pages.length }} SVG {{ manifest.pages.length === 1 ? 'page' : 'pages' }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import type { StasisPage } from '../../../vendor/stasis/index'
import { hydratePage, nodePageWithCoreBars } from '../../../pages-scenes'
import type { PageColors } from '../../../pages-scenes'
import { coreBarsDocument, coreColor, latestCoreUsage } from '../../../core-charts'

const props = defineProps<{ page: StasisPage }>()
const store = useNuxtApp().$pulsed
const { snapshot, status, fetching, paused, selected, search, sort, density, theme, hideStale, hideOffline,
  windowMs, pageNumber, activePage, coresOpen, historyMode, coreGroup, selectedNode, filtered, displayed, currentPage, maxPage, fallback, peer } = store
activePage.value = props.page.id
const host = ref<HTMLElement | null>(null), width = ref(960)
const palette = ref<PageColors>({ accent: '#65d5ef', peak: '#facc15', surface: '#0d1d27', border: '#29414f', text: '#f1f6f7', muted: '#9bb0bc' })
let resize: ResizeObserver | undefined
function readPalette() {
  const style = getComputedStyle(document.documentElement)
  const token = (key: string) => style.getPropertyValue('--' + key).trim()
  palette.value = { accent: token('accent'), peak: token('stale'), surface: token('surface'), border: token('border'), text: token('text'), muted: token('muted') }
}
onMounted(() => {
  readPalette()
})
watch(host, element => {
  resize?.disconnect()
  if (element) {
    resize = new ResizeObserver(entries => { width.value = Math.max(300, entries[0]!.contentRect.width) })
    resize.observe(element)
  }
}, { flush: 'post' })
onBeforeUnmount(() => resize?.disconnect())
watch(theme, () => nextTick(readPalette))
const rendered = computed(() => {
  if (!snapshot.value) return { svg: props.page.svg, supported: true }
  return hydratePage(props.page, { snapshot: snapshot.value, selected: selected.value, nodes: displayed.value,
    windowMs: windowMs.value, width: width.value, colors: palette.value, density: density.value, theme: theme.value as 'dark' | 'light',
    historyMode: historyMode.value, coreStart: coreGroup.value < 0 ? 0 : coreGroup.value * 32, coreLimit: coreGroup.value < 0 ? 0 : 32 })
})
const samples = computed(() => (snapshot.value?.history[selected.value] || []).filter(point => point.at >= (snapshot.value?.generatedAt || 0) - windowMs.value))
const historyCoreCount = computed(() => Math.max(selectedNode.value?.cpu.count || 0, ...samples.value.map(point => point.cores?.length || 0)))
const coreGroups = computed(() => Array.from({ length: Math.ceil(historyCoreCount.value / 32) }, (_, index) => ({ index, label: `CPU ${index * 32}–${Math.min(historyCoreCount.value - 1, index * 32 + 31)}` })))
watch(coreGroups, groups => { if (snapshot.value && selectedNode.value && coreGroup.value >= groups.length) coreGroup.value = -1 })
const coreHistorySamples = computed(() => samples.value.filter(point => point.cores?.length).length)
const legendCores = computed(() => coreGroup.value < 0 ? [] : Array.from({ length: Math.max(0, Math.min(32, historyCoreCount.value - coreGroup.value * 32)) }, (_, i) => coreGroup.value * 32 + i))
const barsSvg = computed(() => coreBarsDocument(selected.value, selectedNode.value?.cpu.cores || [], width.value, palette.value, theme.value as 'dark' | 'light'))
const nodeOptions = computed(() => {
  const names = (snapshot.value?.nodes || []).map(node => node.name)
  return selected.value && !names.includes(selected.value) ? [selected.value, ...names] : names
})
const clock = computed(() => snapshot.value ? new Date(snapshot.value.generatedAt).toLocaleTimeString() : '')
function interact(event: MouseEvent | KeyboardEvent) {
  if (event instanceof KeyboardEvent && !['Enter',' '].includes(event.key)) return
  const button = (event.target as Element).closest<SVGElement>('[data-pulsed-node]')
  if (!button) return
  event.preventDefault()
  store.selectNode(button.dataset.pulsedNode!)
  nextTick(() => document.getElementById('tab-node')?.focus())
}
function exportPage() {
  const svg = props.page.id === 'node' && selectedNode.value ? nodePageWithCoreBars(rendered.value.svg, selectedNode.value, palette.value, theme.value as 'dark' | 'light') : rendered.value.svg
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  const link = document.createElement('a')
  link.href = url; link.download = `pulsed-${props.page.id}.svg`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <section class="pulsed-page" :aria-label="page.title">
    <div class="page-actions">
      <p class="source-state" role="status">
        <template v-if="!snapshot">{{ status === 'stale' ? 'Peer unavailable. Use Refresh now to retry.' : 'Connecting to this peer…' }}</template>
        <template v-else-if="status === 'stale'">Refresh unavailable · showing the last snapshot at {{ clock }}</template>
        <template v-else>{{ paused ? 'Refresh paused' : 'Live snapshot' }} · {{ snapshot.servingNode }} · {{ clock }}</template>
      </p>
      <div class="action-buttons">
        <button type="button" :aria-pressed="paused" @click="paused = !paused">{{ paused ? 'Resume refresh' : 'Pause refresh' }}</button>
        <button type="button" :disabled="fetching" @click="store.refresh(true)">Refresh now</button>
        <a :href="fallback" id="classic-dashboard">Classic dashboard</a>
      </div>
    </div>
    <noscript><p>Interactive pages require JavaScript. Open the <a href="../">classic dashboard</a> for current readings.</p></noscript>
    <div v-if="snapshot" class="cluster-health" aria-label="Cluster health">
      <span class="fresh">{{ snapshot.summary.fresh }} online</span><span class="stale">{{ snapshot.summary.stale }} stale</span><span class="offline">{{ snapshot.summary.offline }} offline</span>
      <span v-if="snapshot.summary.hottest">Hottest: {{ snapshot.summary.hottest }}</span>
    </div>
    <div v-if="page.id === 'overview'" class="page-controls">
      <label>Find a node<input v-model="search" type="search" id="pages-search" placeholder="Filter by name" autocomplete="off"></label>
      <label>Sort<select v-model="sort" id="pages-sort"><option value="name">Name</option><option value="cpu">CPU</option><option value="memory">Memory</option><option value="load">Load 1m</option><option value="state">Needs attention</option></select></label>
      <label>Density<select v-model="density" id="pages-density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
      <label class="check"><input type="checkbox" v-model="hideStale">Hide stale</label><label class="check"><input type="checkbox" v-model="hideOffline">Hide offline</label>
    </div>
    <div v-else class="page-controls">
      <label>Node<select v-model="selected" id="pages-node" :disabled="!nodeOptions.length"><option v-for="name in nodeOptions" :key="name" :value="name">{{ name }}</option></select></label>
      <label v-if="page.id === 'node'">Window<select v-model.number="windowMs" id="pages-window"><option :value="60000">Last minute</option><option :value="300000">Last 5 minutes</option></select></label>
      <label v-if="page.id === 'node'">Traces<select v-model="historyMode" id="pages-traces"><option value="cores">Logical CPUs</option><option value="summary">Mean / peak</option></select></label>
      <label v-if="page.id === 'node' && historyMode === 'cores'">Core group<select v-model.number="coreGroup" id="pages-core-group"><option :value="-1">All {{ historyCoreCount }} logical CPUs</option><option v-for="group in coreGroups" :key="group.index" :value="group.index">{{ group.label }}</option></select></label>
      <a v-if="peer" :href="peer" id="rebase-peer">View from this peer</a>
    </div>
    <div class="page-heading">
      <h1>{{ page.id === 'overview' ? 'Cluster nodes' : selected || page.label }}</h1>
      <div class="action-buttons"><label class="theme-label">Theme<select v-model="theme" id="pages-theme"><option value="dark">Dark</option><option value="light">Light</option></select></label><button @click="exportPage" :disabled="!snapshot">Export SVG</button></div>
    </div>
    <p v-if="page.id !== 'overview' && snapshot" class="node-current">
      <template v-if="selectedNode">{{ selectedNode.state === 'fresh' ? 'online' : selectedNode.state }} · {{ selectedNode.updatedAt ? 'updated ' + Math.round(selectedNode.ageSeconds) + 's ago' : 'no heartbeat available' }} · {{ selectedNode.role || 'Role not set' }} · {{ selectedNode.cpu.count }} logical CPUs · {{ selectedNode.memory.total ? (selectedNode.memory.total / 2 ** 30).toFixed(1) + ' GiB RAM' : 'Memory capacity unavailable' }} · {{ selectedNode.version }}</template>
      <template v-else>This node is no longer visible to this peer. Select another node.</template>
    </p>
    <div v-if="page.id === 'node'" class="history-description">
      <div v-if="historyMode === 'summary'" class="history-legend"><span>Mean CPU</span><span>Peak logical CPU</span></div>
      <template v-else>
        <p>{{ historyCoreCount }} logical CPUs · {{ coreGroup < 0 ? 'all cores' : coreGroups[coreGroup]?.label }}. Idle traces settle to grey; saturation increases with the latest observed usage. Active traces draw above idle ones. Select a group to identify individual CPUs.</p>
        <div v-if="legendCores.length" class="core-legend"><span v-for="core in legendCores" :key="core" :style="{ '--core-color': coreColor(core, latestCoreUsage(samples, core), theme as 'dark' | 'light') }">CPU {{ core }}</span></div>
        <p v-if="!coreHistorySamples">Per-core history is collecting. Older mean / peak observations remain available in the Mean / peak view.</p>
      </template>
      <p>{{ samples.length ? samples.length + ' observed readings · ' + (historyMode === 'cores' ? coreHistorySamples + ' with per-core data · ' : '') + 'gaps indicate missing readings.' : 'No CPU history available yet. Readings appear as this peer observes heartbeats.' }}</p>
      <p>Observed by {{ snapshot?.servingNode || 'this peer' }} · up to five minutes · resets on restart and changes with the serving peer.</p>
    </div>
    <div v-if="page.id === 'overview' && snapshot && !filtered.length" class="empty-state">
      <p>{{ snapshot.nodes.length ? 'No nodes match these filters.' : 'Waiting for a node heartbeat.' }}</p>
      <button v-if="snapshot.nodes.length" @click="search = ''; hideStale = false; hideOffline = false">Clear filters</button>
    </div>
    <div v-else ref="host" class="svg-dashboard pages-scene" :data-density="density" @click="interact" @keydown="interact" v-html="rendered.svg.replace(/^\s*<\?xml[^>]*>\s*/, '')" />
    <p v-if="!rendered.supported" class="notice">This page uses an unavailable component. Showing its saved view.</p>
    <div v-if="page.id === 'overview' && filtered.length" class="pagination">
      <span role="status">{{ currentPage * 24 + 1 }}–{{ Math.min(filtered.length, (currentPage + 1) * 24) }} of {{ filtered.length }} nodes</span>
      <div><button :disabled="currentPage === 0" @click="pageNumber = currentPage - 1">Previous nodes</button><button :disabled="currentPage >= maxPage" @click="pageNumber = currentPage + 1">Next nodes</button></div>
    </div>
    <template v-if="page.id === 'node' && selectedNode">
      <h2 class="logical-cpu-heading">{{ selectedNode.cpu.count }} logical CPUs <small>One bar per CPU · 0–100%</small></h2>
      <div v-if="selectedNode.cpu.cores" class="pages-bar-scroll" role="region" :aria-label="'Core bar chart for ' + selected" tabindex="0" v-html="barsSvg" />
      <p v-else class="notice">{{ selectedNode.cpu.average === null ? 'Core readings unavailable.' : 'Loading core bars…' }}</p>
      <dl class="node-facts"><div><dt>Peak logical CPU</dt><dd>{{ selectedNode.cpu.peak === null ? 'Unavailable' : selectedNode.cpu.peak.toFixed(1) + '%' }}</dd></div><div><dt>Load 1m / 5m / 15m</dt><dd>{{ selectedNode.load ? selectedNode.load.map(value => value.toFixed(2)).join(' / ') : 'Unavailable' }}</dd></div><div><dt>Memory</dt><dd>{{ selectedNode.memory.label }}</dd></div></dl>
      <details v-if="selectedNode.cpu.average !== null" :open="coresOpen" class="pages-cores" @toggle="coresOpen = ($event.target as HTMLDetailsElement).open">
        <summary>Inspect {{ selectedNode.cpu.count }} logical CPUs</summary>
        <div class="pages-core-scroll" role="region" :aria-label="'Logical CPU usage for ' + selected" tabindex="0">
          <p v-if="!selectedNode.cpu.cores">Loading core readings…</p>
          <div v-else class="pages-core-grid"><div v-for="core in selectedNode.cpu.cores" :key="core.index"><span>CPU {{ core.index }} · {{ core.percent.toFixed(1) }}%</span><meter min="0" max="100" :value="core.percent" :aria-label="'CPU ' + core.index + ' usage'"></meter></div></div>
        </div>
      </details>
    </template>
  </section>
</template>

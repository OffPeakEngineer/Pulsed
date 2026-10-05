import { ref, shallowRef, computed, watch } from 'vue'
import { pulsedBridge, snapshotURL, pagesURL, classicURL } from '../../../pulsed-source'
import type { PulsedSnapshot } from '../../../pulsed-source'
import type { BridgeSourceAdapter } from '../../../vendor/bridge/types'

export function createPulsedStore() {
  const snapshot = shallowRef<PulsedSnapshot | null>(null)
  const status = ref<'connecting' | 'fresh' | 'stale'>('connecting')
  const fetching = ref(false), paused = ref(false), selected = ref(''), search = ref('')
  const sort = ref('name'), density = ref('comfortable'), theme = ref('dark')
  const hideStale = ref(false), hideOffline = ref(false), windowMs = ref(300000), pageNumber = ref(0)
  const activePage = ref('overview'), coresOpen = ref(false)
  const historyMode = ref<'cores' | 'summary'>('cores'), coreGroup = ref(-1)
  const ready = ref(false)
  const initialClassic = import.meta.client ? document.getElementById('classic-dashboard')?.getAttribute('href') || '../' : '../'
  let timer: ReturnType<typeof setTimeout> | undefined, controller: AbortController | undefined, started = false, generation = 0

  const selectedNode = computed(() => snapshot.value?.nodes.find(node => node.name === selected.value))
  const filtered = computed(() => {
    const needle = search.value.trim().toLocaleLowerCase()
    return (snapshot.value?.nodes || []).filter(node => node.name.toLocaleLowerCase().includes(needle)
      && !(hideStale.value && node.state === 'stale') && !(hideOffline.value && node.state === 'offline'))
      .sort((a, b) => {
        if (sort.value === 'name') return a.name.localeCompare(b.name)
        if (sort.value === 'state') return ['offline','stale','fresh'].indexOf(a.state) - ['offline','stale','fresh'].indexOf(b.state) || a.name.localeCompare(b.name)
        const metric = (node: typeof a) => sort.value === 'cpu' ? node.cpu.average : sort.value === 'memory' ? node.memory.percent : node.load?.[0]
        return (metric(b) ?? -1) - (metric(a) ?? -1) || a.name.localeCompare(b.name)
      })
  })
  const maxPage = computed(() => Math.max(0, Math.ceil(filtered.value.length / 24) - 1))
  const currentPage = computed(() => Math.min(pageNumber.value, maxPage.value))
  const displayed = computed(() => filtered.value.slice(currentPage.value * 24, (currentPage.value + 1) * 24))
  const coreRequest = computed(() => JSON.stringify(activePage.value === 'overview' ? displayed.value.map(node => node.name).sort() : [selected.value]))
  const fallback = computed(() => {
    if (!ready.value || !import.meta.client) return initialClassic
    const url = new URL(classicURL(location.href), location.href)
    url.hash = 'view=' + encodeURIComponent(JSON.stringify({
      selected: selected.value, historyWindow: String(windowMs.value), paused: paused.value,
      search: search.value, density: density.value, stale: hideStale.value, offline: hideOffline.value,
      sort: ({ cpu: 'cpuAvg', memory: 'memPct', load: 'load1' } as Record<string, string>)[sort.value] || 'name',
    }))
    return url.href
  })
  const peer = computed(() => selectedNode.value?.webURL && import.meta.client ? pagesURL(selectedNode.value.webURL, location.href) : '')

  function writePreferences() {
    if (!started) return
    const url = new URL(location.href)
    for (const [key, value] of Object.entries({ focus: selected.value, window: String(windowMs.value), q: search.value,
      sort: sort.value, density: density.value, theme: theme.value, paused: paused.value ? '1' : '', traces: historyMode.value, coregroup: String(coreGroup.value),
      hide: [hideStale.value ? 'stale' : '', hideOffline.value ? 'offline' : ''].filter(Boolean).join(',') })) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key)
    }
    history.replaceState(history.state, '', url.href)
    document.documentElement.dataset.theme = theme.value
  }
  function schedule() {
    clearTimeout(timer)
    if (!started || paused.value) return
    timer = setTimeout(() => {
      if (document.hidden || document.activeElement?.matches('input, select, button:focus-visible, summary:focus-visible, [data-pulsed-node]:focus-visible')) { schedule(); return }
      if (snapshot.value?.refreshURL) {
        const target = pagesURL(snapshot.value.refreshURL, location.href)
        if (target !== location.href) { location.replace(target); return }
      }
      void refresh()
    }, snapshot.value?.refreshMs || 3000)
  }
  async function refresh(force = false) {
    if (!started || (fetching.value && !force)) return
    controller?.abort()
    const current = ++generation
    controller = new AbortController()
    const requestController = controller
    const timeout = setTimeout(() => requestController.abort(), 10000)
    fetching.value = true
    try {
      // This explicit registry entry validates and returns PulsedSnapshot.
      const source = pulsedBridge.source('pulsed/snapshot', 1) as BridgeSourceAdapter<PulsedSnapshot>
      const result = await source.read({ url: snapshotURL(location.href, JSON.parse(coreRequest.value), activePage.value === 'history' ? selected.value : '') }, { fetch, now: () => new Date(), signal: controller.signal })
      if (current !== generation) return
      if (!force && document.activeElement?.matches('input, select, summary:focus-visible, [data-pulsed-node]:focus-visible')) return
      snapshot.value = result.data
      if (!selected.value) selected.value = snapshot.value.nodes[0]?.name || ''
      status.value = 'fresh'
    } catch {
      if (current === generation) status.value = 'stale'
    } finally {
      clearTimeout(timeout)
      if (current === generation) { fetching.value = false; schedule() }
    }
  }
  function selectNode(name: string) {
    selected.value = name
    activePage.value = 'node'
    location.hash = 'node'
  }
  function start() {
    if (started) return
    const params = new URLSearchParams(location.search)
    selected.value = params.get('focus') || ''
    search.value = params.get('q') || ''
    sort.value = ['name','cpu','memory','load','state'].includes(params.get('sort') || '') ? params.get('sort')! : 'name'
    density.value = params.get('density') === 'compact' ? 'compact' : 'comfortable'
    theme.value = params.get('theme') === 'light' ? 'light' : 'dark'
    windowMs.value = params.get('window') === '60000' ? 60000 : 300000
    historyMode.value = params.get('traces') === 'summary' ? 'summary' : 'cores'
    const group = Number(params.get('coregroup') ?? -1)
    coreGroup.value = Number.isInteger(group) && group >= -1 && group <= 32768 ? group : -1
    hideStale.value = (params.get('hide') || '').includes('stale')
    hideOffline.value = (params.get('hide') || '').includes('offline')
    paused.value = params.get('paused') === '1'
    started = true
    ready.value = true
    writePreferences()
    void refresh(true)
  }
  function stop() { started = false; ++generation; clearTimeout(timer); controller?.abort() }
  watch([search, hideStale, hideOffline], () => { pageNumber.value = 0 })
  watch([selected, windowMs, search, sort, density, theme, hideStale, hideOffline, paused, historyMode, coreGroup], writePreferences)
  watch(paused, schedule)
  watch(selected, (_, previous) => { if (previous) coreGroup.value = -1 })
  watch([coreRequest, activePage], () => { if (started) void refresh(true) })
  return { snapshot, status, fetching, paused, selected, search, sort, density, theme, hideStale, hideOffline, windowMs, pageNumber,
    activePage, coresOpen, historyMode, coreGroup, selectedNode, filtered, displayed, maxPage, currentPage, fallback, peer, refresh, selectNode, start, stop }
}

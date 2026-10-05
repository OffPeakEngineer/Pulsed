import { cpuHistoryDocument, memoryMeter } from './charts.js'
import type { Snapshot } from './types.js'

const panel = document.querySelector<HTMLElement>('#node-inspector')!
const select = document.querySelector<HTMLSelectElement>('#inspect-node')!
const windowSelect = document.querySelector<HTMLSelectElement>('#history-window')!
const chart = document.querySelector<HTMLElement>('#cpu-history')!
const download = document.querySelector<HTMLButtonElement>('#export-history')!
const text = (id: string, value: string) => { document.getElementById(id)!.textContent = value }
let snapshot: Snapshot = JSON.parse(document.querySelector<HTMLElement>('#snapshot-data')!.dataset.snapshot!)
let exportedSvg = ''
let restored: Record<string, unknown> = {}
try { if (location.hash.startsWith('#view=')) restored = JSON.parse(decodeURIComponent(location.hash.slice(6))) } catch {}
let selectedName = typeof restored.selected === 'string' ? restored.selected : ''
windowSelect.value = ['60000', '300000'].includes(String(restored.historyWindow)) ? String(restored.historyWindow) : '300000'

function colors() {
  const style = getComputedStyle(document.documentElement)
  const token = (name: string) => style.getPropertyValue('--' + name).trim()
  return { accent: token('accent'), peak: token('stale'), surface: token('surface'), border: token('border'), text: token('text'), muted: token('muted') }
}

function render() {
  const nodes = snapshot.nodes || []
  const node = nodes.find(item => item.Name === selectedName)
  if (!node) {
    exportedSvg = ''
    download.disabled = true
    chart.replaceChildren()
    text('inspect-title', selectedName || 'Choose a node')
    text('history-note', selectedName ? 'This node is no longer in this peer’s snapshot. Select another node.' : 'Waiting for a node heartbeat.')
    text('inspect-state', 'Unavailable')
    text('inspect-cpu', 'Unavailable'); text('inspect-memory', 'Unavailable'); text('inspect-load', 'Unavailable')
    document.getElementById('inspect-memory-meter')!.replaceChildren()
    return
  }
  text('inspect-title', node.Name)
  text('inspect-state', node.StatusLabel + ' · ' + node.AgeLabel)
  const offline = node.State === 'offline'
  text('inspect-cpu', offline || !node.CoreCount ? 'Unavailable' : `${node.CPUAvg.toFixed(1)}% mean · ${node.CPUMax.toFixed(1)}% peak`)
  text('inspect-memory', offline || !node.MemTotal ? 'Unavailable' : `${node.MemPct.toFixed(1)}% · ${node.MemLabel}`)
  text('inspect-load', offline ? 'Unavailable' : [node.Load1, node.Load5, node.Load15].map(value => value.toFixed(2)).join(' / '))
  const palette = colors()
  const meter = document.getElementById('inspect-memory-meter')!
  meter.innerHTML = offline || !node.MemTotal ? '' : memoryMeter(node.MemPct, palette)
  meter.querySelector('svg')?.setAttribute('aria-hidden', 'true')
  const windowMs = Number(windowSelect.value)
  const points = (Object.hasOwn(snapshot.history, node.Name) ? snapshot.history[node.Name]! : []).filter(point => point.at >= snapshot.generatedAt - windowMs)
  text('history-note', points.length === 0 ? 'No CPU history available yet. Readings appear as this peer observes heartbeats.'
    : `${points.length} observed reading${points.length === 1 ? ' · collecting a trend' : 's'} · ${offline ? 'last known history · ' : ''}gaps indicate missing heartbeats.`)
  text('history-source', `Observed by ${snapshot.servingNode || 'this peer'} · up to 5 minutes · resets on restart or changes with peer.`)
  exportedSvg = cpuHistoryDocument({
    name: node.Name, servingNode: snapshot.servingNode, points, end: snapshot.generatedAt,
    windowMs, width: chart.clientWidth || 640,
    theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark', colors: palette,
  })
  // Only locally generated, XML-escaped, Stasis-validated SVG reaches this host.
  chart.innerHTML = exportedSvg.replace(/^<\?xml[^>]*>\s*/, '')
  chart.querySelector('svg')!.setAttribute('role', 'img')
  chart.querySelector('svg')!.setAttribute('aria-label', `${node.Name} CPU history, ${points.length} observed readings`)
  download.disabled = points.length === 0
  document.querySelectorAll<HTMLElement>('.cell').forEach(card => {
    card.dataset.selected = String(card.dataset.name === selectedName)
    card.querySelector('button.inspect-history')?.setAttribute('aria-pressed', String(card.dataset.name === selectedName))
  })
}

function updateOptions() {
  const names = (snapshot.nodes || []).map(node => node.Name)
  const options = selectedName && !names.includes(selectedName) ? [selectedName, ...names] : names
  select.replaceChildren(...options.map(name => new Option(name, name)))
  if (!selectedName) selectedName = names[0] || ''
  select.value = selectedName
  select.disabled = names.length === 0
  render()
}

// Accessible HTML controls stay outside the SVG; history selection does not
// rebase the browser to the selected node's HTTP server.
select.addEventListener('change', () => { selectedName = select.value; render() })
windowSelect.addEventListener('change', render)
document.getElementById('nodes')!.addEventListener('click', event => {
  const button = (event.target as Element).closest('button.inspect-history')
  if (!button) return
  selectedName = button.closest<HTMLElement>('.cell')!.dataset.name!
  select.value = selectedName
  render()
  panel.scrollIntoView({ behavior: 'instant', block: 'start' })
  select.focus({ preventScroll: true })
})
download.addEventListener('click', () => {
  if (!exportedSvg || download.disabled) return
  const url = URL.createObjectURL(new Blob([exportedSvg], { type: 'image/svg+xml' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'pulsed-cpu-history.svg'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
})
document.addEventListener('pulsed:snapshot', event => {
  snapshot = (event as CustomEvent<Snapshot>).detail
  updateOptions()
})
new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette'] })
new ResizeObserver(render).observe(chart)
document.documentElement.classList.add('versytl-ready')
updateOptions()

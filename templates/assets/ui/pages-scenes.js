import { createCardNode } from './vendor/shipkit/cardScene.js';
import { createProgressBarNode } from './vendor/shipkit/progressScene.js';
import { createRadialGaugeNode, createLevelIndicatorNode } from './vendor/shipkit/dashboardScene.js';
import { createScene } from './vendor/scene/scene.js';
import { sceneFromSvg, sceneToSvg, escapeXml } from './vendor/scene/svg.js';
import { stringifyScene } from './vendor/scene/serialization.js';
import { parseStasisSvg, serializeStasisDocument, updateStasisDocument } from './vendor/stasis/index.js';
import { cpuHistoryDocument } from './charts.js';
const ids = ['overview', 'node', 'history'];
function text(id, value, x, y, colors, size = 13) {
    return { id, kind: 'text', text: value, fontSize: size, fill: { color: colors.text }, transform: { x, y, rotation: 0 }, fontFamily: 'ui-sans-serif, system-ui, sans-serif' };
}
function compactName(name) { return name.length > 28 ? name.slice(0, 26) + '…' : name; }
function frame(id, title, width, height, colors, children = []) {
    return createCardNode({ id, title, bounds: { x: 0, y: 0, width, height }, children, shadow: false,
        theme: { surface: colors.surface, border: colors.border, title: colors.text, eyebrow: colors.muted, menu: colors.muted } });
}
function document(root, width, height, metadata, title, description, names = {}) {
    let svg = sceneToSvg(createScene(width, height, root), { nodeAttributes: node => names[node.id] ? {
            role: 'button', tabindex: 0, 'aria-label': `Inspect ${names[node.id]}`, 'data-pulsed-node': names[node.id],
        } : undefined });
    svg = svg.replace(/<svg\b[^>]*>/, opening => `${opening}\n<title>${escapeXml(title)}</title>\n<desc>${escapeXml(description)}</desc>`);
    return serializeStasisDocument(updateStasisDocument(parseStasisSvg(svg), { metadata }));
}
export function authoredPage(id) {
    const colors = { accent: '#65d5ef', peak: '#facc15', surface: '#0d1d27', border: '#29414f', text: '#f1f6f7', muted: '#9bb0bc' };
    const label = { overview: 'Overview', node: 'Node detail', history: 'CPU history' }[id];
    const provider = `@pulsed/dashboard/${id}`;
    return document({ id: `pulsed-${id}`, kind: 'group', children: [frame('fallback', 'Waiting for a peer snapshot', 960, 160, colors, [
                text('fallback-note', 'Readings appear when this peer is reachable. The classic dashboard remains available.', 18, 88, colors),
            ])], components: { [provider]: { version: 1, data: {} } } }, 960, 160, {
        schemaVersion: 1, id, label, order: ids.indexOf(id), eyebrow: 'Cluster',
        site: { name: 'Pulsed', product: 'The pulse of your cluster', homeUrl: '#overview', description: 'Peer-local cluster monitoring with CPU observation history.', footer: 'Pulsed · live cluster observations', accent: colors.accent, background: '#071019' },
        source: { type: 'pulsed', resource: id, endpoint: '/api/v1/snapshot', refreshMs: 2000 },
    }, label, 'Waiting for live Pulsed data. No synthetic metrics are shown.');
}
// Application-owned, explicit registrations. Document metadata never imports
// modules or chooses network locations. Unknown providers retain the authored SVG.
export const pageProviders = new Map([
    ['@pulsed/dashboard/overview', { version: 1, render: (page, context) => {
                const { nodes, colors } = context, width = Math.max(300, context.width);
                const compact = context.density === 'compact';
                const minimum = compact ? 300 : 340;
                const columns = Math.max(1, Math.min(compact ? 4 : 3, Math.floor((width + 14) / (minimum + 14))));
                const gap = compact ? 8 : 14, cardWidth = (width - gap * (columns - 1)) / columns, cardHeight = 150;
                const names = {};
                const cards = nodes.map((node, index) => {
                    const id = `overview-node-${index}`;
                    names[id] = node.name;
                    const cpu = node.cpu.average, memory = node.memory.percent;
                    const content = [
                        text(`${id}-status`, node.updatedAt ? `${node.state === 'fresh' ? 'online' : node.state} · ${Math.round(node.ageSeconds)}s ago` : 'offline · no heartbeat', 18, 56, colors, 12),
                        text(`${id}-cpu`, cpu === null ? 'CPU unavailable' : `CPU ${cpu.toFixed(1)}% · peak ${node.cpu.peak?.toFixed(1)}%`, 18, 81, colors),
                        text(`${id}-memory`, memory === null ? 'Memory unavailable' : `Memory ${memory.toFixed(1)}%`, 18, 121, colors),
                    ];
                    if (cpu !== null)
                        content.push(createProgressBarNode({ id: `${id}-bar`, bounds: { x: 18, y: 90, width: cardWidth - 36, height: 6 }, value: cpu / 100, fillColor: colors.accent, trackColor: colors.border }));
                    const card = frame(id, compactName(node.name), cardWidth, cardHeight, colors, content);
                    return { ...card, transform: { x: index % columns * (cardWidth + gap), y: Math.floor(index / columns) * (cardHeight + gap), rotation: 0 } };
                });
                const height = Math.max(cardHeight, Math.ceil(nodes.length / columns) * (cardHeight + gap) - gap);
                return document({ id: 'overview-root', kind: 'group', children: cards }, width, height, page.metadata, 'Cluster overview', `${nodes.length} displayed nodes. Activate a node to inspect its metrics.`, names);
            } }],
    ['@pulsed/dashboard/node', { version: 1, render: (page, context) => {
                const node = context.snapshot.nodes.find(node => node.name === context.selected);
                const { colors } = context, width = Math.max(300, Math.min(1100, context.width));
                const columns = width >= 660 ? 2 : 1, gap = 16, cardWidth = (width - gap * (columns - 1)) / columns;
                const height = 300, widgets = [];
                const cpu = node?.cpu.average, memory = node?.memory.percent;
                widgets.push(cpu == null ? frame('node-cpu', 'CPU unavailable', cardWidth, height, colors) : createRadialGaugeNode({
                    id: 'node-cpu', bounds: { x: 0, y: 0, width: cardWidth, height }, title: 'Average CPU', eyebrow: `${node.cpu.count} LOGICAL CPUS`, value: cpu, min: 0, max: 100, unit: '%', accent: colors.accent, warningAt: 80,
                }));
                widgets.push(memory == null ? frame('node-memory', 'Memory unavailable', cardWidth, height, colors) : createLevelIndicatorNode({
                    id: 'node-memory', bounds: { x: 0, y: 0, width: cardWidth, height }, title: 'Memory usage', eyebrow: 'OBSERVED USAGE', value: memory, max: 100, unit: '%', accent: colors.accent, detail: node.memory.label,
                }));
                function recolor(node) {
                    if (node.kind === 'group')
                        return { ...node, children: node.children.filter(child => !child.id.endsWith(':menu')).map(recolor) };
                    if (node.kind === 'rectangle')
                        return { ...node, fill: { color: node.id.endsWith(':fill') ? colors.accent : colors.surface }, stroke: node.stroke ? { ...node.stroke, color: colors.border } : undefined };
                    if (node.kind === 'text')
                        return { ...node, fill: { color: /:(unit)$/.test(node.id) ? colors.accent : /:(eyebrow|detail|tick-label:\d+)$/.test(node.id) ? colors.muted : colors.text } };
                    return node;
                }
                const children = widgets.map((widget, index) => ({ ...recolor(widget), transform: { x: index % columns * (cardWidth + gap), y: Math.floor(index / columns) * (height + gap), rotation: 0 } }));
                return document({ id: 'node-root', kind: 'group', children }, width, columns === 1 ? height * 2 + gap : height, page.metadata, `${node?.name || 'Unknown node'} metrics`, 'Current CPU and memory usage. Unavailable readings are not zero.');
            } }],
    ['@pulsed/dashboard/history', { version: 1, render: (page, context) => {
                const svg = cpuHistoryDocument({ name: context.selected || 'Choose a node', servingNode: context.snapshot.servingNode,
                    points: context.snapshot.history[context.selected] || [], end: context.snapshot.generatedAt, windowMs: context.windowMs, width: context.width,
                    theme: 'dark', colors: context.colors });
                return serializeStasisDocument(updateStasisDocument(parseStasisSvg(svg), { metadata: page.metadata }));
            } }],
]);
export function hydratePage(page, context) {
    const components = sceneFromSvg(page.svg).root.components || {};
    for (const [id, component] of Object.entries(components)) {
        const provider = pageProviders.get(id);
        if (provider && component.version === provider.version) {
            const svg = provider.render(page, context);
            const original = sceneFromSvg(svg);
            const scene = { ...original, root: { ...original.root, components: { ...original.root.components, [id]: component } } };
            // Change only canonical metadata; preserve the interactive SVG attributes.
            const hydrated = svg.replace(/<metadata\b[^>]*id="versytl-scene"[^>]*>[\s\S]*?<\/metadata>/, () => `<metadata id="versytl-scene">${escapeXml(stringifyScene(scene, 0))}</metadata>`);
            return { svg: serializeStasisDocument(parseStasisSvg(hydrated)), supported: true };
        }
    }
    return { svg: page.svg, supported: false };
}

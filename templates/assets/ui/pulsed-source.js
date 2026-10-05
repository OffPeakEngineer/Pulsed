import { BridgeError } from './vendor/bridge/errors.js';
import { createBridgeRegistry } from './vendor/bridge/registry.js';
function record(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new BridgeError('invalid-response', 'Pulsed returned an invalid object');
    return value;
}
function string(value) {
    if (typeof value !== 'string')
        throw new BridgeError('invalid-response', 'Pulsed returned an invalid text field');
    return value;
}
function number(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        throw new BridgeError('invalid-response', 'Pulsed returned an invalid numeric field');
    return value;
}
function percent(value) { return value === null ? null : number(value, 0, 100); }
function array(value) {
    if (!Array.isArray(value))
        throw new BridgeError('invalid-response', 'Pulsed returned an invalid collection');
    return value;
}
export function parsePulsedSnapshot(value) {
    const root = record(value);
    if (root.schemaVersion !== 1)
        throw new BridgeError('invalid-response', 'Unsupported Pulsed snapshot version');
    const summary = record(root.summary);
    const seen = new Set();
    const nodes = array(root.nodes).map(value => {
        const node = record(value), cpu = record(node.cpu), memory = record(node.memory);
        const name = string(node.name), state = string(node.state);
        if (!name || seen.has(name) || !['fresh', 'stale', 'offline'].includes(state))
            throw new BridgeError('invalid-response', 'Invalid Pulsed node identity or state');
        seen.add(name);
        const load = node.load === null ? null : array(node.load).map(value => number(value));
        if (load && load.length !== 3)
            throw new BridgeError('invalid-response', 'Invalid Pulsed load averages');
        const cores = cpu.cores === undefined ? undefined : array(cpu.cores).map(value => {
            const core = record(value);
            return { index: number(core.index), percent: number(core.percent, 0, 100) };
        });
        return {
            name, state: state, ageSeconds: number(node.ageSeconds), updatedAt: number(node.updatedAt),
            ttlSeconds: number(node.ttlSeconds, 1), version: string(node.version), webURL: string(node.webURL),
            cpu: { average: percent(cpu.average), peak: percent(cpu.peak), count: number(cpu.count), ...(cores ? { cores } : {}) },
            memory: { percent: percent(memory.percent), label: string(memory.label) }, load: load,
        };
    });
    const history = Object.assign(Object.create(null), Object.fromEntries(Object.entries(record(root.history)).map(([name, values]) => [name,
        values === null ? [] : array(values).map(value => {
            const point = record(value);
            return { at: number(point.at), average: number(point.average, 0, 100), peak: number(point.peak, 0, 100), ttlSeconds: number(point.ttlSeconds, 1) };
        }).sort((a, b) => a.at - b.at),
    ])));
    return {
        schemaVersion: 1, generatedAt: number(root.generatedAt), servingNode: string(root.servingNode),
        refreshMs: number(root.refreshMs, 1000, 60000), refreshURL: string(root.refreshURL), historyWindowMs: number(root.historyWindowMs),
        summary: { fresh: number(summary.fresh), stale: number(summary.stale), offline: number(summary.offline), hottest: string(summary.hottest) }, nodes, history,
    };
}
export const pulsedSource = {
    kind: 'source', id: 'pulsed/snapshot', version: 1,
    async read(config, context) {
        const url = config?.url;
        if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//') || /[\\\x00-\x20]/.test(url))
            throw new BridgeError('invalid-config', 'Pulsed sources require a same-origin endpoint');
        let response;
        try {
            response = await context.fetch.call(globalThis, url, { headers: { accept: 'application/json' }, cache: 'no-store', signal: context.signal });
        }
        catch (cause) {
            throw new BridgeError('request-failed', 'Unable to refresh this peer', {}, { cause });
        }
        if (!response.ok)
            throw new BridgeError('request-failed', `Pulsed returned HTTP ${response.status}`);
        let data;
        try {
            data = parsePulsedSnapshot(await response.json());
        }
        catch (cause) {
            throw new BridgeError('invalid-response', 'Unable to read this peer’s snapshot', {}, { cause });
        }
        return { data, observedAt: context.now().toISOString(), freshness: 'fresh', issues: [] };
    },
};
export const pulsedBridge = createBridgeRegistry([pulsedSource]);
export function snapshotURL(href, includeCores = '') {
    const url = new URL(href);
    const index = url.pathname.lastIndexOf('/pages/');
    const prefix = index >= 0 ? url.pathname.slice(0, index) : url.pathname.replace(/\/[^/]*$/, '');
    url.pathname = prefix + '/api/v1/snapshot';
    url.hash = '';
    url.searchParams.delete('include_cores');
    if (includeCores)
        url.searchParams.set('include_cores', includeCores);
    return url.pathname + url.search;
}
export function pagesURL(base, currentHref) {
    const url = new URL(base, currentHref);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        throw new Error('Invalid peer URL');
    if (!url.pathname.endsWith('/pages/'))
        url.pathname = new URL('./pages/', url).pathname;
    const current = new URL(currentHref);
    for (const key of ['theme', 'palette', 'focus', 'window', 'q', 'sort', 'density', 'hide', 'paused']) {
        if (current.searchParams.has(key))
            url.searchParams.set(key, current.searchParams.get(key));
    }
    url.hash = current.hash || '#overview';
    return url.href;
}
export function classicURL(href) {
    const url = new URL(href);
    const index = url.pathname.lastIndexOf('/pages/');
    url.pathname = index >= 0 ? url.pathname.slice(0, index) + '/' : '/';
    url.hash = '';
    return url.pathname + url.search;
}

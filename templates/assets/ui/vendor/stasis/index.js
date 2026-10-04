export const STASIS_SCHEMA_VERSION = 1;
const metadataPattern = /<metadata\b([^>]*)>([\s\S]*?)<\/metadata>/gi;
const activeContentPattern = /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*javascript:/i;
export function parseStasisSvg(svg) {
    assertSafeStasisSvg(svg);
    const metadata = parsePageMetadata(svg);
    validateMetadata(metadata);
    return {
        svg,
        metadata,
        title: textElement(svg, 'title'),
        description: textElement(svg, 'desc'),
        bindings: collectStasisBindings(svg),
        metadataIds: collectMetadataIds(svg),
    };
}
export function serializeStasisDocument(document) {
    assertSafeStasisSvg(document.svg);
    validateMetadata(document.metadata);
    return writeStasisPageMetadata(document.svg, document.metadata);
}
export function updateStasisDocument(document, update) {
    const metadata = mergeDefined(document.metadata, update.metadata ?? {});
    let svg = writeStasisPageMetadata(document.svg, metadata);
    if (update.title !== undefined)
        svg = writeTextElement(svg, 'title', update.title);
    if (update.description !== undefined)
        svg = writeTextElement(svg, 'desc', update.description);
    return parseStasisSvg(svg);
}
export function writeStasisPageMetadata(svg, metadata) {
    validateMetadata(metadata);
    const content = encodeXml(canonicalJson(metadata));
    let found = false;
    metadataPattern.lastIndex = 0;
    const updated = svg.replace(metadataPattern, (element, attributes) => {
        if (!/\bid=["']stasis-page["']/i.test(attributes))
            return element;
        found = true;
        return `<metadata${attributes}>${content}</metadata>`;
    });
    if (found)
        return updated;
    const element = `<metadata id="stasis-page">${content}</metadata>`;
    const desc = /<desc\b[^>]*>[\s\S]*?<\/desc>/i;
    if (desc.test(updated))
        return updated.replace(desc, match => `${match}\n  ${element}`);
    const title = /<title\b[^>]*>[\s\S]*?<\/title>/i;
    if (title.test(updated))
        return updated.replace(title, match => `${match}\n  ${element}`);
    return updated.replace(/<svg\b([^>]*)>/i, `<svg$1>\n  ${element}`);
}
export function collectStasisBindings(svg) {
    const bindings = [];
    const pattern = /\bdata-stasis-(bind|status|href)\s*=\s*["']([^"']+)["']/gi;
    for (const match of svg.matchAll(pattern)) {
        const target = match[1] === 'bind' ? 'text' : match[1];
        bindings.push({ target, path: decodeXml(match[2] ?? ''), sourceId: 'default' });
    }
    return bindings;
}
export function assertSafeStasisSvg(svg) {
    if (!/<svg\b/i.test(svg))
        throw new Error('Stasis document is not an SVG');
    if (activeContentPattern.test(svg))
        throw new Error('Stasis document contains active SVG content');
}
export function validateMetadata(metadata) {
    if (metadata.schemaVersion !== undefined && metadata.schemaVersion !== STASIS_SCHEMA_VERSION) {
        throw new Error(`Unsupported Stasis schema version: ${String(metadata.schemaVersion)}`);
    }
    const sources = { ...(metadata.source ? { default: metadata.source } : {}), ...metadata.sources };
    for (const [id, source] of Object.entries(sources)) {
        if (!source.type)
            throw new Error(`Stasis source ${id} is missing an adapter type`);
        if (source.endpoint && !isSafeEndpoint(source.endpoint))
            throw new Error(`Stasis source ${id} must use a relative endpoint`);
        if (source.refreshMs !== undefined && (!Number.isFinite(source.refreshMs) || source.refreshMs < 1_000)) {
            throw new Error(`Stasis source ${id} refreshMs must be at least 1000`);
        }
    }
}
function parsePageMetadata(svg) {
    metadataPattern.lastIndex = 0;
    for (const match of svg.matchAll(metadataPattern)) {
        if (!/\bid=["']stasis-page["']/i.test(match[1] ?? ''))
            continue;
        const value = decodeXml(match[2]?.trim() ?? '');
        if (!value)
            return {};
        try {
            return JSON.parse(value);
        }
        catch (error) {
            throw new Error(`Invalid stasis-page metadata: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return {};
}
function collectMetadataIds(svg) {
    const ids = [];
    metadataPattern.lastIndex = 0;
    for (const match of svg.matchAll(metadataPattern)) {
        const id = /\bid=["']([^"']+)["']/i.exec(match[1] ?? '')?.[1];
        if (id)
            ids.push(id);
    }
    return ids;
}
function writeTextElement(svg, tag, value) {
    const encoded = encodeXml(value);
    const pattern = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'i');
    if (pattern.test(svg))
        return svg.replace(pattern, `<${tag}>${encoded}</${tag}>`);
    return svg.replace(/<svg\b([^>]*)>/i, `<svg$1>\n  <${tag}>${encoded}</${tag}>`);
}
function textElement(svg, tag) {
    const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(svg);
    return match?.[1] ? decodeXml(match[1].replace(/<[^>]+>/g, '').trim()) : '';
}
function mergeDefined(base, update) {
    return { ...base, ...Object.fromEntries(Object.entries(update).filter(([, value]) => value !== undefined)) };
}
function canonicalJson(value) {
    return JSON.stringify(canonicalValue(value));
}
function canonicalValue(value) {
    if (Array.isArray(value))
        return value.map(canonicalValue);
    if (!value || typeof value !== 'object')
        return value;
    return Object.fromEntries(Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalValue(child)]));
}
function isSafeEndpoint(value) {
    return value.startsWith('/') && !value.startsWith('//') && !/[\u0000-\u001f]/.test(value);
}
function encodeXml(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function decodeXml(value) {
    return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

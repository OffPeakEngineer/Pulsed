export const SHIPKIT_CARD_COMPONENT = '@versytl/shipkit/card';
const defaultTheme = {
    surface: '#fffdfa',
    border: '#d8d1c5',
    selectedBorder: '#6755d9',
    title: '#27262d',
    eyebrow: '#77727c',
    menu: '#77727c',
};
const internalZ = {
    shadow: 0,
    surface: 10,
    header: 20,
    content: 30,
    accessory: 40,
    station: 50,
};
const defaultHeader = {
    eyebrowY: 20,
    eyebrowFontSize: 9,
    eyebrowFontWeight: 800,
    titleY: 43,
    titleFontSize: 15,
    titleFontWeight: 720,
    accessoryY: 20,
    menuY: 28,
};
/**
 * Build a renderer-neutral card with deterministic internal paint bands.
 * `options.zIndex` positions the complete card among its siblings; Shipkit
 * owns only the ordering of the card's shadow, surface, header, content, and
 * accessories.
 */
export function createCardNode(options) {
    const theme = { ...defaultTheme, ...options.theme };
    const padding = options.padding ?? 18;
    const radius = options.radius ?? 13;
    const header = { ...defaultHeader, ...options.header };
    const titleY = options.eyebrow ? header.titleY : 28;
    const children = [];
    if (options.shadow !== false) {
        const shadow = options.shadow ?? {};
        children.push(rectangle(`${options.id}:shadow`, options.bounds.width, options.bounds.height, options.bounds.width / 2 + (shadow.x ?? 3), options.bounds.height / 2 + (shadow.y ?? 5), shadow.color ?? '#27262d', radius, undefined, 0, shadow.opacity ?? 0.11, internalZ.shadow));
    }
    children.push(rectangle(`${options.id}:surface`, options.bounds.width, options.bounds.height, options.bounds.width / 2, options.bounds.height / 2, theme.surface, radius, options.selected ? (theme.selectedBorder ?? theme.border) : theme.border, options.selected ? 2 : 1, 1, internalZ.surface));
    if (options.eyebrow) {
        children.push(text(`${options.id}:eyebrow`, options.eyebrow.toUpperCase(), padding, header.eyebrowY, header.eyebrowFontSize, theme.eyebrow, header.eyebrowFontWeight, 'start', internalZ.header));
    }
    if (options.title) {
        children.push(text(`${options.id}:title`, options.title, padding, titleY, header.titleFontSize, theme.title, header.titleFontWeight, 'start', internalZ.header));
    }
    if (options.children.length) {
        children.push({
            id: `${options.id}:content-layer`,
            kind: 'group',
            zIndex: internalZ.content,
            children: options.children,
        });
    }
    if (options.badge) {
        const width = options.badge.width ?? 50;
        const x = options.bounds.width - padding - width / 2;
        children.push(rectangle(`${options.id}:badge`, width, 18, x, header.accessoryY, options.badge.fill, 9, undefined, 0, 1, internalZ.accessory), text(`${options.id}:badge-label`, options.badge.label, x, header.accessoryY, 7.5, options.badge.color, 820, 'center', internalZ.accessory));
    }
    if (options.menuLabel) {
        children.push(text(`${options.id}:menu`, options.menuLabel, options.bounds.width - padding, header.menuY, 11, theme.menu, 600, 'end', internalZ.accessory));
    }
    if (options.station) {
        const edge = options.station.edge ?? 'bottom';
        const point = stationPoint(edge, options.bounds.width, options.bounds.height);
        children.push(ellipse(`${options.id}:station`, point.x, point.y, options.station.radius ?? 8, options.station.fill ?? theme.surface, options.station.color, options.station.strokeWidth ?? 4, internalZ.station));
    }
    return {
        id: options.id,
        kind: 'group',
        transform: { x: options.bounds.x, y: options.bounds.y, rotation: 0 },
        zIndex: options.zIndex,
        metadata: options.metadata,
        components: {
            ...options.components,
            [SHIPKIT_CARD_COMPONENT]: {
                version: 1,
                data: {
                    ...(options.title ? { title: options.title } : {}),
                    ...(options.eyebrow ? { eyebrow: options.eyebrow } : {}),
                    selected: options.selected ?? false,
                    ...(options.station ? { stationEdge: options.station.edge ?? 'bottom' } : {}),
                },
            },
        },
        children,
    };
}
function stationPoint(edge, width, height) {
    if (edge === 'top')
        return { x: width / 2, y: 0 };
    if (edge === 'right')
        return { x: width, y: height / 2 };
    if (edge === 'left')
        return { x: 0, y: height / 2 };
    return { x: width / 2, y: height };
}
function ellipse(id, x, y, radius, fill, stroke, strokeWidth, zIndex) {
    return {
        id,
        kind: 'ellipse',
        radiusX: radius,
        radiusY: radius,
        transform: { x, y, rotation: 0 },
        fill: { color: fill },
        stroke: { color: stroke, width: strokeWidth },
        zIndex,
    };
}
function rectangle(id, width, height, x, y, fill, radius, stroke, strokeWidth = 0, opacity = 1, zIndex = 0) {
    return {
        id,
        kind: 'rectangle',
        width,
        height,
        radius,
        transform: { x, y, rotation: 0 },
        fill: { color: fill, opacity },
        stroke: stroke ? { color: stroke, width: strokeWidth } : undefined,
        zIndex,
    };
}
function text(id, value, x, y, fontSize, fill, fontWeight, align, zIndex) {
    return {
        id,
        kind: 'text',
        text: value,
        fontSize,
        fontWeight,
        align,
        baseline: 'middle',
        transform: { x, y, rotation: 0 },
        fill: { color: fill },
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        zIndex,
    };
}

import { createCardNode } from './cardScene.js';
const colors = {
    card: '#0d1d27',
    cardEdge: '#1d3543',
    inset: '#0a161e',
    grid: '#263b47',
    text: '#f1f6f7',
    muted: '#78909d',
    dim: '#506875',
};
export function createDashboardCardNode(options) {
    return createCardNode({
        ...options,
        radius: 16,
        padding: 22,
        shadow: false,
        menuLabel: '•••',
        header: {
            eyebrowY: 23,
            eyebrowFontWeight: 600,
            titleY: 46,
            titleFontSize: 14,
            titleFontWeight: 600,
        },
        theme: {
            surface: colors.card,
            border: colors.cardEdge,
            title: '#dce7eb',
            eyebrow: colors.muted,
            menu: colors.dim,
        },
        components: {
            '@versytl/shipkit/dashboard-widget': {
                version: 1,
                data: { title: options.title, eyebrow: options.eyebrow },
            },
        },
    });
}
export function createRadialGaugeNode(options) {
    const start = 150;
    const sweep = 240;
    const progress = clamp((options.value - options.min) / (options.max - options.min), 0, 1);
    const angle = start + progress * sweep;
    const warning = start + ((options.warningAt ?? options.max) - options.min) / (options.max - options.min) * sweep;
    const needle = polar(110, 110, 70, angle);
    const gauge = [
        path(`${options.id}:track`, arcCommands(110, 110, 86, start, start + sweep), undefined, '#283c4b', 9),
        path(`${options.id}:value-arc`, arcCommands(110, 110, 86, start, angle), undefined, options.accent, 9),
    ];
    if (warning < start + sweep) {
        gauge.push(path(`${options.id}:warning`, arcCommands(110, 110, 96, warning, start + sweep), undefined, '#ff6b6b', 3));
    }
    for (let index = 0; index < 13; index += 1) {
        const tickAngle = start + index / 12 * sweep;
        const outer = polar(110, 110, 91, tickAngle);
        const inner = polar(110, 110, index % 3 === 0 ? 80 : 84, tickAngle);
        gauge.push(path(`${options.id}:tick:${index}`, lineCommands(inner.x, inner.y, outer.x, outer.y), undefined, index % 3 === 0 ? '#d9e5ed' : '#607181', index % 3 === 0 ? 2 : 1));
    }
    gauge.push(path(`${options.id}:needle`, lineCommands(110, 110, needle.x, needle.y), undefined, options.accent, 3), ellipse(`${options.id}:hub`, 7, 7, 110, 110, colors.inset, options.accent, 3), text(`${options.id}:reading`, formatValue(options.value), 110, 151, 31, colors.text, 700, 'center', 'middle'), text(`${options.id}:unit`, options.unit, 110, 178, 12, options.accent, 700, 'center'));
    return createDashboardCardNode({ ...options, children: [fit(`${options.id}:content`, options.bounds, 220, 220, gauge)] });
}
export function createCompassIndicatorNode(options) {
    const dial = [ellipse(`${options.id}:dial`, 101, 101, 120, 110, colors.inset, '#2b4252', 2)];
    for (let index = 0; index < 36; index += 1) {
        const angle = index * 10 - options.value;
        const major = index % 3 === 0;
        const inner = polar(120, 110, major ? 86 : 92, angle - 90);
        const outer = polar(120, 110, 99, angle - 90);
        dial.push(path(`${options.id}:mark:${index}`, lineCommands(inner.x, inner.y, outer.x, outer.y), undefined, major ? '#c2d0d7' : '#536b79', major ? 2 : 1));
    }
    const cardinalAngles = [{ label: 'N', angle: 0 }, { label: 'E', angle: 90 }, { label: 'S', angle: 180 }, { label: 'W', angle: 270 }];
    for (const item of cardinalAngles) {
        const point = polar(120, 110, 75, item.angle - options.value - 90);
        dial.push(text(`${options.id}:cardinal:${item.label}`, item.label, point.x, point.y, 13, item.label === 'N' ? '#ff6b6b' : '#d5e1e7', 750, 'center', 'middle'));
    }
    const wind = polar(120, 110, 75, options.windDirection - options.value - 90);
    dial.push(path(`${options.id}:lubber`, [{ command: 'move', x: 120, y: 5 }, { command: 'line', x: 112, y: 20 }, { command: 'line', x: 128, y: 20 }, { command: 'close' }], { color: '#55e6c1' }), ellipse(`${options.id}:center`, 43, 43, 120, 110, '#10212c', '#304958', 1), text(`${options.id}:heading`, String(Math.round(options.value)).padStart(3, '0'), 120, 104, 30, colors.text, 700, 'center', 'middle'), text(`${options.id}:unit`, options.unit, 120, 132, 10, colors.muted, 700, 'center'), ellipse(`${options.id}:wind`, 5, 5, wind.x, wind.y, '#6fb7ff'), metric(`${options.id}:course`, 'COURSE', `${options.course}°`, 252, 68, 118), metric(`${options.id}:wind-stat`, 'WIND', `${options.windDirection}°`, 252, 130, 118));
    return createDashboardCardNode({ ...options, children: [fit(`${options.id}:content`, options.bounds, 390, 220, dial)] });
}
export function createLevelIndicatorNode(options) {
    const ratio = clamp(options.value / options.max, 0, 1);
    const fillHeight = ratio * 132;
    const fillY = options.inverse ? 48 : 180 - fillHeight;
    const nodes = [
        rectangle(`${options.id}:track`, 42, 132, 56, 114, colors.inset, '#304553', 2, 18),
    ];
    if (fillHeight > 0) {
        nodes.push(rectangle(`${options.id}:fill`, 30, fillHeight, 56, fillY + fillHeight / 2, options.accent, undefined, 0, Math.min(13, fillHeight / 2)));
    }
    for (let index = 0; index < 5; index += 1) {
        const y = 180 - index / 4 * 132;
        nodes.push(path(`${options.id}:tick:${index}`, lineCommands(84, y, 94, y), undefined, '#637682', 1), text(`${options.id}:tick-label:${index}`, String(Math.round(index / 4 * options.max)), 100, y + 1, 9, '#637682', 400, 'start', 'middle'));
    }
    nodes.push(text(`${options.id}:reading`, formatValue(options.value), 157, 102, 34, colors.text, 700, 'center', 'middle'), text(`${options.id}:unit`, options.unit, 157, 131, 12, options.accent, 750, 'center'), text(`${options.id}:detail`, options.detail, 110, 207, 11, colors.muted, 400, 'center'));
    return createDashboardCardNode({ ...options, children: [fit(`${options.id}:content`, options.bounds, 220, 220, nodes)] });
}
export function createTrendChartNode(options) {
    const points = options.values.map((item, index) => ({
        ...item,
        x: 38 + index / Math.max(1, options.values.length - 1) * 484,
        y: 172 - (item.value - options.min) / (options.max - options.min) * 126,
    }));
    const nodes = [];
    for (let index = 0; index < 4; index += 1) {
        const y = 46 + index * 42;
        const value = options.max - index * (options.max - options.min) / 3;
        nodes.push(path(`${options.id}:grid:${index}`, lineCommands(38, y, 522, y), undefined, colors.grid, 1), text(`${options.id}:axis:${index}`, formatValue(value), 28, y + 3, 9, colors.muted, 400, 'end'));
    }
    if (points.length) {
        nodes.push(path(`${options.id}:line`, points.map((point, index) => ({ command: index ? 'line' : 'move', x: point.x, y: point.y })), undefined, options.accent, 3));
    }
    for (const [index, point] of points.entries()) {
        nodes.push(ellipse(`${options.id}:point:${index}`, 3.5, 3.5, point.x, point.y, colors.inset, options.accent, 2));
        if (index % 2 === 0)
            nodes.push(text(`${options.id}:label:${index}`, point.label, point.x, 204, 9, colors.muted, 400, 'center'));
    }
    const latest = points.at(-1)?.value ?? 0;
    nodes.push(text(`${options.id}:latest`, `${formatValue(latest)} ${options.unit}`, 516, 30, 18, colors.text, 700, 'end'));
    return createDashboardCardNode({ ...options, children: [fit(`${options.id}:content`, options.bounds, 560, 220, nodes)] });
}
export function createSeaStateNode(options) {
    const nodes = [
        rectangle(`${options.id}:sky`, 320, 180, 160, 100, '#162b38', undefined, 0, 12),
        ellipse(`${options.id}:sun`, 10, 10, 254, 48, '#ffd47c'),
        path(`${options.id}:water`, waveArea(320, 116, 16, 2, 180), { color: '#0d4a68' }),
        path(`${options.id}:wave`, waveCommands(320, 116, 16, 2), undefined, '#65d5ef', 3),
        path(`${options.id}:wave-back`, waveCommands(320, 142, 9, 2.5, 1.4), undefined, '#438eaa', 2),
        text(`${options.id}:state`, 'MODERATE', 20, 30, 11, '#cbe7ef', 750),
        metric(`${options.id}:height`, 'WAVE HEIGHT', `${options.waveHeight} ${options.unit}`, 340, 12, 160),
        metric(`${options.id}:period`, 'PERIOD', `${options.wavePeriod} s`, 340, 58, 160),
        metric(`${options.id}:wind`, 'WIND', `${options.windSpeed} kn`, 340, 104, 160),
        metric(`${options.id}:water-temp`, 'WATER', `${options.waterTemperature}° C`, 340, 150, 160),
    ];
    return createDashboardCardNode({ ...options, children: [fit(`${options.id}:content`, options.bounds, 520, 200, nodes)] });
}
export function createSystemsBoardNode(options) {
    const designWidth = 560;
    const nodes = [];
    const itemWidth = 266;
    for (const [index, item] of options.items.entries()) {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = 8 + column * 274;
        const y = 12 + row * 61;
        const statusColor = item.status === 'ok' ? '#55e6c1' : item.status === 'warning' ? '#ffb55e' : '#71828c';
        nodes.push(rectangle(`${options.id}:item:${index}`, itemWidth, 53, x + itemWidth / 2, y + 26.5, colors.inset, colors.cardEdge, 1, 9), ellipse(`${options.id}:status:${index}`, 4, 4, x + 17, y + 26, statusColor), text(`${options.id}:label:${index}`, item.label, x + 33, y + 23, 10, '#d3dfe4', 600), text(`${options.id}:value:${index}`, item.value.toUpperCase(), x + 33, y + 39, 8, colors.muted, 500));
    }
    return createDashboardCardNode({ ...options, children: [fit(`${options.id}:content`, options.bounds, designWidth, 200, nodes)] });
}
function fit(id, bounds, width, height, children) {
    const availableHeight = Math.max(1, bounds.height - 62);
    const scale = Math.min((bounds.width - 20) / width, (availableHeight - 8) / height);
    return {
        id,
        kind: 'group',
        transform: {
            x: (bounds.width - width * scale) / 2,
            y: 58 + (availableHeight - height * scale) / 2,
            rotation: 0,
            scaleX: scale,
            scaleY: scale,
        },
        children,
    };
}
function metric(id, label, value, x, y, width) {
    return group(id, 0, 0, [
        rectangle(`${id}:surface`, width, 42, x + width / 2, y + 21, '#102430'),
        text(`${id}:label`, label, x + 12, y + 15, 8, colors.muted, 600),
        text(`${id}:value`, value, x + 12, y + 32, 13, colors.text, 600),
    ]);
}
function group(id, x, y, children, components) {
    return { id, kind: 'group', transform: { x, y, rotation: 0 }, components, children };
}
function rectangle(id, width, height, x, y, fill, stroke, strokeWidth = 0, radius = 0) {
    return { id, kind: 'rectangle', width, height, radius, transform: { x, y, rotation: 0 }, fill: { color: fill }, stroke: stroke ? { color: stroke, width: strokeWidth } : undefined };
}
function ellipse(id, radiusX, radiusY, x, y, fill, stroke, strokeWidth = 0) {
    return { id, kind: 'ellipse', radiusX, radiusY, transform: { x, y, rotation: 0 }, fill: { color: fill }, stroke: stroke ? { color: stroke, width: strokeWidth } : undefined };
}
function text(id, value, x, y, fontSize, fill, fontWeight = 400, align = 'start', baseline = 'alphabetic') {
    return { id, kind: 'text', text: value, fontSize, fontWeight, align, baseline, transform: { x, y, rotation: 0 }, fill: { color: fill }, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' };
}
function path(id, commands, fill, stroke, strokeWidth = 0) {
    return { id, kind: 'path', commands, fill, stroke: stroke ? { color: stroke, width: strokeWidth, lineCap: 'round', lineJoin: 'round' } : undefined };
}
function lineCommands(x1, y1, x2, y2) {
    return [{ command: 'move', x: x1, y: y1 }, { command: 'line', x: x2, y: y2 }];
}
function arcCommands(cx, cy, radius, start, end) {
    const steps = Math.max(2, Math.ceil(Math.abs(end - start) / 6));
    return Array.from({ length: steps + 1 }, (_, index) => {
        const point = polar(cx, cy, radius, start + (end - start) * index / steps);
        return { command: index ? 'line' : 'move', ...point };
    });
}
function waveCommands(width, y, amplitude, cycles, phase = 0) {
    return Array.from({ length: 65 }, (_, index) => {
        const progress = index / 64;
        return {
            command: index ? 'line' : 'move',
            x: progress * width,
            y: y - Math.sin(phase + progress * Math.PI * 2 * cycles) * amplitude,
        };
    });
}
function waveArea(width, y, amplitude, cycles, bottom) {
    return [...waveCommands(width, y, amplitude, cycles), { command: 'line', x: width, y: bottom }, { command: 'line', x: 0, y: bottom }, { command: 'close' }];
}
function polar(cx, cy, radius, angle) {
    const radians = angle * Math.PI / 180;
    return { x: cx + Math.cos(radians) * radius, y: cy + Math.sin(radians) * radius };
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function formatValue(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

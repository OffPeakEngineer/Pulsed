export function diskMeters(id, disks, width, colors) {
    const columns = Math.max(1, Math.floor(width / 100)), cell = width / columns;
    const children = (disks || []).map((disk, index) => {
        const percent = disk.total ? Math.max(0, Math.min(100, disk.used / disk.total * 100)) : 0;
        const color = percent >= 90 ? '#ef4444' : percent >= 75 ? '#eab308' : colors.accent;
        const cylinder = (top) => [
            { command: 'move', x: 4, y: top },
            { command: 'cubic', control1X: 4, control1Y: top - 6, control2X: 32, control2Y: top - 6, x: 32, y: top },
            { command: 'line', x: 32, y: 36 },
            { command: 'cubic', control1X: 32, control1Y: 42, control2X: 4, control2Y: 42, x: 4, y: 36 },
            { command: 'close' },
        ];
        const label = `${disk.name}: ${percent.toFixed(1)}% used · ${(disk.used / 2 ** 30).toFixed(1)} / ${(disk.total / 2 ** 30).toFixed(1)} GiB · ${disk.mounts.join(', ')}`;
        const shapes = [{ id: `${id}-${index}-track`, kind: 'path', commands: cylinder(6), fill: { color: colors.border } }];
        if (percent > 0)
            shapes.push({ id: `${id}-${index}-fill`, kind: 'path', commands: cylinder(36 - 30 * percent / 100), fill: { color } });
        shapes.push({ id: `${id}-${index}-rim`, kind: 'path', commands: [
                { command: 'move', x: 4, y: 6 }, { command: 'cubic', control1X: 4, control1Y: 12, control2X: 32, control2Y: 12, x: 32, y: 6 },
            ], stroke: { color: colors.text, width: 1 } });
        for (const [text, y] of [[disk.name.length > 12 ? disk.name.slice(0, 10) + '…' : disk.name, 54], [`${percent.toFixed(0)}%`, 69]]) {
            shapes.push({ id: `${id}-${index}-label-${y}`, kind: 'text', text, fontSize: 11, fill: { color: colors.text }, transform: { x: 18, y, rotation: 0 }, align: 'center' });
        }
        return { id: `${id}-${index}`, kind: 'group', children: shapes, metadata: { diskLabel: label }, transform: { x: index % columns * cell + (cell - 36) / 2, y: Math.floor(index / columns) * 82, rotation: 0 } };
    });
    if (!disks?.length)
        children.push({ id: `${id}-unavailable`, kind: 'text', text: 'No disk readings available', fontSize: 12, fill: { color: colors.text }, transform: { x: 0, y: 20, rotation: 0 } });
    return { root: { id, kind: 'group', children }, height: disks?.length ? Math.ceil(disks.length / columns) * 82 : 32 };
}
export function diskAttributes(node) {
    return typeof node.metadata?.diskLabel === 'string' ? { role: 'img', tabindex: '0', 'aria-label': node.metadata.diskLabel, 'data-disk-meter': node.metadata.diskLabel } : undefined;
}

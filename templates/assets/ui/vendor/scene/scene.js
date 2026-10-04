import { SCENE_VERSION } from './types.js';
import { validateScene, validateSceneNode } from './validation.js';
export function createScene(width, height, root, options = {}) {
    const scene = {
        version: SCENE_VERSION,
        width,
        height,
        root,
        ...(options.connectors ? { connectors: options.connectors } : {}),
        ...(options.components ? { components: options.components } : {}),
    };
    validateScene(scene);
    return scene;
}
/** Stable sort: equal z-index nodes retain their declaration order. */
export function childrenInPaintOrder(group) {
    return group.children
        .map((node, index) => ({ node, index }))
        .sort((left, right) => (left.node.zIndex ?? 0) - (right.node.zIndex ?? 0)
        || left.index - right.index)
        .map(entry => entry.node);
}
export function visitScene(root, visitor) {
    const visit = (node, parent) => {
        if (node.visible === false)
            return;
        visitor(node, parent);
        if (node.kind === 'group') {
            for (const child of childrenInPaintOrder(node))
                visit(child, node);
        }
    };
    visit(root, undefined);
}
export { validateSceneNode };

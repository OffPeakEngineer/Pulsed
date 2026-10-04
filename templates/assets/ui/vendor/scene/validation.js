import { LEGACY_SCENE_VERSION, SCENE_CANVAS_COMPONENT, SCENE_CONNECTOR_VIEW_COMPONENT, SCENE_LAYER_COMPONENT, SCENE_PREFAB_COMPONENT, SCENE_SNAP_POINTS_COMPONENT, SCENE_VERSION, } from './types.js';
const COMPONENT_ID_PATTERN = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)+$/;
export class SceneValidationError extends Error {
    code;
    path;
    constructor(code, path, message) {
        super(`${message} at ${path}`);
        this.name = 'SceneValidationError';
        this.code = code;
        this.path = path;
    }
}
export function isSceneComponentId(value) {
    return COMPONENT_ID_PATTERN.test(value);
}
export function validateScene(value) {
    const scene = expectRecord(value, '$', 'invalid-scene', 'Scene must be an object');
    if (scene.version !== SCENE_VERSION) {
        throw new SceneValidationError('unsupported-version', '$.version', `Expected scene version ${SCENE_VERSION}, received ${String(scene.version)}`);
    }
    validateSceneBody(scene, true);
}
export function validateLegacyScene(value) {
    const scene = expectRecord(value, '$', 'invalid-scene', 'Scene must be an object');
    if (scene.version !== LEGACY_SCENE_VERSION) {
        throw new SceneValidationError('unsupported-version', '$.version', `Expected legacy scene version ${LEGACY_SCENE_VERSION}, received ${String(scene.version)}`);
    }
    if ('components' in scene) {
        throw new SceneValidationError('invalid-scene', '$.components', 'Version-one scenes cannot contain components');
    }
    validateSceneBody(scene, false);
}
export function validateSceneNode(root) {
    validateNodeGraph(root, true);
}
export function validateSceneComponentMap(components, path = '$.components') {
    const map = expectRecord(components, path, 'invalid-component', 'Scene components must be an object');
    for (const [id, component] of Object.entries(map)) {
        const componentPath = `${path}[${JSON.stringify(id)}]`;
        if (!isSceneComponentId(id)) {
            throw new SceneValidationError('invalid-component-id', componentPath, `Invalid scene component ID ${JSON.stringify(id)}`);
        }
        validateComponent(component, componentPath);
        if (id === SCENE_LAYER_COMPONENT) {
            validateSceneLayerComponent(component, componentPath);
        }
        if (id === SCENE_CANVAS_COMPONENT) {
            validateSceneCanvasComponent(component, componentPath);
        }
        if (id === SCENE_PREFAB_COMPONENT) {
            validateScenePrefabComponent(component, componentPath);
        }
        if (id === SCENE_SNAP_POINTS_COMPONENT) {
            validateSceneSnapPointsComponent(component, componentPath);
        }
        if (id === SCENE_CONNECTOR_VIEW_COMPONENT) {
            validateSceneConnectorViewComponent(component, componentPath);
        }
    }
}
export function validateSceneConnectorViewComponent(value, path = '$') {
    const component = validateComponent(value, path);
    expectStandardVersion(component, path);
    const data = expectRecord(component.data, `${path}.data`, 'invalid-standard-component', 'Connector-view component data must be an object');
    expectNonEmptyString(data.connectorId, `${path}.data.connectorId`, 'invalid-standard-component', 'Connector-view connector ID must be a non-empty string');
    if (data.role !== undefined) {
        expectNonEmptyString(data.role, `${path}.data.role`, 'invalid-standard-component', 'Connector-view role must be a non-empty string');
    }
}
export function validateScenePrefabComponent(value, path = '$') {
    const component = validateComponent(value, path);
    expectStandardVersion(component, path);
    const data = expectRecord(component.data, `${path}.data`, 'invalid-standard-component', 'Prefab component data must be an object');
    const id = expectNonEmptyString(data.id, `${path}.data.id`, 'invalid-standard-component', 'Prefab ID must be a non-empty string');
    if (!isSceneComponentId(id)) {
        throw new SceneValidationError('invalid-standard-component', `${path}.data.id`, 'Prefab ID must be an npm-style namespaced ID');
    }
    expectNonEmptyString(data.name, `${path}.data.name`, 'invalid-standard-component', 'Prefab name must be a non-empty string');
}
export function validateSceneCanvasComponent(value, path = '$') {
    const component = validateComponent(value, path);
    expectStandardVersion(component, path);
    const data = expectRecord(component.data, `${path}.data`, 'invalid-standard-component', 'Canvas component data must be an object');
    expectOptionalEnum(data.mode, ['infinite', 'masked'], `${path}.data.mode`, 'Canvas mode is invalid');
    if (data.mode === undefined) {
        throw new SceneValidationError('invalid-standard-component', `${path}.data.mode`, 'Canvas mode is required');
    }
    if (data.mode === 'masked') {
        expectNonEmptyString(data.maskNodeId, `${path}.data.maskNodeId`, 'invalid-standard-component', 'A masked canvas requires a mask node ID');
    }
    else if (data.maskNodeId !== undefined) {
        throw new SceneValidationError('invalid-standard-component', `${path}.data.maskNodeId`, 'An infinite canvas cannot define a mask node');
    }
}
export function validateSceneLayerComponent(value, path = '$') {
    const component = validateComponent(value, path);
    expectStandardVersion(component, path);
    const data = expectRecord(component.data, `${path}.data`, 'invalid-standard-component', 'Layer component data must be an object');
    expectNonEmptyString(data.name, `${path}.data.name`, 'invalid-standard-component', 'Layer name must be a non-empty string');
    expectOptionalBoolean(data.locked, `${path}.data.locked`, 'invalid-standard-component', 'Layer locked must be a boolean');
}
export function validateSceneSnapPointsComponent(value, path = '$') {
    const component = validateComponent(value, path);
    expectStandardVersion(component, path);
    const data = expectRecord(component.data, `${path}.data`, 'invalid-standard-component', 'Snap-points component data must be an object');
    if (!Array.isArray(data.points)) {
        throw new SceneValidationError('invalid-standard-component', `${path}.data.points`, 'Snap points must be an array');
    }
    const ids = new Set();
    for (const [index, pointValue] of data.points.entries()) {
        const pointPath = `${path}.data.points[${index}]`;
        const point = expectRecord(pointValue, pointPath, 'invalid-standard-component', 'Snap point must be an object');
        const id = expectNonEmptyString(point.id, `${pointPath}.id`, 'invalid-standard-component', 'Snap-point ID must be a non-empty string');
        if (ids.has(id)) {
            throw new SceneValidationError('invalid-standard-component', `${pointPath}.id`, `Duplicate snap-point ID ${id}`);
        }
        ids.add(id);
        expectFinite(point.x, `${pointPath}.x`, 'invalid-standard-component', 'Snap-point x must be finite');
        expectFinite(point.y, `${pointPath}.y`, 'invalid-standard-component', 'Snap-point y must be finite');
        if (point.role !== undefined) {
            expectNonEmptyString(point.role, `${pointPath}.role`, 'invalid-standard-component', 'Snap-point role must be a non-empty string');
        }
        if (point.normal !== undefined) {
            const normal = expectRecord(point.normal, `${pointPath}.normal`, 'invalid-standard-component', 'Snap-point normal must be an object');
            expectFinite(normal.x, `${pointPath}.normal.x`, 'invalid-standard-component', 'Normal x must be finite');
            expectFinite(normal.y, `${pointPath}.normal.y`, 'invalid-standard-component', 'Normal y must be finite');
        }
    }
}
export function validateJsonValue(value, path = '$') {
    validateJson(value, path, new Set());
}
function validateSceneBody(scene, componentsAllowed) {
    expectFinitePositive(scene.width, '$.width', 'Scene width must be a finite positive number');
    expectFinitePositive(scene.height, '$.height', 'Scene height must be a finite positive number');
    if (scene.components !== undefined) {
        if (!componentsAllowed) {
            throw new SceneValidationError('invalid-scene', '$.components', 'Components are not supported by this scene version');
        }
        validateSceneComponentMap(scene.components);
        rejectNodeStandardComponents(scene.components, '$.components');
    }
    if (!componentsAllowed && scene.connectors !== undefined) {
        throw new SceneValidationError('invalid-scene', '$.connectors', 'Connectors are not supported by this scene version');
    }
    const root = expectRecord(scene.root, '$.root', 'invalid-node', 'Scene root must be a group node');
    if (root.kind !== 'group') {
        throw new SceneValidationError('invalid-node', '$.root.kind', 'Scene root must be a group node');
    }
    validateNodeGraph(root, componentsAllowed);
    if (componentsAllowed)
        validateConnectorGraph(scene.connectors, root);
}
function validateConnectorGraph(value, root) {
    if (value !== undefined && !Array.isArray(value)) {
        throw new SceneValidationError('invalid-connector', '$.connectors', 'Scene connectors must be an array');
    }
    const connectors = (value ?? []);
    const nodes = collectNodes(root);
    const connectorIds = new Set();
    connectors.forEach((connectorValue, index) => {
        const path = `$.connectors[${index}]`;
        const connector = expectRecord(connectorValue, path, 'invalid-connector', 'Scene connector must be an object');
        const id = expectNonEmptyString(connector.id, `${path}.id`, 'invalid-connector', 'Scene connector IDs must not be empty');
        if (connectorIds.has(id)) {
            throw new SceneValidationError('duplicate-connector-id', `${path}.id`, `Duplicate scene connector ID ${id}`);
        }
        connectorIds.add(id);
        validateConnectorEndpoint(connector.start, `${path}.start`, nodes);
        validateConnectorEndpoint(connector.end, `${path}.end`, nodes);
        if (connector.components !== undefined) {
            validateSceneComponentMap(connector.components, `${path}.components`);
            rejectSceneNodeComponents(connector.components, `${path}.components`);
        }
    });
    for (const [node, path] of nodes.values()) {
        const view = node.components?.[SCENE_CONNECTOR_VIEW_COMPONENT];
        if (view && !connectorIds.has(view.data.connectorId)) {
            throw new SceneValidationError('invalid-connector-reference', `${path}.components[${JSON.stringify(SCENE_CONNECTOR_VIEW_COMPONENT)}].data.connectorId`, `Connector view references missing connector ${view.data.connectorId}`);
        }
    }
}
function validateConnectorEndpoint(value, path, nodes) {
    const endpoint = expectRecord(value, path, 'invalid-connector', 'Connector endpoint must be an object');
    if (endpoint.kind === 'point') {
        expectFinite(endpoint.x, `${path}.x`, 'invalid-connector', 'Connector point x must be finite');
        expectFinite(endpoint.y, `${path}.y`, 'invalid-connector', 'Connector point y must be finite');
        return;
    }
    if (endpoint.kind !== 'node') {
        throw new SceneValidationError('invalid-connector', `${path}.kind`, 'Connector endpoint kind must be node or point');
    }
    const nodeId = expectNonEmptyString(endpoint.nodeId, `${path}.nodeId`, 'invalid-connector', 'Attached connector endpoint requires a node ID');
    const target = nodes.get(nodeId)?.[0];
    if (!target) {
        throw new SceneValidationError('invalid-connector-reference', `${path}.nodeId`, `Connector endpoint references missing node ${nodeId}`);
    }
    if (endpoint.pointId === undefined)
        return;
    const pointId = expectNonEmptyString(endpoint.pointId, `${path}.pointId`, 'invalid-connector', 'Connector point ID must be a non-empty string');
    const snapPoints = target.components?.[SCENE_SNAP_POINTS_COMPONENT];
    if (!snapPoints?.data.points.some(point => point.id === pointId)) {
        throw new SceneValidationError('invalid-connector-reference', `${path}.pointId`, `Connector endpoint references missing snap point ${pointId} on node ${nodeId}`);
    }
}
function collectNodes(root) {
    const nodes = new Map();
    const visit = (node, path) => {
        nodes.set(node.id, [node, path]);
        if (node.kind === 'group') {
            node.children.forEach((child, index) => visit(child, `${path}.children[${index}]`));
        }
    };
    visit(root, '$.root');
    return nodes;
}
function validateNodeGraph(root, componentsAllowed) {
    const ids = new Set();
    const active = new Set();
    const visit = (nodeValue, path) => {
        const node = expectRecord(nodeValue, path, 'invalid-node', 'Scene node must be an object');
        if (active.has(node)) {
            throw new SceneValidationError('scene-cycle', path, 'Scene cycle detected');
        }
        active.add(node);
        const id = expectNonEmptyString(node.id, `${path}.id`, 'invalid-node', 'Scene node IDs must not be empty');
        if (ids.has(id)) {
            throw new SceneValidationError('duplicate-node-id', `${path}.id`, `Duplicate scene node ID ${id}`);
        }
        ids.add(id);
        validateNodeBase(node, path, componentsAllowed);
        switch (node.kind) {
            case 'group': {
                if (!Array.isArray(node.children)) {
                    throw new SceneValidationError('invalid-node', `${path}.children`, 'Group children must be an array');
                }
                for (const [index, child] of node.children.entries()) {
                    visit(child, `${path}.children[${index}]`);
                }
                break;
            }
            case 'rectangle':
                expectFinitePositive(node.width, `${path}.width`, 'Rectangle width must be positive');
                expectFinitePositive(node.height, `${path}.height`, 'Rectangle height must be positive');
                expectOptionalFiniteNonNegative(node.radius, `${path}.radius`, 'Rectangle radius must not be negative');
                validateOptionalPaint(node.fill, `${path}.fill`);
                validateOptionalStroke(node.stroke, `${path}.stroke`);
                break;
            case 'ellipse':
                expectFinitePositive(node.radiusX, `${path}.radiusX`, 'Ellipse radiusX must be positive');
                expectFinitePositive(node.radiusY, `${path}.radiusY`, 'Ellipse radiusY must be positive');
                validateOptionalPaint(node.fill, `${path}.fill`);
                validateOptionalStroke(node.stroke, `${path}.stroke`);
                break;
            case 'path':
                validatePathCommands(node.commands, `${path}.commands`);
                validateOptionalPaint(node.fill, `${path}.fill`);
                validateOptionalStroke(node.stroke, `${path}.stroke`);
                break;
            case 'text':
                if (typeof node.text !== 'string') {
                    throw new SceneValidationError('invalid-node', `${path}.text`, 'Text content must be a string');
                }
                expectFinitePositive(node.fontSize, `${path}.fontSize`, 'Text fontSize must be positive');
                if (node.fontFamily !== undefined && typeof node.fontFamily !== 'string') {
                    throw new SceneValidationError('invalid-node', `${path}.fontFamily`, 'Text fontFamily must be a string');
                }
                expectOptionalFinite(node.fontWeight, `${path}.fontWeight`, 'Text fontWeight must be finite');
                expectOptionalEnum(node.align, ['start', 'center', 'end'], `${path}.align`, 'Text align is invalid');
                expectOptionalEnum(node.baseline, ['top', 'middle', 'alphabetic', 'bottom'], `${path}.baseline`, 'Text baseline is invalid');
                validateOptionalPaint(node.fill, `${path}.fill`);
                validateOptionalStroke(node.stroke, `${path}.stroke`);
                break;
            default:
                throw new SceneValidationError('invalid-node', `${path}.kind`, `Unknown scene node kind ${String(node.kind)}`);
        }
        active.delete(node);
    };
    visit(root, '$.root');
    if (componentsAllowed)
        validateLayerAndCanvasStructure(root);
}
function validateLayerAndCanvasStructure(root) {
    if (root.kind !== 'group')
        return;
    const layers = [];
    const canvasLayers = [];
    const inspect = (node, path, depth, index = 0, insideLayer = false) => {
        const isLayer = Boolean(node.components?.[SCENE_LAYER_COMPONENT]);
        const hasCanvas = Boolean(node.components?.[SCENE_CANVAS_COMPONENT]);
        const isPrefab = Boolean(node.components?.[SCENE_PREFAB_COMPONENT]);
        if (isLayer) {
            if (node.kind !== 'group' || depth !== 1) {
                throw new SceneValidationError('invalid-standard-component', `${path}.components[${JSON.stringify(SCENE_LAYER_COMPONENT)}]`, 'Layers must be group nodes directly beneath the scene root');
            }
            layers.push({ node, path, index });
        }
        if (hasCanvas) {
            if (!isLayer || node.kind !== 'group' || depth !== 1) {
                throw new SceneValidationError('invalid-standard-component', `${path}.components[${JSON.stringify(SCENE_CANVAS_COMPONENT)}]`, 'Canvas components may only be attached to root-level layers');
            }
            canvasLayers.push({ node, path });
        }
        if (isPrefab && (node.kind !== 'group' || !insideLayer || isLayer)) {
            throw new SceneValidationError('invalid-standard-component', `${path}.components[${JSON.stringify(SCENE_PREFAB_COMPONENT)}]`, 'Prefabs must be group nodes inside a layer');
        }
        if (node.kind === 'group') {
            node.children.forEach((child, childIndex) => inspect(child, `${path}.children[${childIndex}]`, depth + 1, childIndex, insideLayer || isLayer));
        }
    };
    inspect(root, '$.root', 0);
    if (canvasLayers.length > 1) {
        throw new SceneValidationError('invalid-standard-component', `${canvasLayers[1].path}.components[${JSON.stringify(SCENE_CANVAS_COMPONENT)}]`, 'A scene may only define one canvas layer');
    }
    const canvasLayer = canvasLayers[0];
    if (!canvasLayer)
        return;
    const bottomLayer = [...layers].sort((a, b) => {
        const byZ = (a.node.zIndex ?? 0) - (b.node.zIndex ?? 0);
        return byZ || a.index - b.index;
    })[0];
    if (bottomLayer?.node !== canvasLayer.node) {
        throw new SceneValidationError('invalid-standard-component', `${canvasLayer.path}.components[${JSON.stringify(SCENE_CANVAS_COMPONENT)}]`, 'The canvas component must be attached to the bottom paint layer');
    }
    const component = canvasLayer.node.components?.[SCENE_CANVAS_COMPONENT];
    if (component.data.mode !== 'masked')
        return;
    const mask = findDescendant(canvasLayer.node, component.data.maskNodeId);
    if (!mask || mask.kind === 'group' || mask.kind === 'text') {
        throw new SceneValidationError('invalid-standard-component', `${canvasLayer.path}.components[${JSON.stringify(SCENE_CANVAS_COMPONENT)}].data.maskNodeId`, 'Canvas mask must reference a rectangle, ellipse, or path within its layer');
    }
}
function findDescendant(root, id) {
    for (const child of root.children) {
        if (child.id === id)
            return child;
        if (child.kind === 'group') {
            const found = findDescendant(child, id);
            if (found)
                return found;
        }
    }
    return undefined;
}
function validateNodeBase(node, path, componentsAllowed) {
    expectOptionalFinite(node.zIndex, `${path}.zIndex`, 'Scene node zIndex must be finite');
    expectOptionalFinite(node.opacity, `${path}.opacity`, 'Scene node opacity must be finite');
    expectOptionalBoolean(node.visible, `${path}.visible`, 'invalid-node', 'Scene node visible must be a boolean');
    if (node.clipId !== undefined) {
        expectNonEmptyString(node.clipId, `${path}.clipId`, 'invalid-node', 'Scene node clipId must not be empty');
    }
    if (node.transform !== undefined)
        validateTransform(node.transform, `${path}.transform`);
    if (node.metadata !== undefined)
        validateMetadata(node.metadata, `${path}.metadata`);
    if (node.components !== undefined) {
        if (!componentsAllowed) {
            throw new SceneValidationError('invalid-node', `${path}.components`, 'Version-one scene nodes cannot contain components');
        }
        validateSceneComponentMap(node.components, `${path}.components`);
        const components = node.components;
        if (components[SCENE_LAYER_COMPONENT] && node.kind !== 'group') {
            throw new SceneValidationError('invalid-standard-component', `${path}.components[${JSON.stringify(SCENE_LAYER_COMPONENT)}]`, 'Layer components may only be attached to group nodes');
        }
    }
}
function validateTransform(value, path) {
    const transform = expectRecord(value, path, 'invalid-node', 'Transform must be an object');
    expectFinite(transform.x, `${path}.x`, 'invalid-node', 'Transform x must be finite');
    expectFinite(transform.y, `${path}.y`, 'invalid-node', 'Transform y must be finite');
    expectFinite(transform.rotation, `${path}.rotation`, 'invalid-node', 'Transform rotation must be finite');
    expectOptionalFinite(transform.scaleX, `${path}.scaleX`, 'Transform scaleX must be finite');
    expectOptionalFinite(transform.scaleY, `${path}.scaleY`, 'Transform scaleY must be finite');
}
function validateMetadata(value, path) {
    const metadata = expectRecord(value, path, 'invalid-node', 'Metadata must be an object');
    for (const [key, entry] of Object.entries(metadata)) {
        if (typeof entry !== 'string' && typeof entry !== 'boolean' && typeof entry !== 'number') {
            throw new SceneValidationError('invalid-node', `${path}.${key}`, 'Metadata values must be scalar');
        }
        if (typeof entry === 'number' && !Number.isFinite(entry)) {
            throw new SceneValidationError('invalid-node', `${path}.${key}`, 'Metadata numbers must be finite');
        }
    }
}
function validateOptionalPaint(value, path) {
    if (value === undefined)
        return;
    const paint = expectRecord(value, path, 'invalid-node', 'Paint must be an object');
    expectNonEmptyString(paint.color, `${path}.color`, 'invalid-node', 'Paint color must not be empty');
    expectOptionalFinite(paint.opacity, `${path}.opacity`, 'Paint opacity must be finite');
}
function validateOptionalStroke(value, path) {
    if (value === undefined)
        return;
    const stroke = expectRecord(value, path, 'invalid-node', 'Stroke must be an object');
    expectNonEmptyString(stroke.color, `${path}.color`, 'invalid-node', 'Stroke color must not be empty');
    expectFiniteNonNegative(stroke.width, `${path}.width`, 'Stroke width must not be negative');
    expectOptionalFinite(stroke.opacity, `${path}.opacity`, 'Stroke opacity must be finite');
    expectOptionalEnum(stroke.lineCap, ['butt', 'round', 'square'], `${path}.lineCap`, 'Stroke lineCap is invalid');
    expectOptionalEnum(stroke.lineJoin, ['bevel', 'miter', 'round'], `${path}.lineJoin`, 'Stroke lineJoin is invalid');
}
function validatePathCommands(value, path) {
    if (!Array.isArray(value)) {
        throw new SceneValidationError('invalid-node', path, 'Path commands must be an array');
    }
    for (const [index, commandValue] of value.entries()) {
        const commandPath = `${path}[${index}]`;
        const command = expectRecord(commandValue, commandPath, 'invalid-node', 'Path command must be an object');
        switch (command.command) {
            case 'move':
            case 'line':
                expectFinite(command.x, `${commandPath}.x`, 'invalid-node', 'Path x must be finite');
                expectFinite(command.y, `${commandPath}.y`, 'invalid-node', 'Path y must be finite');
                break;
            case 'quadratic':
                expectFinite(command.controlX, `${commandPath}.controlX`, 'invalid-node', 'Path controlX must be finite');
                expectFinite(command.controlY, `${commandPath}.controlY`, 'invalid-node', 'Path controlY must be finite');
                expectFinite(command.x, `${commandPath}.x`, 'invalid-node', 'Path x must be finite');
                expectFinite(command.y, `${commandPath}.y`, 'invalid-node', 'Path y must be finite');
                break;
            case 'cubic':
                expectFinite(command.control1X, `${commandPath}.control1X`, 'invalid-node', 'Path control1X must be finite');
                expectFinite(command.control1Y, `${commandPath}.control1Y`, 'invalid-node', 'Path control1Y must be finite');
                expectFinite(command.control2X, `${commandPath}.control2X`, 'invalid-node', 'Path control2X must be finite');
                expectFinite(command.control2Y, `${commandPath}.control2Y`, 'invalid-node', 'Path control2Y must be finite');
                expectFinite(command.x, `${commandPath}.x`, 'invalid-node', 'Path x must be finite');
                expectFinite(command.y, `${commandPath}.y`, 'invalid-node', 'Path y must be finite');
                break;
            case 'close':
                break;
            default:
                throw new SceneValidationError('invalid-node', `${commandPath}.command`, `Unknown path command ${String(command.command)}`);
        }
    }
}
function validateComponent(value, path) {
    const component = expectRecord(value, path, 'invalid-component', 'Scene component must be an object');
    if (!Number.isInteger(component.version) || component.version < 1) {
        throw new SceneValidationError('invalid-component', `${path}.version`, 'Component version must be a positive integer');
    }
    if (!('data' in component)) {
        throw new SceneValidationError('invalid-component', `${path}.data`, 'Component data is required');
    }
    validateJsonValue(component.data, `${path}.data`);
    return component;
}
function expectStandardVersion(component, path) {
    if (component.version !== 1) {
        throw new SceneValidationError('invalid-standard-component', `${path}.version`, `Unsupported standard component version ${String(component.version)}`);
    }
}
function rejectNodeStandardComponents(components, path) {
    for (const id of [SCENE_CANVAS_COMPONENT, SCENE_CONNECTOR_VIEW_COMPONENT, SCENE_LAYER_COMPONENT, SCENE_PREFAB_COMPONENT, SCENE_SNAP_POINTS_COMPONENT]) {
        if (components[id]) {
            throw new SceneValidationError('invalid-standard-component', `${path}[${JSON.stringify(id)}]`, `${id} may only be attached to scene nodes`);
        }
    }
}
function rejectSceneNodeComponents(components, path) {
    for (const id of [SCENE_CANVAS_COMPONENT, SCENE_CONNECTOR_VIEW_COMPONENT, SCENE_LAYER_COMPONENT, SCENE_PREFAB_COMPONENT, SCENE_SNAP_POINTS_COMPONENT]) {
        if (components[id]) {
            throw new SceneValidationError('invalid-standard-component', `${path}[${JSON.stringify(id)}]`, `${id} may only be attached to scene nodes`);
        }
    }
}
function validateJson(value, path, active) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean')
        return;
    if (typeof value === 'number') {
        if (Number.isFinite(value))
            return;
        throw new SceneValidationError('invalid-json', path, 'JSON numbers must be finite');
    }
    if (typeof value !== 'object') {
        throw new SceneValidationError('invalid-json', path, `Value of type ${typeof value} is not JSON`);
    }
    if (active.has(value)) {
        throw new SceneValidationError('invalid-json', path, 'JSON data must not contain cycles');
    }
    active.add(value);
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
            if (!(index in value)) {
                throw new SceneValidationError('invalid-json', `${path}[${index}]`, 'JSON arrays must not be sparse');
            }
            validateJson(value[index], `${path}[${index}]`, active);
        }
    }
    else {
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
            throw new SceneValidationError('invalid-json', path, 'JSON objects must be plain objects');
        }
        if (Object.getOwnPropertySymbols(value).length) {
            throw new SceneValidationError('invalid-json', path, 'JSON objects must not contain symbol keys');
        }
        for (const [key, entry] of Object.entries(value)) {
            validateJson(entry, `${path}[${JSON.stringify(key)}]`, active);
        }
    }
    active.delete(value);
}
function expectRecord(value, path, code, message) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new SceneValidationError(code, path, message);
    }
    return value;
}
function expectNonEmptyString(value, path, code, message) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new SceneValidationError(code, path, message);
    }
    return value;
}
function expectFinite(value, path, code, message) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new SceneValidationError(code, path, message);
    }
}
function expectFinitePositive(value, path, message) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new SceneValidationError('invalid-scene', path, message);
    }
}
function expectFiniteNonNegative(value, path, message) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new SceneValidationError('invalid-node', path, message);
    }
}
function expectOptionalFinite(value, path, message) {
    if (value !== undefined)
        expectFinite(value, path, 'invalid-node', message);
}
function expectOptionalFiniteNonNegative(value, path, message) {
    if (value !== undefined)
        expectFiniteNonNegative(value, path, message);
}
function expectOptionalBoolean(value, path, code, message) {
    if (value !== undefined && typeof value !== 'boolean') {
        throw new SceneValidationError(code, path, message);
    }
}
function expectOptionalEnum(value, options, path, message) {
    if (value !== undefined && (typeof value !== 'string' || !options.includes(value))) {
        throw new SceneValidationError('invalid-node', path, message);
    }
}

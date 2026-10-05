// frontend/vendor/shipkit/cardScene.ts
var SHIPKIT_CARD_COMPONENT = "@versytl/shipkit/card";
var defaultTheme = {
  surface: "#fffdfa",
  border: "#d8d1c5",
  selectedBorder: "#6755d9",
  title: "#27262d",
  eyebrow: "#77727c",
  menu: "#77727c"
};
var internalZ = {
  shadow: 0,
  surface: 10,
  header: 20,
  content: 30,
  accessory: 40,
  station: 50
};
var defaultHeader = {
  eyebrowY: 20,
  eyebrowFontSize: 9,
  eyebrowFontWeight: 800,
  titleY: 43,
  titleFontSize: 15,
  titleFontWeight: 720,
  accessoryY: 20,
  menuY: 28
};
function createCardNode(options) {
  const theme = { ...defaultTheme, ...options.theme };
  const padding = options.padding ?? 18;
  const radius = options.radius ?? 13;
  const header = { ...defaultHeader, ...options.header };
  const titleY = options.eyebrow ? header.titleY : 28;
  const children = [];
  if (options.shadow !== false) {
    const shadow = options.shadow ?? {};
    children.push(rectangle(
      `${options.id}:shadow`,
      options.bounds.width,
      options.bounds.height,
      options.bounds.width / 2 + (shadow.x ?? 3),
      options.bounds.height / 2 + (shadow.y ?? 5),
      shadow.color ?? "#27262d",
      radius,
      void 0,
      0,
      shadow.opacity ?? 0.11,
      internalZ.shadow
    ));
  }
  children.push(rectangle(
    `${options.id}:surface`,
    options.bounds.width,
    options.bounds.height,
    options.bounds.width / 2,
    options.bounds.height / 2,
    theme.surface,
    radius,
    options.selected ? theme.selectedBorder ?? theme.border : theme.border,
    options.selected ? 2 : 1,
    1,
    internalZ.surface
  ));
  if (options.eyebrow) {
    children.push(text(
      `${options.id}:eyebrow`,
      options.eyebrow.toUpperCase(),
      padding,
      header.eyebrowY,
      header.eyebrowFontSize,
      theme.eyebrow,
      header.eyebrowFontWeight,
      "start",
      internalZ.header
    ));
  }
  if (options.title) {
    children.push(text(
      `${options.id}:title`,
      options.title,
      padding,
      titleY,
      header.titleFontSize,
      theme.title,
      header.titleFontWeight,
      "start",
      internalZ.header
    ));
  }
  if (options.children.length) {
    children.push({
      id: `${options.id}:content-layer`,
      kind: "group",
      zIndex: internalZ.content,
      children: options.children
    });
  }
  if (options.badge) {
    const width = options.badge.width ?? 50;
    const x = options.bounds.width - padding - width / 2;
    children.push(
      rectangle(`${options.id}:badge`, width, 18, x, header.accessoryY, options.badge.fill, 9, void 0, 0, 1, internalZ.accessory),
      text(`${options.id}:badge-label`, options.badge.label, x, header.accessoryY, 7.5, options.badge.color, 820, "center", internalZ.accessory)
    );
  }
  if (options.menuLabel) {
    children.push(text(
      `${options.id}:menu`,
      options.menuLabel,
      options.bounds.width - padding,
      header.menuY,
      11,
      theme.menu,
      600,
      "end",
      internalZ.accessory
    ));
  }
  if (options.station) {
    const edge = options.station.edge ?? "bottom";
    const point = stationPoint(edge, options.bounds.width, options.bounds.height);
    children.push(ellipse(
      `${options.id}:station`,
      point.x,
      point.y,
      options.station.radius ?? 8,
      options.station.fill ?? theme.surface,
      options.station.color,
      options.station.strokeWidth ?? 4,
      internalZ.station
    ));
  }
  return {
    id: options.id,
    kind: "group",
    transform: { x: options.bounds.x, y: options.bounds.y, rotation: 0 },
    zIndex: options.zIndex,
    metadata: options.metadata,
    components: {
      ...options.components,
      [SHIPKIT_CARD_COMPONENT]: {
        version: 1,
        data: {
          ...options.title ? { title: options.title } : {},
          ...options.eyebrow ? { eyebrow: options.eyebrow } : {},
          selected: options.selected ?? false,
          ...options.station ? { stationEdge: options.station.edge ?? "bottom" } : {}
        }
      }
    },
    children
  };
}
function stationPoint(edge, width, height) {
  if (edge === "top") return { x: width / 2, y: 0 };
  if (edge === "right") return { x: width, y: height / 2 };
  if (edge === "left") return { x: 0, y: height / 2 };
  return { x: width / 2, y: height };
}
function ellipse(id, x, y, radius, fill, stroke, strokeWidth, zIndex) {
  return {
    id,
    kind: "ellipse",
    radiusX: radius,
    radiusY: radius,
    transform: { x, y, rotation: 0 },
    fill: { color: fill },
    stroke: { color: stroke, width: strokeWidth },
    zIndex
  };
}
function rectangle(id, width, height, x, y, fill, radius, stroke, strokeWidth = 0, opacity = 1, zIndex = 0) {
  return {
    id,
    kind: "rectangle",
    width,
    height,
    radius,
    transform: { x, y, rotation: 0 },
    fill: { color: fill, opacity },
    stroke: stroke ? { color: stroke, width: strokeWidth } : void 0,
    zIndex
  };
}
function text(id, value, x, y, fontSize, fill, fontWeight, align, zIndex) {
  return {
    id,
    kind: "text",
    text: value,
    fontSize,
    fontWeight,
    align,
    baseline: "middle",
    transform: { x, y, rotation: 0 },
    fill: { color: fill },
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    zIndex
  };
}

// frontend/vendor/shipkit/dashboardScene.ts
var colors = {
  card: "#0d1d27",
  cardEdge: "#1d3543",
  inset: "#0a161e",
  grid: "#263b47",
  text: "#f1f6f7",
  muted: "#78909d",
  dim: "#506875"
};
function createDashboardCardNode(options) {
  return createCardNode({
    ...options,
    radius: 16,
    padding: 22,
    shadow: false,
    menuLabel: "\u2022\u2022\u2022",
    header: {
      eyebrowY: 23,
      eyebrowFontWeight: 600,
      titleY: 46,
      titleFontSize: 14,
      titleFontWeight: 600
    },
    theme: {
      surface: colors.card,
      border: colors.cardEdge,
      title: "#dce7eb",
      eyebrow: colors.muted,
      menu: colors.dim
    },
    components: {
      "@versytl/shipkit/dashboard-widget": {
        version: 1,
        data: { title: options.title, eyebrow: options.eyebrow }
      }
    }
  });
}
function createTrendChartNode(options) {
  const points = options.values.map((item, index) => ({
    ...item,
    x: 38 + index / Math.max(1, options.values.length - 1) * 484,
    y: 172 - (item.value - options.min) / (options.max - options.min) * 126
  }));
  const nodes = [];
  for (let index = 0; index < 4; index += 1) {
    const y = 46 + index * 42;
    const value = options.max - index * (options.max - options.min) / 3;
    nodes.push(
      path(`${options.id}:grid:${index}`, lineCommands(38, y, 522, y), void 0, colors.grid, 1),
      text2(`${options.id}:axis:${index}`, formatValue(value), 28, y + 3, 9, colors.muted, 400, "end")
    );
  }
  if (points.length) {
    nodes.push(path(`${options.id}:line`, points.map((point, index) => ({ command: index ? "line" : "move", x: point.x, y: point.y })), void 0, options.accent, 3));
  }
  for (const [index, point] of points.entries()) {
    nodes.push(ellipse2(`${options.id}:point:${index}`, 3.5, 3.5, point.x, point.y, colors.inset, options.accent, 2));
    if (index % 2 === 0) nodes.push(text2(`${options.id}:label:${index}`, point.label, point.x, 204, 9, colors.muted, 400, "center"));
  }
  const latest = points.at(-1)?.value ?? 0;
  nodes.push(text2(`${options.id}:latest`, `${formatValue(latest)} ${options.unit}`, 516, 30, 18, colors.text, 700, "end"));
  return createDashboardCardNode({ ...options, children: [fit(`${options.id}:content`, options.bounds, 560, 220, nodes)] });
}
function fit(id, bounds, width, height, children) {
  const availableHeight = Math.max(1, bounds.height - 62);
  const scale = Math.min((bounds.width - 20) / width, (availableHeight - 8) / height);
  return {
    id,
    kind: "group",
    transform: {
      x: (bounds.width - width * scale) / 2,
      y: 58 + (availableHeight - height * scale) / 2,
      rotation: 0,
      scaleX: scale,
      scaleY: scale
    },
    children
  };
}
function ellipse2(id, radiusX, radiusY, x, y, fill, stroke, strokeWidth = 0) {
  return { id, kind: "ellipse", radiusX, radiusY, transform: { x, y, rotation: 0 }, fill: { color: fill }, stroke: stroke ? { color: stroke, width: strokeWidth } : void 0 };
}
function text2(id, value, x, y, fontSize, fill, fontWeight = 400, align = "start", baseline = "alphabetic") {
  return { id, kind: "text", text: value, fontSize, fontWeight, align, baseline, transform: { x, y, rotation: 0 }, fill: { color: fill }, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" };
}
function path(id, commands, fill, stroke, strokeWidth = 0) {
  return { id, kind: "path", commands, fill, stroke: stroke ? { color: stroke, width: strokeWidth, lineCap: "round", lineJoin: "round" } : void 0 };
}
function lineCommands(x1, y1, x2, y2) {
  return [{ command: "move", x: x1, y: y1 }, { command: "line", x: x2, y: y2 }];
}
function formatValue(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// frontend/vendor/shipkit/progressScene.ts
var SHIPKIT_PROGRESS_BAR_COMPONENT = "@versytl/shipkit/progress-bar";
function rectangle2(id, width, height, x, y, fill, radius, strokeColor) {
  return {
    id,
    kind: "rectangle",
    width,
    height,
    radius,
    fill: { color: fill },
    ...strokeColor ? { stroke: { color: strokeColor, width: 1 } } : {},
    transform: { x, y, rotation: 0 }
  };
}
function createProgressBarNode(options) {
  const value = Math.min(1, Math.max(0, options.value));
  const radius = options.radius ?? options.bounds.height / 2;
  const fillWidth = options.bounds.width * value;
  const children = [rectangle2(
    `${options.id}:track`,
    options.bounds.width,
    options.bounds.height,
    options.bounds.width / 2,
    options.bounds.height / 2,
    options.trackColor ?? "#ebe7e0",
    radius,
    options.borderColor
  )];
  if (fillWidth > 0) {
    children.push(rectangle2(
      `${options.id}:fill`,
      fillWidth,
      options.bounds.height,
      fillWidth / 2,
      options.bounds.height / 2,
      options.fillColor ?? "#6755d9",
      Math.min(radius, fillWidth / 2)
    ));
  }
  return {
    id: options.id,
    kind: "group",
    transform: { x: options.bounds.x, y: options.bounds.y, rotation: 0 },
    zIndex: options.zIndex,
    metadata: options.metadata,
    components: {
      ...options.components,
      [SHIPKIT_PROGRESS_BAR_COMPONENT]: {
        version: 1,
        data: { value }
      }
    },
    children
  };
}

// frontend/vendor/scene/types.ts
var SCENE_VERSION = 2;
var SCENE_LAYER_COMPONENT = "@versytl/scene/layer";
var SCENE_CANVAS_COMPONENT = "@versytl/scene/canvas";
var SCENE_SNAP_POINTS_COMPONENT = "@versytl/scene/snap-points";
var SCENE_PREFAB_COMPONENT = "@versytl/scene/prefab";
var SCENE_CONNECTOR_VIEW_COMPONENT = "@versytl/scene/connector-view";

// frontend/vendor/scene/validation.ts
var COMPONENT_ID_PATTERN = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)+$/;
var SceneValidationError = class extends Error {
  code;
  path;
  constructor(code, path2, message) {
    super(`${message} at ${path2}`);
    this.name = "SceneValidationError";
    this.code = code;
    this.path = path2;
  }
};
function isSceneComponentId(value) {
  return COMPONENT_ID_PATTERN.test(value);
}
function validateScene(value) {
  const scene = expectRecord(value, "$", "invalid-scene", "Scene must be an object");
  if (scene.version !== SCENE_VERSION) {
    throw new SceneValidationError(
      "unsupported-version",
      "$.version",
      `Expected scene version ${SCENE_VERSION}, received ${String(scene.version)}`
    );
  }
  validateSceneBody(scene, true);
}
function validateSceneComponentMap(components, path2 = "$.components") {
  const map = expectRecord(
    components,
    path2,
    "invalid-component",
    "Scene components must be an object"
  );
  for (const [id, component] of Object.entries(map)) {
    const componentPath = `${path2}[${JSON.stringify(id)}]`;
    if (!isSceneComponentId(id)) {
      throw new SceneValidationError(
        "invalid-component-id",
        componentPath,
        `Invalid scene component ID ${JSON.stringify(id)}`
      );
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
function validateSceneConnectorViewComponent(value, path2 = "$") {
  const component = validateComponent(value, path2);
  expectStandardVersion(component, path2);
  const data = expectRecord(
    component.data,
    `${path2}.data`,
    "invalid-standard-component",
    "Connector-view component data must be an object"
  );
  expectNonEmptyString(
    data.connectorId,
    `${path2}.data.connectorId`,
    "invalid-standard-component",
    "Connector-view connector ID must be a non-empty string"
  );
  if (data.role !== void 0) {
    expectNonEmptyString(
      data.role,
      `${path2}.data.role`,
      "invalid-standard-component",
      "Connector-view role must be a non-empty string"
    );
  }
}
function validateScenePrefabComponent(value, path2 = "$") {
  const component = validateComponent(value, path2);
  expectStandardVersion(component, path2);
  const data = expectRecord(
    component.data,
    `${path2}.data`,
    "invalid-standard-component",
    "Prefab component data must be an object"
  );
  const id = expectNonEmptyString(
    data.id,
    `${path2}.data.id`,
    "invalid-standard-component",
    "Prefab ID must be a non-empty string"
  );
  if (!isSceneComponentId(id)) {
    throw new SceneValidationError(
      "invalid-standard-component",
      `${path2}.data.id`,
      "Prefab ID must be an npm-style namespaced ID"
    );
  }
  expectNonEmptyString(
    data.name,
    `${path2}.data.name`,
    "invalid-standard-component",
    "Prefab name must be a non-empty string"
  );
}
function validateSceneCanvasComponent(value, path2 = "$") {
  const component = validateComponent(value, path2);
  expectStandardVersion(component, path2);
  const data = expectRecord(
    component.data,
    `${path2}.data`,
    "invalid-standard-component",
    "Canvas component data must be an object"
  );
  expectOptionalEnum(
    data.mode,
    ["infinite", "masked"],
    `${path2}.data.mode`,
    "Canvas mode is invalid"
  );
  if (data.mode === void 0) {
    throw new SceneValidationError(
      "invalid-standard-component",
      `${path2}.data.mode`,
      "Canvas mode is required"
    );
  }
  if (data.mode === "masked") {
    expectNonEmptyString(
      data.maskNodeId,
      `${path2}.data.maskNodeId`,
      "invalid-standard-component",
      "A masked canvas requires a mask node ID"
    );
  } else if (data.maskNodeId !== void 0) {
    throw new SceneValidationError(
      "invalid-standard-component",
      `${path2}.data.maskNodeId`,
      "An infinite canvas cannot define a mask node"
    );
  }
}
function validateSceneLayerComponent(value, path2 = "$") {
  const component = validateComponent(value, path2);
  expectStandardVersion(component, path2);
  const data = expectRecord(
    component.data,
    `${path2}.data`,
    "invalid-standard-component",
    "Layer component data must be an object"
  );
  expectNonEmptyString(
    data.name,
    `${path2}.data.name`,
    "invalid-standard-component",
    "Layer name must be a non-empty string"
  );
  expectOptionalBoolean(
    data.locked,
    `${path2}.data.locked`,
    "invalid-standard-component",
    "Layer locked must be a boolean"
  );
}
function validateSceneSnapPointsComponent(value, path2 = "$") {
  const component = validateComponent(value, path2);
  expectStandardVersion(component, path2);
  const data = expectRecord(
    component.data,
    `${path2}.data`,
    "invalid-standard-component",
    "Snap-points component data must be an object"
  );
  if (!Array.isArray(data.points)) {
    throw new SceneValidationError(
      "invalid-standard-component",
      `${path2}.data.points`,
      "Snap points must be an array"
    );
  }
  const ids = /* @__PURE__ */ new Set();
  for (const [index, pointValue] of data.points.entries()) {
    const pointPath = `${path2}.data.points[${index}]`;
    const point = expectRecord(
      pointValue,
      pointPath,
      "invalid-standard-component",
      "Snap point must be an object"
    );
    const id = expectNonEmptyString(
      point.id,
      `${pointPath}.id`,
      "invalid-standard-component",
      "Snap-point ID must be a non-empty string"
    );
    if (ids.has(id)) {
      throw new SceneValidationError(
        "invalid-standard-component",
        `${pointPath}.id`,
        `Duplicate snap-point ID ${id}`
      );
    }
    ids.add(id);
    expectFinite(point.x, `${pointPath}.x`, "invalid-standard-component", "Snap-point x must be finite");
    expectFinite(point.y, `${pointPath}.y`, "invalid-standard-component", "Snap-point y must be finite");
    if (point.role !== void 0) {
      expectNonEmptyString(
        point.role,
        `${pointPath}.role`,
        "invalid-standard-component",
        "Snap-point role must be a non-empty string"
      );
    }
    if (point.normal !== void 0) {
      const normal = expectRecord(
        point.normal,
        `${pointPath}.normal`,
        "invalid-standard-component",
        "Snap-point normal must be an object"
      );
      expectFinite(normal.x, `${pointPath}.normal.x`, "invalid-standard-component", "Normal x must be finite");
      expectFinite(normal.y, `${pointPath}.normal.y`, "invalid-standard-component", "Normal y must be finite");
    }
  }
}
function validateJsonValue(value, path2 = "$") {
  validateJson(value, path2, /* @__PURE__ */ new Set());
}
function validateSceneBody(scene, componentsAllowed) {
  expectFinitePositive(scene.width, "$.width", "Scene width must be a finite positive number");
  expectFinitePositive(scene.height, "$.height", "Scene height must be a finite positive number");
  if (scene.components !== void 0) {
    if (!componentsAllowed) {
      throw new SceneValidationError(
        "invalid-scene",
        "$.components",
        "Components are not supported by this scene version"
      );
    }
    validateSceneComponentMap(scene.components);
    rejectNodeStandardComponents(scene.components, "$.components");
  }
  if (!componentsAllowed && scene.connectors !== void 0) {
    throw new SceneValidationError(
      "invalid-scene",
      "$.connectors",
      "Connectors are not supported by this scene version"
    );
  }
  const root = expectRecord(scene.root, "$.root", "invalid-node", "Scene root must be a group node");
  if (root.kind !== "group") {
    throw new SceneValidationError("invalid-node", "$.root.kind", "Scene root must be a group node");
  }
  validateNodeGraph(root, componentsAllowed);
  if (componentsAllowed) validateConnectorGraph(scene.connectors, root);
}
function validateConnectorGraph(value, root) {
  if (value !== void 0 && !Array.isArray(value)) {
    throw new SceneValidationError("invalid-connector", "$.connectors", "Scene connectors must be an array");
  }
  const connectors = value ?? [];
  const nodes = collectNodes(root);
  const connectorIds = /* @__PURE__ */ new Set();
  connectors.forEach((connectorValue, index) => {
    const path2 = `$.connectors[${index}]`;
    const connector = expectRecord(
      connectorValue,
      path2,
      "invalid-connector",
      "Scene connector must be an object"
    );
    const id = expectNonEmptyString(
      connector.id,
      `${path2}.id`,
      "invalid-connector",
      "Scene connector IDs must not be empty"
    );
    if (connectorIds.has(id)) {
      throw new SceneValidationError(
        "duplicate-connector-id",
        `${path2}.id`,
        `Duplicate scene connector ID ${id}`
      );
    }
    connectorIds.add(id);
    validateConnectorEndpoint(connector.start, `${path2}.start`, nodes);
    validateConnectorEndpoint(connector.end, `${path2}.end`, nodes);
    if (connector.components !== void 0) {
      validateSceneComponentMap(connector.components, `${path2}.components`);
      rejectSceneNodeComponents(connector.components, `${path2}.components`);
    }
  });
  for (const [node, path2] of nodes.values()) {
    const view = node.components?.[SCENE_CONNECTOR_VIEW_COMPONENT];
    if (view && !connectorIds.has(view.data.connectorId)) {
      throw new SceneValidationError(
        "invalid-connector-reference",
        `${path2}.components[${JSON.stringify(SCENE_CONNECTOR_VIEW_COMPONENT)}].data.connectorId`,
        `Connector view references missing connector ${view.data.connectorId}`
      );
    }
  }
}
function validateConnectorEndpoint(value, path2, nodes) {
  const endpoint = expectRecord(value, path2, "invalid-connector", "Connector endpoint must be an object");
  if (endpoint.kind === "point") {
    expectFinite(endpoint.x, `${path2}.x`, "invalid-connector", "Connector point x must be finite");
    expectFinite(endpoint.y, `${path2}.y`, "invalid-connector", "Connector point y must be finite");
    return;
  }
  if (endpoint.kind !== "node") {
    throw new SceneValidationError("invalid-connector", `${path2}.kind`, "Connector endpoint kind must be node or point");
  }
  const nodeId = expectNonEmptyString(
    endpoint.nodeId,
    `${path2}.nodeId`,
    "invalid-connector",
    "Attached connector endpoint requires a node ID"
  );
  const target = nodes.get(nodeId)?.[0];
  if (!target) {
    throw new SceneValidationError(
      "invalid-connector-reference",
      `${path2}.nodeId`,
      `Connector endpoint references missing node ${nodeId}`
    );
  }
  if (endpoint.pointId === void 0) return;
  const pointId = expectNonEmptyString(
    endpoint.pointId,
    `${path2}.pointId`,
    "invalid-connector",
    "Connector point ID must be a non-empty string"
  );
  const snapPoints = target.components?.[SCENE_SNAP_POINTS_COMPONENT];
  if (!snapPoints?.data.points.some((point) => point.id === pointId)) {
    throw new SceneValidationError(
      "invalid-connector-reference",
      `${path2}.pointId`,
      `Connector endpoint references missing snap point ${pointId} on node ${nodeId}`
    );
  }
}
function collectNodes(root) {
  const nodes = /* @__PURE__ */ new Map();
  const visit = (node, path2) => {
    nodes.set(node.id, [node, path2]);
    if (node.kind === "group") {
      node.children.forEach((child, index) => visit(child, `${path2}.children[${index}]`));
    }
  };
  visit(root, "$.root");
  return nodes;
}
function validateNodeGraph(root, componentsAllowed) {
  const ids = /* @__PURE__ */ new Set();
  const active = /* @__PURE__ */ new Set();
  const visit = (nodeValue, path2) => {
    const node = expectRecord(nodeValue, path2, "invalid-node", "Scene node must be an object");
    if (active.has(node)) {
      throw new SceneValidationError("scene-cycle", path2, "Scene cycle detected");
    }
    active.add(node);
    const id = expectNonEmptyString(
      node.id,
      `${path2}.id`,
      "invalid-node",
      "Scene node IDs must not be empty"
    );
    if (ids.has(id)) {
      throw new SceneValidationError("duplicate-node-id", `${path2}.id`, `Duplicate scene node ID ${id}`);
    }
    ids.add(id);
    validateNodeBase(node, path2, componentsAllowed);
    switch (node.kind) {
      case "group": {
        if (!Array.isArray(node.children)) {
          throw new SceneValidationError("invalid-node", `${path2}.children`, "Group children must be an array");
        }
        for (const [index, child] of node.children.entries()) {
          visit(child, `${path2}.children[${index}]`);
        }
        break;
      }
      case "rectangle":
        expectFinitePositive(node.width, `${path2}.width`, "Rectangle width must be positive");
        expectFinitePositive(node.height, `${path2}.height`, "Rectangle height must be positive");
        expectOptionalFiniteNonNegative(node.radius, `${path2}.radius`, "Rectangle radius must not be negative");
        validateOptionalPaint(node.fill, `${path2}.fill`);
        validateOptionalStroke(node.stroke, `${path2}.stroke`);
        break;
      case "ellipse":
        expectFinitePositive(node.radiusX, `${path2}.radiusX`, "Ellipse radiusX must be positive");
        expectFinitePositive(node.radiusY, `${path2}.radiusY`, "Ellipse radiusY must be positive");
        validateOptionalPaint(node.fill, `${path2}.fill`);
        validateOptionalStroke(node.stroke, `${path2}.stroke`);
        break;
      case "path":
        validatePathCommands(node.commands, `${path2}.commands`);
        validateOptionalPaint(node.fill, `${path2}.fill`);
        validateOptionalStroke(node.stroke, `${path2}.stroke`);
        break;
      case "text":
        if (typeof node.text !== "string") {
          throw new SceneValidationError("invalid-node", `${path2}.text`, "Text content must be a string");
        }
        expectFinitePositive(node.fontSize, `${path2}.fontSize`, "Text fontSize must be positive");
        if (node.fontFamily !== void 0 && typeof node.fontFamily !== "string") {
          throw new SceneValidationError("invalid-node", `${path2}.fontFamily`, "Text fontFamily must be a string");
        }
        expectOptionalFinite(node.fontWeight, `${path2}.fontWeight`, "Text fontWeight must be finite");
        expectOptionalEnum(node.align, ["start", "center", "end"], `${path2}.align`, "Text align is invalid");
        expectOptionalEnum(
          node.baseline,
          ["top", "middle", "alphabetic", "bottom"],
          `${path2}.baseline`,
          "Text baseline is invalid"
        );
        validateOptionalPaint(node.fill, `${path2}.fill`);
        validateOptionalStroke(node.stroke, `${path2}.stroke`);
        break;
      default:
        throw new SceneValidationError("invalid-node", `${path2}.kind`, `Unknown scene node kind ${String(node.kind)}`);
    }
    active.delete(node);
  };
  visit(root, "$.root");
  if (componentsAllowed) validateLayerAndCanvasStructure(root);
}
function validateLayerAndCanvasStructure(root) {
  if (root.kind !== "group") return;
  const layers = [];
  const canvasLayers = [];
  const inspect = (node, path2, depth, index = 0, insideLayer = false) => {
    const isLayer = Boolean(node.components?.[SCENE_LAYER_COMPONENT]);
    const hasCanvas = Boolean(node.components?.[SCENE_CANVAS_COMPONENT]);
    const isPrefab = Boolean(node.components?.[SCENE_PREFAB_COMPONENT]);
    if (isLayer) {
      if (node.kind !== "group" || depth !== 1) {
        throw new SceneValidationError(
          "invalid-standard-component",
          `${path2}.components[${JSON.stringify(SCENE_LAYER_COMPONENT)}]`,
          "Layers must be group nodes directly beneath the scene root"
        );
      }
      layers.push({ node, path: path2, index });
    }
    if (hasCanvas) {
      if (!isLayer || node.kind !== "group" || depth !== 1) {
        throw new SceneValidationError(
          "invalid-standard-component",
          `${path2}.components[${JSON.stringify(SCENE_CANVAS_COMPONENT)}]`,
          "Canvas components may only be attached to root-level layers"
        );
      }
      canvasLayers.push({ node, path: path2 });
    }
    if (isPrefab && (node.kind !== "group" || !insideLayer || isLayer)) {
      throw new SceneValidationError(
        "invalid-standard-component",
        `${path2}.components[${JSON.stringify(SCENE_PREFAB_COMPONENT)}]`,
        "Prefabs must be group nodes inside a layer"
      );
    }
    if (node.kind === "group") {
      node.children.forEach((child, childIndex) => inspect(
        child,
        `${path2}.children[${childIndex}]`,
        depth + 1,
        childIndex,
        insideLayer || isLayer
      ));
    }
  };
  inspect(root, "$.root", 0);
  if (canvasLayers.length > 1) {
    throw new SceneValidationError(
      "invalid-standard-component",
      `${canvasLayers[1].path}.components[${JSON.stringify(SCENE_CANVAS_COMPONENT)}]`,
      "A scene may only define one canvas layer"
    );
  }
  const canvasLayer = canvasLayers[0];
  if (!canvasLayer) return;
  const bottomLayer = [...layers].sort((a, b) => {
    const byZ = (a.node.zIndex ?? 0) - (b.node.zIndex ?? 0);
    return byZ || a.index - b.index;
  })[0];
  if (bottomLayer?.node !== canvasLayer.node) {
    throw new SceneValidationError(
      "invalid-standard-component",
      `${canvasLayer.path}.components[${JSON.stringify(SCENE_CANVAS_COMPONENT)}]`,
      "The canvas component must be attached to the bottom paint layer"
    );
  }
  const component = canvasLayer.node.components?.[SCENE_CANVAS_COMPONENT];
  if (component.data.mode !== "masked") return;
  const mask = findDescendant(canvasLayer.node, component.data.maskNodeId);
  if (!mask || mask.kind === "group" || mask.kind === "text") {
    throw new SceneValidationError(
      "invalid-standard-component",
      `${canvasLayer.path}.components[${JSON.stringify(SCENE_CANVAS_COMPONENT)}].data.maskNodeId`,
      "Canvas mask must reference a rectangle, ellipse, or path within its layer"
    );
  }
}
function findDescendant(root, id) {
  for (const child of root.children) {
    if (child.id === id) return child;
    if (child.kind === "group") {
      const found = findDescendant(child, id);
      if (found) return found;
    }
  }
  return void 0;
}
function validateNodeBase(node, path2, componentsAllowed) {
  expectOptionalFinite(node.zIndex, `${path2}.zIndex`, "Scene node zIndex must be finite");
  expectOptionalFinite(node.opacity, `${path2}.opacity`, "Scene node opacity must be finite");
  expectOptionalBoolean(node.visible, `${path2}.visible`, "invalid-node", "Scene node visible must be a boolean");
  if (node.clipId !== void 0) {
    expectNonEmptyString(node.clipId, `${path2}.clipId`, "invalid-node", "Scene node clipId must not be empty");
  }
  if (node.transform !== void 0) validateTransform(node.transform, `${path2}.transform`);
  if (node.metadata !== void 0) validateMetadata(node.metadata, `${path2}.metadata`);
  if (node.components !== void 0) {
    if (!componentsAllowed) {
      throw new SceneValidationError(
        "invalid-node",
        `${path2}.components`,
        "Version-one scene nodes cannot contain components"
      );
    }
    validateSceneComponentMap(node.components, `${path2}.components`);
    const components = node.components;
    if (components[SCENE_LAYER_COMPONENT] && node.kind !== "group") {
      throw new SceneValidationError(
        "invalid-standard-component",
        `${path2}.components[${JSON.stringify(SCENE_LAYER_COMPONENT)}]`,
        "Layer components may only be attached to group nodes"
      );
    }
  }
}
function validateTransform(value, path2) {
  const transform = expectRecord(value, path2, "invalid-node", "Transform must be an object");
  expectFinite(transform.x, `${path2}.x`, "invalid-node", "Transform x must be finite");
  expectFinite(transform.y, `${path2}.y`, "invalid-node", "Transform y must be finite");
  expectFinite(transform.rotation, `${path2}.rotation`, "invalid-node", "Transform rotation must be finite");
  expectOptionalFinite(transform.scaleX, `${path2}.scaleX`, "Transform scaleX must be finite");
  expectOptionalFinite(transform.scaleY, `${path2}.scaleY`, "Transform scaleY must be finite");
}
function validateMetadata(value, path2) {
  const metadata = expectRecord(value, path2, "invalid-node", "Metadata must be an object");
  for (const [key, entry] of Object.entries(metadata)) {
    if (typeof entry !== "string" && typeof entry !== "boolean" && typeof entry !== "number") {
      throw new SceneValidationError("invalid-node", `${path2}.${key}`, "Metadata values must be scalar");
    }
    if (typeof entry === "number" && !Number.isFinite(entry)) {
      throw new SceneValidationError("invalid-node", `${path2}.${key}`, "Metadata numbers must be finite");
    }
  }
}
function validateOptionalPaint(value, path2) {
  if (value === void 0) return;
  const paint = expectRecord(value, path2, "invalid-node", "Paint must be an object");
  expectNonEmptyString(paint.color, `${path2}.color`, "invalid-node", "Paint color must not be empty");
  expectOptionalFinite(paint.opacity, `${path2}.opacity`, "Paint opacity must be finite");
}
function validateOptionalStroke(value, path2) {
  if (value === void 0) return;
  const stroke = expectRecord(value, path2, "invalid-node", "Stroke must be an object");
  expectNonEmptyString(stroke.color, `${path2}.color`, "invalid-node", "Stroke color must not be empty");
  expectFiniteNonNegative(stroke.width, `${path2}.width`, "Stroke width must not be negative");
  expectOptionalFinite(stroke.opacity, `${path2}.opacity`, "Stroke opacity must be finite");
  expectOptionalEnum(
    stroke.lineCap,
    ["butt", "round", "square"],
    `${path2}.lineCap`,
    "Stroke lineCap is invalid"
  );
  expectOptionalEnum(
    stroke.lineJoin,
    ["bevel", "miter", "round"],
    `${path2}.lineJoin`,
    "Stroke lineJoin is invalid"
  );
}
function validatePathCommands(value, path2) {
  if (!Array.isArray(value)) {
    throw new SceneValidationError("invalid-node", path2, "Path commands must be an array");
  }
  for (const [index, commandValue] of value.entries()) {
    const commandPath = `${path2}[${index}]`;
    const command = expectRecord(commandValue, commandPath, "invalid-node", "Path command must be an object");
    switch (command.command) {
      case "move":
      case "line":
        expectFinite(command.x, `${commandPath}.x`, "invalid-node", "Path x must be finite");
        expectFinite(command.y, `${commandPath}.y`, "invalid-node", "Path y must be finite");
        break;
      case "quadratic":
        expectFinite(command.controlX, `${commandPath}.controlX`, "invalid-node", "Path controlX must be finite");
        expectFinite(command.controlY, `${commandPath}.controlY`, "invalid-node", "Path controlY must be finite");
        expectFinite(command.x, `${commandPath}.x`, "invalid-node", "Path x must be finite");
        expectFinite(command.y, `${commandPath}.y`, "invalid-node", "Path y must be finite");
        break;
      case "cubic":
        expectFinite(command.control1X, `${commandPath}.control1X`, "invalid-node", "Path control1X must be finite");
        expectFinite(command.control1Y, `${commandPath}.control1Y`, "invalid-node", "Path control1Y must be finite");
        expectFinite(command.control2X, `${commandPath}.control2X`, "invalid-node", "Path control2X must be finite");
        expectFinite(command.control2Y, `${commandPath}.control2Y`, "invalid-node", "Path control2Y must be finite");
        expectFinite(command.x, `${commandPath}.x`, "invalid-node", "Path x must be finite");
        expectFinite(command.y, `${commandPath}.y`, "invalid-node", "Path y must be finite");
        break;
      case "close":
        break;
      default:
        throw new SceneValidationError(
          "invalid-node",
          `${commandPath}.command`,
          `Unknown path command ${String(command.command)}`
        );
    }
  }
}
function validateComponent(value, path2) {
  const component = expectRecord(
    value,
    path2,
    "invalid-component",
    "Scene component must be an object"
  );
  if (!Number.isInteger(component.version) || component.version < 1) {
    throw new SceneValidationError(
      "invalid-component",
      `${path2}.version`,
      "Component version must be a positive integer"
    );
  }
  if (!("data" in component)) {
    throw new SceneValidationError("invalid-component", `${path2}.data`, "Component data is required");
  }
  validateJsonValue(component.data, `${path2}.data`);
  return component;
}
function expectStandardVersion(component, path2) {
  if (component.version !== 1) {
    throw new SceneValidationError(
      "invalid-standard-component",
      `${path2}.version`,
      `Unsupported standard component version ${String(component.version)}`
    );
  }
}
function rejectNodeStandardComponents(components, path2) {
  for (const id of [SCENE_CANVAS_COMPONENT, SCENE_CONNECTOR_VIEW_COMPONENT, SCENE_LAYER_COMPONENT, SCENE_PREFAB_COMPONENT, SCENE_SNAP_POINTS_COMPONENT]) {
    if (components[id]) {
      throw new SceneValidationError(
        "invalid-standard-component",
        `${path2}[${JSON.stringify(id)}]`,
        `${id} may only be attached to scene nodes`
      );
    }
  }
}
function rejectSceneNodeComponents(components, path2) {
  for (const id of [SCENE_CANVAS_COMPONENT, SCENE_CONNECTOR_VIEW_COMPONENT, SCENE_LAYER_COMPONENT, SCENE_PREFAB_COMPONENT, SCENE_SNAP_POINTS_COMPONENT]) {
    if (components[id]) {
      throw new SceneValidationError(
        "invalid-standard-component",
        `${path2}[${JSON.stringify(id)}]`,
        `${id} may only be attached to scene nodes`
      );
    }
  }
}
function validateJson(value, path2, active) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new SceneValidationError("invalid-json", path2, "JSON numbers must be finite");
  }
  if (typeof value !== "object") {
    throw new SceneValidationError("invalid-json", path2, `Value of type ${typeof value} is not JSON`);
  }
  if (active.has(value)) {
    throw new SceneValidationError("invalid-json", path2, "JSON data must not contain cycles");
  }
  active.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      if (!(index in value)) {
        throw new SceneValidationError("invalid-json", `${path2}[${index}]`, "JSON arrays must not be sparse");
      }
      validateJson(value[index], `${path2}[${index}]`, active);
    }
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new SceneValidationError("invalid-json", path2, "JSON objects must be plain objects");
    }
    if (Object.getOwnPropertySymbols(value).length) {
      throw new SceneValidationError("invalid-json", path2, "JSON objects must not contain symbol keys");
    }
    for (const [key, entry] of Object.entries(value)) {
      validateJson(entry, `${path2}[${JSON.stringify(key)}]`, active);
    }
  }
  active.delete(value);
}
function expectRecord(value, path2, code, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SceneValidationError(code, path2, message);
  }
  return value;
}
function expectNonEmptyString(value, path2, code, message) {
  if (typeof value !== "string" || !value.trim()) {
    throw new SceneValidationError(code, path2, message);
  }
  return value;
}
function expectFinite(value, path2, code, message) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SceneValidationError(code, path2, message);
  }
}
function expectFinitePositive(value, path2, message) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new SceneValidationError("invalid-scene", path2, message);
  }
}
function expectFiniteNonNegative(value, path2, message) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new SceneValidationError("invalid-node", path2, message);
  }
}
function expectOptionalFinite(value, path2, message) {
  if (value !== void 0) expectFinite(value, path2, "invalid-node", message);
}
function expectOptionalFiniteNonNegative(value, path2, message) {
  if (value !== void 0) expectFiniteNonNegative(value, path2, message);
}
function expectOptionalBoolean(value, path2, code, message) {
  if (value !== void 0 && typeof value !== "boolean") {
    throw new SceneValidationError(code, path2, message);
  }
}
function expectOptionalEnum(value, options, path2, message) {
  if (value !== void 0 && (typeof value !== "string" || !options.includes(value))) {
    throw new SceneValidationError("invalid-node", path2, message);
  }
}

// frontend/vendor/scene/scene.ts
function createScene(width, height, root, options = {}) {
  const scene = {
    version: SCENE_VERSION,
    width,
    height,
    root,
    ...options.connectors ? { connectors: options.connectors } : {},
    ...options.components ? { components: options.components } : {}
  };
  validateScene(scene);
  return scene;
}
function childrenInPaintOrder(group) {
  return group.children.map((node, index) => ({ node, index })).sort((left, right) => (left.node.zIndex ?? 0) - (right.node.zIndex ?? 0) || left.index - right.index).map((entry) => entry.node);
}

// frontend/vendor/scene/serialization.ts
function stringifyScene(scene, space = 2) {
  validateScene(scene);
  const canonical = canonicalize(scene, "$", /* @__PURE__ */ new Set());
  validateJsonValue(canonical);
  return JSON.stringify(canonical, null, space);
}
function canonicalize(value, path2, active) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    if (active.has(value)) {
      throw new SceneValidationError("invalid-json", path2, "Cannot serialize cyclic data");
    }
    active.add(value);
    if (Array.isArray(value)) {
      const result2 = value.map((entry, index) => canonicalize(entry, `${path2}[${index}]`, active));
      active.delete(value);
      return result2;
    }
    const entries = Object.entries(value).filter(([, entry]) => entry !== void 0).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    const result = Object.fromEntries(entries.map(([key, entry]) => [
      key,
      canonicalize(entry, `${path2}[${JSON.stringify(key)}]`, active)
    ]));
    active.delete(value);
    return result;
  }
  throw new SceneValidationError("invalid-json", path2, `Cannot serialize ${typeof value}`);
}

// frontend/vendor/scene/svg.ts
function sceneToSvg(scene, options = {}) {
  const metadata = escapeXml(stringifyScene(scene, 0));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}" width="${scene.width}" height="${scene.height}">`,
    `  <metadata id="versytl-scene">${metadata}</metadata>`,
    ...definitionsMarkup(options.definitions),
    nodeMarkup(scene.root, 1, options),
    "</svg>"
  ].join("\n");
}
function nodeMarkup(node, depth, options) {
  if (node.visible === false) return "";
  const indent = "  ".repeat(depth);
  const common = `${transformAttribute(node.transform)}${opacityAttribute(node.opacity)} data-scene-id="${escapeXml(node.id)}"${extensionAttributes(node, options)}`;
  if (node.kind === "group") {
    const children = childrenInPaintOrder(node).map((child) => nodeMarkup(child, depth + 1, options)).filter(Boolean);
    return [`${indent}<g id="${escapeXml(node.id)}"${common}>`, ...children, `${indent}</g>`].join("\n");
  }
  const paint = paintAttributes(node.fill, node.stroke);
  if (node.kind === "rectangle") {
    return `${indent}<rect id="${escapeXml(node.id)}" x="${-node.width / 2}" y="${-node.height / 2}" width="${node.width}" height="${node.height}"${node.radius === void 0 ? "" : ` rx="${node.radius}"`}${common}${paint}/>`;
  }
  if (node.kind === "ellipse") {
    return `${indent}<ellipse id="${escapeXml(node.id)}" cx="0" cy="0" rx="${node.radiusX}" ry="${node.radiusY}"${common}${paint}/>`;
  }
  if (node.kind === "path") {
    return `${indent}<path id="${escapeXml(node.id)}" d="${pathValue(node.commands)}"${common}${paint}/>`;
  }
  return `${indent}<text id="${escapeXml(node.id)}" x="0" y="0"${common}${paint}${node.fontFamily ? ` font-family="${escapeXml(node.fontFamily)}"` : ""} font-size="${node.fontSize}"${node.fontWeight === void 0 ? "" : ` font-weight="${node.fontWeight}"`}${node.align ? ` text-anchor="${node.align === "center" ? "middle" : node.align}"` : ""}${node.baseline ? ` dominant-baseline="${node.baseline === "middle" ? "central" : node.baseline}"` : ""}>${escapeXml(node.text)}</text>`;
}
function definitionsMarkup(definitions) {
  if (!definitions?.length) return [];
  return [
    "  <defs>",
    ...definitions.flatMap((definition) => definition.split("\n").map((line) => `    ${line}`)),
    "  </defs>"
  ];
}
var reservedNodeAttributes = /* @__PURE__ */ new Set([
  "id",
  "transform",
  "opacity",
  "data-scene-id",
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "x",
  "y",
  "width",
  "height",
  "rx",
  "cx",
  "cy",
  "d",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline"
]);
function extensionAttributes(node, options) {
  const attributes = options.nodeAttributes?.(node);
  if (!attributes) return "";
  return Object.entries(attributes).map(([name, value]) => {
    if (value === void 0) return "";
    if (!/^[A-Za-z_:][A-Za-z0-9_.:-]*$/.test(name)) {
      throw new TypeError(`Invalid SVG attribute name: ${name}`);
    }
    if (reservedNodeAttributes.has(name)) {
      throw new TypeError(`SVG export extensions cannot replace the built-in ${name} attribute`);
    }
    return ` ${name}="${escapeXml(String(value))}"`;
  }).join("");
}
function transformAttribute(transform) {
  if (!transform) return "";
  const values = [`translate(${transform.x} ${transform.y})`];
  if (transform.rotation) values.push(`rotate(${transform.rotation})`);
  if (transform.scaleX !== void 0 || transform.scaleY !== void 0) {
    values.push(`scale(${transform.scaleX ?? 1} ${transform.scaleY ?? 1})`);
  }
  return ` transform="${values.join(" ")}"`;
}
function opacityAttribute(opacity) {
  return opacity === void 0 ? "" : ` opacity="${opacity}"`;
}
function paintAttributes(fill, stroke) {
  return [
    ` fill="${escapeXml(fill?.color ?? "none")}"`,
    fill?.opacity === void 0 ? "" : ` fill-opacity="${fill.opacity}"`,
    ` stroke="${escapeXml(stroke?.color ?? "none")}"`,
    stroke?.opacity === void 0 ? "" : ` stroke-opacity="${stroke.opacity}"`,
    stroke?.width === void 0 ? "" : ` stroke-width="${stroke.width}"`,
    stroke?.lineCap ? ` stroke-linecap="${stroke.lineCap}"` : "",
    stroke?.lineJoin ? ` stroke-linejoin="${stroke.lineJoin}"` : ""
  ].join("");
}
function pathValue(commands) {
  return commands.map((entry) => {
    if (entry.command === "move") return `M ${entry.x} ${entry.y}`;
    if (entry.command === "line") return `L ${entry.x} ${entry.y}`;
    if (entry.command === "quadratic") return `Q ${entry.controlX} ${entry.controlY} ${entry.x} ${entry.y}`;
    if (entry.command === "cubic") return `C ${entry.control1X} ${entry.control1Y} ${entry.control2X} ${entry.control2Y} ${entry.x} ${entry.y}`;
    return "Z";
  }).join(" ");
}
function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

// frontend/vendor/stasis/index.ts
var STASIS_SCHEMA_VERSION = 1;
var metadataPattern = /<metadata\b([^>]*)>([\s\S]*?)<\/metadata>/gi;
var activeContentPattern = /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*javascript:/i;
function parseStasisSvg(svg) {
  assertSafeStasisSvg(svg);
  const metadata = parsePageMetadata(svg);
  validateMetadata2(metadata);
  return {
    svg,
    metadata,
    title: textElement(svg, "title"),
    description: textElement(svg, "desc"),
    bindings: collectStasisBindings(svg),
    metadataIds: collectMetadataIds(svg)
  };
}
function serializeStasisDocument(document2) {
  assertSafeStasisSvg(document2.svg);
  validateMetadata2(document2.metadata);
  return writeStasisPageMetadata(document2.svg, document2.metadata);
}
function updateStasisDocument(document2, update) {
  const metadata = mergeDefined(document2.metadata, update.metadata ?? {});
  let svg = writeStasisPageMetadata(document2.svg, metadata);
  if (update.title !== void 0) svg = writeTextElement(svg, "title", update.title);
  if (update.description !== void 0) svg = writeTextElement(svg, "desc", update.description);
  return parseStasisSvg(svg);
}
function writeStasisPageMetadata(svg, metadata) {
  validateMetadata2(metadata);
  const content = encodeXml(canonicalJson(metadata));
  let found = false;
  metadataPattern.lastIndex = 0;
  const updated = svg.replace(metadataPattern, (element2, attributes) => {
    if (!/\bid=["']stasis-page["']/i.test(attributes)) return element2;
    found = true;
    return `<metadata${attributes}>${content}</metadata>`;
  });
  if (found) return updated;
  const element = `<metadata id="stasis-page">${content}</metadata>`;
  const desc = /<desc\b[^>]*>[\s\S]*?<\/desc>/i;
  if (desc.test(updated)) return updated.replace(desc, (match) => `${match}
  ${element}`);
  const title = /<title\b[^>]*>[\s\S]*?<\/title>/i;
  if (title.test(updated)) return updated.replace(title, (match) => `${match}
  ${element}`);
  return updated.replace(/<svg\b([^>]*)>/i, `<svg$1>
  ${element}`);
}
function collectStasisBindings(svg) {
  const bindings = [];
  const pattern = /\bdata-stasis-(bind|status|href)\s*=\s*["']([^"']+)["']/gi;
  for (const match of svg.matchAll(pattern)) {
    const target = match[1] === "bind" ? "text" : match[1];
    bindings.push({ target, path: decodeXml(match[2] ?? ""), sourceId: "default" });
  }
  return bindings;
}
function assertSafeStasisSvg(svg) {
  if (!/<svg\b/i.test(svg)) throw new Error("Stasis document is not an SVG");
  if (activeContentPattern.test(svg)) throw new Error("Stasis document contains active SVG content");
}
function validateMetadata2(metadata) {
  if (metadata.schemaVersion !== void 0 && metadata.schemaVersion !== STASIS_SCHEMA_VERSION) {
    throw new Error(`Unsupported Stasis schema version: ${String(metadata.schemaVersion)}`);
  }
  const sources = { ...metadata.source ? { default: metadata.source } : {}, ...metadata.sources };
  for (const [id, source] of Object.entries(sources)) {
    if (!source.type) throw new Error(`Stasis source ${id} is missing an adapter type`);
    if (source.endpoint && !isSafeEndpoint(source.endpoint)) throw new Error(`Stasis source ${id} must use a relative endpoint`);
    if (source.refreshMs !== void 0 && (!Number.isFinite(source.refreshMs) || source.refreshMs < 1e3)) {
      throw new Error(`Stasis source ${id} refreshMs must be at least 1000`);
    }
  }
}
function parsePageMetadata(svg) {
  metadataPattern.lastIndex = 0;
  for (const match of svg.matchAll(metadataPattern)) {
    if (!/\bid=["']stasis-page["']/i.test(match[1] ?? "")) continue;
    const value = decodeXml(match[2]?.trim() ?? "");
    if (!value) return {};
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new Error(`Invalid stasis-page metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return {};
}
function collectMetadataIds(svg) {
  const ids = [];
  metadataPattern.lastIndex = 0;
  for (const match of svg.matchAll(metadataPattern)) {
    const id = /\bid=["']([^"']+)["']/i.exec(match[1] ?? "")?.[1];
    if (id) ids.push(id);
  }
  return ids;
}
function writeTextElement(svg, tag, value) {
  const encoded = encodeXml(value);
  const pattern = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "i");
  if (pattern.test(svg)) return svg.replace(pattern, `<${tag}>${encoded}</${tag}>`);
  return svg.replace(/<svg\b([^>]*)>/i, `<svg$1>
  <${tag}>${encoded}</${tag}>`);
}
function textElement(svg, tag) {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(svg);
  return match?.[1] ? decodeXml(match[1].replace(/<[^>]+>/g, "").trim()) : "";
}
function mergeDefined(base, update) {
  return { ...base, ...Object.fromEntries(Object.entries(update).filter(([, value]) => value !== void 0)) };
}
function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}
function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== void 0).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonicalValue(child)]));
}
function isSafeEndpoint(value) {
  return value.startsWith("/") && !value.startsWith("//") && !/[\u0000-\u001f]/.test(value);
}
function encodeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function decodeXml(value) {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// frontend/charts.ts
function observationCommands(points, key, start, end) {
  let previous;
  return points.filter((point) => point.at >= start && point.at <= end).map((point) => {
    const gap = !previous || point.at - previous.at > previous.ttlSeconds * 1e3;
    previous = point;
    return {
      command: gap ? "move" : "line",
      x: 38 + (point.at - start) / Math.max(1, end - start) * 484,
      y: 172 - point[key] / 100 * 126
    };
  });
}
function cpuHistoryDocument(options) {
  const id = "pulsed-cpu-history";
  const width = Math.max(320, Math.min(1e3, options.width));
  const height = Math.max(240, width * 0.36);
  const start = options.end - options.windowMs;
  const points = options.points.filter((point) => point.at >= start && point.at <= options.end);
  const card = createTrendChartNode({
    id,
    bounds: { x: 0, y: 0, width, height },
    title: "CPU usage over time",
    eyebrow: "OBSERVED ON THIS PEER",
    values: [],
    min: 0,
    max: 100,
    unit: "%",
    accent: options.colors.accent
  });
  function adapt(node) {
    if (node.kind === "group" && node.id === `${id}:content`) {
      const chartWidth = 560;
      const scale = (width - 20) / chartWidth;
      const children = node.children.filter((child) => child.id !== `${id}:latest`).map(adapt);
      for (const [key, color] of [["peak", options.colors.peak], ["average", options.colors.accent]]) {
        children.push({
          id: `${id}:${key}`,
          kind: "path",
          commands: observationCommands(points, key, start, options.end),
          stroke: { color, width: 2.5, lineCap: "round", lineJoin: "round" }
        });
        for (const [index, point] of points.entries()) {
          children.push({
            id: `${id}:${key}:sample:${index}`,
            kind: "ellipse",
            radiusX: 2,
            radiusY: 2,
            transform: { x: 38 + (point.at - start) / options.windowMs * 484, y: 172 - point[key] / 100 * 126, rotation: 0 },
            fill: { color }
          });
        }
      }
      const label = (suffix, text4, x, align) => ({
        id: `${id}:${suffix}`,
        kind: "text",
        text: text4,
        fontSize: 13,
        align,
        transform: { x, y: 202, rotation: 0 },
        fill: { color: options.colors.muted }
      });
      children.push(label("start", `${Math.round(options.windowMs / 6e4)}m ago`, 38, "start"), label("end", "Snapshot", 522, "end"));
      return { ...node, transform: { x: 10, y: 58, rotation: 0, scaleX: scale, scaleY: (height - 64) / 220 }, children };
    }
    if (node.kind === "group") return { ...node, children: node.children.filter((child) => child.id !== `${id}:menu`).map(adapt) };
    if (node.kind === "rectangle") return { ...node, fill: { color: options.colors.surface }, stroke: node.stroke ? { ...node.stroke, color: options.colors.border } : void 0 };
    if (node.kind === "text") return { ...node, fill: { color: node.id.includes(":title") ? options.colors.text : options.colors.muted }, fontSize: node.id.includes(":axis:") ? 13 : node.fontSize };
    if (node.kind === "path" && node.id.includes(":grid:")) return { ...node, stroke: { ...node.stroke, color: options.colors.border } };
    return node;
  }
  const root = {
    id: "pulsed-history-root",
    kind: "group",
    children: [adapt(card)],
    components: {
      "@pulsed/telemetry/cpu-history": {
        version: 1,
        data: { node: options.name, servingNode: options.servingNode, start, end: options.end, points, units: "percent", retention: "peer-local, process memory" }
      }
    }
  };
  const description = `${points.length} observed CPU readings on ${options.servingNode}. Mean and peak logical CPU, 0 to 100 percent. Gaps longer than heartbeat TTL are disconnected.`;
  const svg = sceneToSvg(createScene(width, height, root)).replace(/<svg\b[^>]*>/, (opening) => `${opening}
<title>${escapeXml(options.name + " CPU history")}</title>
<desc>${escapeXml(description)}</desc>`);
  return serializeStasisDocument(updateStasisDocument(parseStasisSvg(svg), {
    metadata: {
      schemaVersion: 1,
      id: "pulsed-cpu-history",
      label: "CPU history",
      eyebrow: "Pulsed",
      source: { type: "pulsed", resource: "cpu-history", refreshMs: 2e3 }
    }
  }));
}
function memoryMeter(value, colors3) {
  return sceneToSvg(createScene(300, 10, {
    id: "memory-meter-root",
    kind: "group",
    children: [createProgressBarNode({
      id: "pulsed-memory-meter",
      bounds: { x: 0, y: 0, width: 300, height: 10 },
      value: value / 100,
      fillColor: colors3.accent,
      trackColor: colors3.border
    })]
  }));
}

// frontend/main.ts
var panel = document.querySelector("#node-inspector");
var select = document.querySelector("#inspect-node");
var windowSelect = document.querySelector("#history-window");
var chart = document.querySelector("#cpu-history");
var download = document.querySelector("#export-history");
var text3 = (id, value) => {
  document.getElementById(id).textContent = value;
};
var snapshot = JSON.parse(document.querySelector("#snapshot-data").dataset.snapshot);
var exportedSvg = "";
var restored = {};
try {
  if (location.hash.startsWith("#view=")) restored = JSON.parse(decodeURIComponent(location.hash.slice(6)));
} catch {
}
var selectedName = typeof restored.selected === "string" ? restored.selected : "";
windowSelect.value = ["60000", "300000"].includes(String(restored.historyWindow)) ? String(restored.historyWindow) : "300000";
function colors2() {
  const style = getComputedStyle(document.documentElement);
  const token = (name) => style.getPropertyValue("--" + name).trim();
  return { accent: token("accent"), peak: token("stale"), surface: token("surface"), border: token("border"), text: token("text"), muted: token("muted") };
}
function render() {
  const nodes = snapshot.nodes || [];
  const node = nodes.find((item) => item.Name === selectedName);
  if (!node) {
    exportedSvg = "";
    download.disabled = true;
    chart.replaceChildren();
    text3("inspect-title", selectedName || "Choose a node");
    text3("history-note", selectedName ? "This node is no longer in this peer\u2019s snapshot. Select another node." : "Waiting for a node heartbeat.");
    text3("inspect-state", "Unavailable");
    text3("inspect-cpu", "Unavailable");
    text3("inspect-memory", "Unavailable");
    text3("inspect-load", "Unavailable");
    document.getElementById("inspect-memory-meter").replaceChildren();
    return;
  }
  text3("inspect-title", node.Name);
  text3("inspect-state", node.StatusLabel + " \xB7 " + node.AgeLabel);
  const offline = node.State === "offline";
  text3("inspect-cpu", offline || !node.CoreCount ? "Unavailable" : `${node.CPUAvg.toFixed(1)}% mean \xB7 ${node.CPUMax.toFixed(1)}% peak`);
  text3("inspect-memory", offline || !node.MemTotal ? "Unavailable" : `${node.MemPct.toFixed(1)}% \xB7 ${node.MemLabel}`);
  text3("inspect-load", offline ? "Unavailable" : [node.Load1, node.Load5, node.Load15].map((value) => value.toFixed(2)).join(" / "));
  const palette = colors2();
  const meter = document.getElementById("inspect-memory-meter");
  meter.innerHTML = offline || !node.MemTotal ? "" : memoryMeter(node.MemPct, palette);
  meter.querySelector("svg")?.setAttribute("aria-hidden", "true");
  const windowMs = Number(windowSelect.value);
  const points = (Object.hasOwn(snapshot.history, node.Name) ? snapshot.history[node.Name] : []).filter((point) => point.at >= snapshot.generatedAt - windowMs);
  text3("history-note", points.length === 0 ? "No CPU history available yet. Readings appear as this peer observes heartbeats." : `${points.length} observed reading${points.length === 1 ? " \xB7 collecting a trend" : "s"} \xB7 ${offline ? "last known history \xB7 " : ""}gaps indicate missing heartbeats.`);
  text3("history-source", `Observed by ${snapshot.servingNode || "this peer"} \xB7 up to 5 minutes \xB7 resets on restart or changes with peer.`);
  exportedSvg = cpuHistoryDocument({
    name: node.Name,
    servingNode: snapshot.servingNode,
    points,
    end: snapshot.generatedAt,
    windowMs,
    width: chart.clientWidth || 640,
    theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
    colors: palette
  });
  chart.innerHTML = exportedSvg.replace(/^<\?xml[^>]*>\s*/, "");
  chart.querySelector("svg").setAttribute("role", "img");
  chart.querySelector("svg").setAttribute("aria-label", `${node.Name} CPU history, ${points.length} observed readings`);
  download.disabled = points.length === 0;
  document.querySelectorAll(".cell").forEach((card) => {
    card.dataset.selected = String(card.dataset.name === selectedName);
    card.querySelector("button.inspect-history")?.setAttribute("aria-pressed", String(card.dataset.name === selectedName));
  });
}
function updateOptions() {
  const names = (snapshot.nodes || []).map((node) => node.Name);
  const options = selectedName && !names.includes(selectedName) ? [selectedName, ...names] : names;
  select.replaceChildren(...options.map((name) => new Option(name, name)));
  if (!selectedName) selectedName = names[0] || "";
  select.value = selectedName;
  select.disabled = names.length === 0;
  render();
}
select.addEventListener("change", () => {
  selectedName = select.value;
  render();
});
windowSelect.addEventListener("change", render);
document.getElementById("nodes").addEventListener("click", (event) => {
  const button = event.target.closest("button.inspect-history");
  if (!button) return;
  selectedName = button.closest(".cell").dataset.name;
  select.value = selectedName;
  render();
  panel.scrollIntoView({ behavior: "instant", block: "start" });
  select.focus({ preventScroll: true });
});
download.addEventListener("click", () => {
  if (!exportedSvg || download.disabled) return;
  const url = URL.createObjectURL(new Blob([exportedSvg], { type: "image/svg+xml" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "pulsed-cpu-history.svg";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
});
document.addEventListener("pulsed:snapshot", (event) => {
  snapshot = event.detail;
  updateOptions();
});
new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-palette"] });
new ResizeObserver(render).observe(chart);
document.documentElement.classList.add("versytl-ready");
updateOptions();

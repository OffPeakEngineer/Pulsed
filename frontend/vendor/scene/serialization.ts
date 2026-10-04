import { LEGACY_SCENE_VERSION, SCENE_VERSION } from './types.js'
import type { JsonValue, LegacyScene, Scene } from './types.js'
import {
  SceneValidationError,
  validateJsonValue,
  validateLegacyScene,
  validateScene,
} from './validation.js'

export function migrateScene(value: unknown): Scene {
  const version = sceneVersion(value)
  if (version === SCENE_VERSION) {
    validateScene(value)
    return value
  }
  if (version === LEGACY_SCENE_VERSION) {
    validateLegacyScene(value)
    const migrated: Scene = {
      ...(value as LegacyScene),
      version: SCENE_VERSION,
    }
    validateScene(migrated)
    return migrated
  }
  throw new SceneValidationError(
    'unsupported-version',
    '$.version',
    `Unsupported scene version ${String(version)}`,
  )
}

export function parseScene(source: string): Scene {
  let value: unknown
  try {
    value = JSON.parse(source)
  }
  catch (cause) {
    const detail = cause instanceof Error ? `: ${cause.message}` : ''
    throw new SceneValidationError('parse-error', '$', `Scene JSON could not be parsed${detail}`)
  }
  return migrateScene(value)
}

export function stringifyScene(scene: Scene, space: number | string = 2): string {
  validateScene(scene)
  const canonical = canonicalize(scene, '$', new Set<object>())
  validateJsonValue(canonical)
  return JSON.stringify(canonical, null, space)
}

function sceneVersion(value: unknown): unknown {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>).version
    : undefined
}

function canonicalize(value: unknown, path: string, active: Set<object>): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return value
  if (value && typeof value === 'object') {
    if (active.has(value)) {
      throw new SceneValidationError('invalid-json', path, 'Cannot serialize cyclic data')
    }
    active.add(value)
    if (Array.isArray(value)) {
      const result = value.map((entry, index) => canonicalize(entry, `${path}[${index}]`, active))
      active.delete(value)
      return result
    }
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    const result = Object.fromEntries(entries.map(([key, entry]) => [
      key,
      canonicalize(entry, `${path}[${JSON.stringify(key)}]`, active),
    ]))
    active.delete(value)
    return result
  }
  throw new SceneValidationError('invalid-json', path, `Cannot serialize ${typeof value}`)
}

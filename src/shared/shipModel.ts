// The ship design model. Mirrored by hand in ships-go-3d (models/project3d.go):
// part types, limits and validation rules must change in both together.
//
// A ship is layers of primitives. Every primitive is modelled in a unit cube
// centred on its position, then scaled, rotated (XYZ Euler, radians) and
// placed. Ships face +Z (their nose) with +Y up.

import { t } from '@/i18n'

export const PART_TYPES = [
  'box',
  'sphere',
  'cylinder',
  'cone',
  'wedge',
  'torus',
  'dome',
  'capsule',
  'pyramid',
  'tube',
  'prism',
  'frustum',
] as const
export type PartType = (typeof PART_TYPES)[number]

/**
 * Built-in surface textures. A part without one is plain. The texture is
 * tinted by the part's color.
 */
export const PART_TEXTURES = [
  'panels',
  'grid',
  'stripes',
  'carbon',
  'hexagons',
  'worn',
  'camo',
  'windows',
] as const
export type PartTexture = (typeof PART_TEXTURES)[number]

export type Vec3 = [number, number, number]

export interface Part {
  type: PartType
  position: Vec3
  rotation: Vec3
  scale: Vec3
  color: string
  /** Left out for a plain part (and in ships saved before textures). */
  texture?: PartTexture
  /**
   * An https image to use as the texture instead of a built-in one (never
   * both). Tinted by the color like the built-in textures.
   */
  textureUrl?: string
  /** Also render the part reflected across the X=0 plane. */
  mirror: boolean
}

export interface Layer {
  name: string
  visible: boolean
  parts: Part[]
}

export interface Project {
  _id?: string
  userId?: string
  name: string
  dateCreated?: number
  dateModified?: number
  layers: Layer[]
}

export const LIMITS = {
  projectName: 60,
  layerName: 40,
  layers: 20,
  parts: 400,
  coordinate: 50,
  minScale: 0.01,
  maxScale: 50,
  textureUrl: 500,
} as const

export function newPart(type: PartType, color = '#9aa7b8'): Part {
  return {
    type,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color,
    mirror: false,
  }
}

export function newLayer(name: string): Layer {
  return { name, visible: true, parts: [] }
}

export function newProject(): Project {
  return { name: '', layers: [newLayer(t.value.editor.hull)] }
}

export function clonePart(part: Part): Part {
  return {
    ...part,
    position: [...part.position],
    rotation: [...part.rotation],
    scale: [...part.scale],
  }
}

export function cloneLayers(layers: Layer[]): Layer[] {
  return layers.map((layer) => ({ ...layer, parts: layer.parts.map(clonePart) }))
}

export function countParts(layers: Layer[]): number {
  return layers.reduce((total, layer) => total + layer.parts.length, 0)
}

const COLOR = /^#[0-9a-fA-F]{6}$/

/**
 * Whether a texture URL is one the server accepts: https, with a host, no
 * spaces or control characters, at most LIMITS.textureUrl characters. Same
 * rules as ships-go-3d's validTextureURL.
 */
export function isValidTextureUrl(url: string): boolean {
  if ([...url].length > LIMITS.textureUrl || /\s/.test(url)) return false
  for (const char of url) {
    const code = char.charCodeAt(0)
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return false
  }
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname !== '' && url.startsWith('https://')
  } catch {
    return false
  }
}

/** Problems the server would reject the project for; empty when valid. */
export function validateProject(project: Project): string[] {
  const text = t.value.ship
  const problems: string[] = []
  const name = project.name.trim()
  if (!name) problems.push(text.needsName)
  if ([...name].length > LIMITS.projectName) problems.push(text.nameTooLong(LIMITS.projectName))
  if (project.layers.length === 0) problems.push(text.needsLayer)
  if (project.layers.length > LIMITS.layers) problems.push(text.tooManyLayers(LIMITS.layers))
  if (countParts(project.layers) > LIMITS.parts) problems.push(text.tooManyParts(LIMITS.parts))
  for (const layer of project.layers) {
    if ([...layer.name.trim()].length > LIMITS.layerName) {
      problems.push(text.layerNameTooLong(LIMITS.layerName))
    }
    for (const part of layer.parts) {
      const problem = partProblem(part)
      if (problem) {
        problems.push(text.layerProblem(layer.name, problem))
        break
      }
    }
  }
  return problems
}

function partProblem(part: Part): string | null {
  const text = t.value.ship
  if (!PART_TYPES.includes(part.type)) return text.unknownType(part.type)
  if (!COLOR.test(part.color)) return text.invalidColor(part.color)
  if (part.texture !== undefined && !PART_TEXTURES.includes(part.texture)) {
    return text.unknownTexture(part.texture)
  }
  if (part.textureUrl !== undefined) {
    if (part.texture !== undefined) return text.textureAndImage
    if (!isValidTextureUrl(part.textureUrl)) return text.imageLinkRule(LIMITS.textureUrl)
  }
  for (let axis = 0; axis < 3; axis++) {
    const position = part.position[axis]!
    const scale = part.scale[axis]!
    if (!Number.isFinite(position) || Math.abs(position) > LIMITS.coordinate) {
      return text.positionRange(LIMITS.coordinate)
    }
    if (!Number.isFinite(part.rotation[axis]!)) return text.invalidRotation
    if (!Number.isFinite(scale) || scale < LIMITS.minScale || scale > LIMITS.maxScale) {
      return text.sizeRange(LIMITS.minScale, LIMITS.maxScale)
    }
  }
  return null
}

/** The parts that make up the ship in game: hidden layers are left out. */
export function visibleParts(layers: Layer[]): Part[] {
  return layers.filter((layer) => layer.visible).flatMap((layer) => layer.parts)
}

/**
 * Radius around the origin of a sphere containing every visible part. Same
 * formula as ships-go-3d's BoundingRadius: a part fits in its scaled unit
 * cube, and no rotation moves a point further from the cube's centre than half
 * its diagonal.
 */
export function boundingRadius(layers: Layer[]): number {
  let radius = 0
  for (const part of visibleParts(layers)) {
    radius = Math.max(radius, length(part.position) + length(part.scale) / 2)
  }
  return radius
}

function length([x, y, z]: Vec3): number {
  return Math.sqrt(x * x + y * y + z * z)
}

/**
 * The transform of a part's mirror image across the X=0 plane. Reflecting
 * R = Rx(a)·Ry(b)·Rz(c) through x gives Rx(a)·Ry(-b)·Rz(-c), and every part
 * type is symmetric in its own x, so no negative scale (which would flip the
 * faces inside out) is needed.
 */
export function mirroredTransform(part: Part): { position: Vec3; rotation: Vec3 } {
  const [x, y, z] = part.position
  const [a, b, c] = part.rotation
  return { position: [-x, y, z], rotation: [a, -b, -c] }
}

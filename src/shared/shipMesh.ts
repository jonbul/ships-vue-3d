import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three'

import { mirroredTransform, type Layer, type Part, type PartType } from './shipModel'

// Geometries and materials are shared by every ship on every screen and never
// disposed: there is one geometry per part type and one material per color,
// so the set stays small, and sharing them is what lets a game with many
// ships stay cheap enough for a phone. Never call .dispose() on them.
const geometries = new Map<PartType, BufferGeometry>()
const materials = new Map<string, MeshStandardMaterial>()

// Segment counts are kept low on purpose: ships are small on screen and the
// game has to run on phones.
function createGeometry(type: PartType): BufferGeometry {
  switch (type) {
    case 'box':
      return new BoxGeometry(1, 1, 1)
    case 'sphere':
      return new SphereGeometry(0.5, 20, 14)
    case 'cylinder':
      return new CylinderGeometry(0.5, 0.5, 1, 20)
    case 'cone':
      return new ConeGeometry(0.5, 1, 20)
    case 'wedge':
      return createWedgeGeometry()
    case 'torus':
      // Outer radius 0.35 + 0.15 = 0.5, so it fits the unit cube like the
      // other parts (the bounding radius maths depends on it).
      return new TorusGeometry(0.35, 0.15, 10, 28)
  }
}

/**
 * A ramp: full height at the back (-Z), down to nothing at the front (+Z).
 * Scaled flat it makes a swept wing; upright, a fin.
 */
function createWedgeGeometry(): BufferGeometry {
  const A = [-0.5, -0.5, -0.5]
  const B = [0.5, -0.5, -0.5]
  const C = [-0.5, 0.5, -0.5]
  const D = [0.5, 0.5, -0.5]
  const E = [-0.5, -0.5, 0.5]
  const F = [0.5, -0.5, 0.5]
  // Counter-clockwise seen from outside, so normals point outwards.
  // prettier-ignore
  const triangles = [
    [A, B, F], [A, F, E], // bottom
    [A, C, D], [A, D, B], // back
    [C, E, F], [C, F, D], // slope
    [A, E, C], // left side
    [B, D, F], // right side
  ]
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(triangles.flat(2), 3))
  geometry.computeVertexNormals()
  return geometry
}

export function partGeometry(type: PartType): BufferGeometry {
  let geometry = geometries.get(type)
  if (!geometry) {
    geometry = createGeometry(type)
    geometries.set(type, geometry)
  }
  return geometry
}

export function partMaterial(color: string): MeshStandardMaterial {
  let material = materials.get(color)
  if (!material) {
    material = new MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.25,
      flatShading: true,
    })
    materials.set(color, material)
  }
  return material
}

/** A mesh for one part, or for its mirror image. */
export function createPartMesh(part: Part, mirrored = false): Mesh {
  const mesh = new Mesh(partGeometry(part.type), partMaterial(part.color))
  applyPartTransform(mesh, part, mirrored)
  return mesh
}

export function applyPartTransform(mesh: Mesh, part: Part, mirrored = false): void {
  const { position, rotation } = mirrored ? mirroredTransform(part) : part
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.scale.set(...part.scale)
}

/**
 * The whole ship as one Group, visible layers only. The group owns nothing
 * that needs disposing (geometries and materials are shared), so dropping it
 * is enough.
 */
export function buildShip(layers: Layer[]): Group {
  const group = new Group()
  for (const layer of layers) {
    if (!layer.visible) continue
    for (const part of layer.parts) {
      group.add(createPartMesh(part))
      if (part.mirror) group.add(createPartMesh(part, true))
    }
  }
  return group
}

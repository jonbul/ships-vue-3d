import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three'

import {
  PART_TEXTURES,
  mirroredTransform,
  type Layer,
  type Part,
  type PartTexture,
  type PartType,
} from './shipModel'
import { partTexture, urlTexture } from './textures'

// Geometries and materials are shared by every ship on every screen and never
// disposed: there is one geometry per part type and one material per color
// and texture, so the set stays small, and sharing them is what lets a game with many
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
    case 'dome':
      return createDomeGeometry()
    case 'capsule':
      return createCapsuleGeometry()
    case 'pyramid':
      // Four sides with the corners on the cube's corners: radius √½, turned
      // 45° so the base is the full unit square.
      return new ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4)
    case 'tube':
      return createTubeGeometry()
    case 'prism':
      return new CylinderGeometry(0.5, 0.5, 1, 6)
    case 'frustum':
      return new CylinderGeometry(0.25, 0.5, 1, 20)
  }
}

// The lathe shapes below spin a profile in the XY plane around Y. A profile
// that runs counter-clockwise (up the outside, back down the inside) gives
// faces that point outwards.
const LATHE_SEGMENTS = 20

/** Half a sphere stretched to fill the cube: flat base at the bottom (-Y). */
function createDomeGeometry(): LatheGeometry {
  const points = [new Vector2(0, -0.5)]
  for (let i = 0; i <= 7; i++) {
    const angle = (i / 7) * (Math.PI / 2)
    points.push(new Vector2(0.5 * Math.cos(angle), -0.5 + Math.sin(angle)))
  }
  return new LatheGeometry(points, LATHE_SEGMENTS)
}

/** A cylinder with rounded ends, each end a quarter of the height. */
function createCapsuleGeometry(): LatheGeometry {
  const points = [new Vector2(0, -0.5)]
  for (let i = 1; i <= 5; i++) {
    const angle = (i / 5) * (Math.PI / 2)
    points.push(new Vector2(0.5 * Math.sin(angle), -0.25 - 0.25 * Math.cos(angle)))
  }
  for (let i = 0; i <= 5; i++) {
    const angle = (i / 5) * (Math.PI / 2)
    points.push(new Vector2(0.5 * Math.cos(angle), 0.25 + 0.25 * Math.sin(angle)))
  }
  return new LatheGeometry(points, LATHE_SEGMENTS)
}

/** A hollow cylinder, walls a fifth of its width thick. */
function createTubeGeometry(): LatheGeometry {
  // prettier-ignore
  const points = [
    new Vector2(0.5, -0.5), new Vector2(0.5, 0.5),
    new Vector2(0.3, 0.5), new Vector2(0.3, -0.5),
    new Vector2(0.5, -0.5),
  ]
  return new LatheGeometry(points, LATHE_SEGMENTS)
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

export function partMaterial(
  color: string,
  texture?: PartTexture,
  textureUrl?: string,
): MeshStandardMaterial {
  // An unknown texture (from a newer client, say) draws the part plain.
  const map = textureUrl
    ? urlTexture(textureUrl)
    : texture && PART_TEXTURES.includes(texture)
      ? partTexture(texture)
      : null
  const key = !map ? color : textureUrl ? `${color} url ${textureUrl}` : `${color} ${texture}`
  let material = materials.get(key)
  if (!material) {
    material = new MeshStandardMaterial({
      color,
      map,
      roughness: 0.55,
      metalness: 0.25,
      flatShading: true,
    })
    if (map) projectTexture(material)
    materials.set(key, material)
  }
  return material
}

/** Texture tiles per unit of length, before the ship is scaled in game. */
const TEXTURE_DENSITY = 0.5

/**
 * Makes a textured material project its texture onto each face along the
 * face's main axis (triplanar mapping, in the part's own scaled space)
 * instead of using the geometry's UVs. The texture then keeps the same size
 * on every part however it is stretched (a long hull isn't smeared into
 * streaks), and every shape gets it, including the hand-built wedge, which
 * has no UVs.
 */
function projectTexture(material: MeshStandardMaterial): void {
  material.customProgramCacheKey = () => 'ship-triplanar'
  material.onBeforeCompile = (shader) => {
    const varyings = 'varying vec3 vTriPosition;\nvarying vec3 vTriNormal;\n'
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${varyings}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 partScale = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
        vTriPosition = position * partScale;
        vTriNormal = normal / partScale;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${varyings}`)
      .replace(
        '#include <map_fragment>',
        `vec3 triAxis = abs(vTriNormal);
        vec2 triUv = triAxis.x >= triAxis.y && triAxis.x >= triAxis.z ? vTriPosition.zy
          : triAxis.y >= triAxis.z ? vTriPosition.xz : vTriPosition.xy;
        diffuseColor *= texture2D(map, triUv * ${TEXTURE_DENSITY.toFixed(3)});`,
      )
  }
}

/** A mesh for one part, or for its mirror image. */
export function createPartMesh(part: Part, mirrored = false): Mesh {
  const mesh = new Mesh(
    partGeometry(part.type),
    partMaterial(part.color, part.texture, part.textureUrl),
  )
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

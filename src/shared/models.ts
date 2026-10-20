import {
  Box3,
  BoxGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'

import { API_URL } from '@/api/http'

// Imported 3D models (.glb files stored by ships-go-3d), for parts of type
// 'model'. Each model is downloaded once and fitted into the unit cube every
// part is modelled in, so it is placed, sized and bounded like a built-in
// shape. Every part showing it gets a clone, which shares the model's
// geometries and materials: like the shapes' (see shipMesh.ts), they are
// never disposed.
//
// Loading is in the background: a part shows a wireframe box until its
// model arrives, and keeps it if the model can't be loaded.

export type ModelState = 'loading' | 'loaded' | 'failed'

interface Entry {
  state: ModelState
  model: Object3D | null
  /** Parts drawn before the model arrived, to fill in once it has. */
  waiting: { group: Group; opacity: number }[]
}

const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()
let version = 0
let loader: GLTFLoader | null = null

export function modelUrl(id: string): string {
  return `${API_URL}/models/${encodeURIComponent(id)}`
}

function gltfLoader(): GLTFLoader {
  loader ??= new GLTFLoader()
  return loader
}

/**
 * Reads a .glb file. Rejects for anything three.js can't draw (not a model,
 * or compressed with Draco or meshopt, which the game doesn't decode).
 */
export async function parseModel(data: ArrayBuffer): Promise<Object3D> {
  const gltf = await gltfLoader().parseAsync(data, '')
  return fitUnitCube(gltf.scene)
}

/**
 * Wraps a model so it fills the unit cube centred on the origin along its
 * longest side, keeping its proportions.
 */
export function fitUnitCube(model: Object3D): Object3D {
  const wrapper = new Group()
  wrapper.add(model)
  const box = new Box3().setFromObject(model)
  if (box.isEmpty()) return wrapper
  const size = box.getSize(new Vector3())
  const longest = Math.max(size.x, size.y, size.z)
  model.position.sub(box.getCenter(new Vector3()))
  if (longest > 0) wrapper.scale.setScalar(1 / longest)
  return wrapper
}

/** Uses a model already read (one just imported) instead of downloading it. */
export function addLoadedModel(id: string, model: Object3D): void {
  settle(entry(id), 'loaded', model)
}

/**
 * A part's model: a placeholder that the model replaces once loaded. Below
 * an opacity of 1 the model's own materials are made see-through.
 */
export function createModelObject(id: string, opacity = 1): Group {
  const group = new Group()
  const current = entry(id)
  if (current.model) group.add(cloneModel(current.model, opacity))
  else {
    group.add(placeholder())
    if (current.state === 'loading') current.waiting.push({ group, opacity })
  }
  return group
}

export function modelState(id: string): ModelState {
  return entries.get(id)?.state ?? 'loading'
}

/** Goes up every time a model finishes loading or fails. */
export function modelsVersion(): number {
  return version
}

/** Calls listener whenever a model finishes loading or fails. */
export function onModelLoaded(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function entry(id: string): Entry {
  let found = entries.get(id)
  if (!found) {
    found = { state: 'loading', model: null, waiting: [] }
    entries.set(id, found)
    const loading = found
    if (typeof document === 'undefined') {
      // Tests: there is nothing to download from.
      loading.state = 'failed'
    } else {
      gltfLoader().load(
        modelUrl(id),
        (gltf) => settle(loading, 'loaded', fitUnitCube(gltf.scene)),
        undefined,
        () => settle(loading, 'failed', null),
      )
    }
  }
  return found
}

function settle(target: Entry, state: ModelState, model: Object3D | null): void {
  if (target.state === 'loaded') return
  target.state = state
  target.model = model
  if (model) {
    for (const { group, opacity } of target.waiting) {
      group.clear()
      group.add(cloneModel(model, opacity))
    }
  }
  target.waiting = []
  version++
  for (const listener of listeners) listener()
}

/**
 * A copy sharing geometries and materials; skinned meshes keep their bones.
 * A see-through copy uses see-through copies of the materials, shared too.
 */
function cloneModel(model: Object3D, opacity: number): Object3D {
  const copy = cloneSkinned(model)
  if (opacity < 1) {
    copy.traverse((object) => {
      if (object instanceof Mesh) {
        object.material = Array.isArray(object.material)
          ? object.material.map((material) => seeThrough(material, opacity))
          : seeThrough(object.material, opacity)
      }
    })
  }
  return copy
}

const seeThroughMaterials = new Map<string, Material>()

function seeThrough(material: Material, opacity: number): Material {
  const key = `${material.uuid} ${opacity}`
  let found = seeThroughMaterials.get(key)
  if (!found) {
    found = material.clone()
    found.opacity = material.opacity * opacity
    found.transparent = true
    // As for the shapes (partMaterial): what is behind must show through.
    found.depthWrite = false
    seeThroughMaterials.set(key, found)
  }
  return found
}

const placeholderBox = new BoxGeometry(1, 1, 1)
const placeholderEdges = new EdgesGeometry(placeholderBox)
// Invisible faces, so the placeholder can still be clicked in the editor.
const placeholderFill = new MeshBasicMaterial({ visible: false })
const placeholderLine = new LineBasicMaterial({ color: 0x8fa3c4 })

function placeholder(): Object3D {
  const box = new Mesh(placeholderBox, placeholderFill)
  const edges = new LineSegments(placeholderEdges, placeholderLine)
  // Lines are hit within a whole unit of the pointer; the box is enough.
  edges.raycast = () => {}
  box.add(edges)
  return box
}

import { describe, expect, it } from 'vitest'
import {
  Box3,
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  Vector3,
  type Material,
  type Object3D,
} from 'three'

import { addLoadedModel, createModelObject, fitUnitCube, parseModel } from './models'
import { createPartMesh } from './shipMesh'
import { newPart } from './shipModel'

/** A .glb holding one triangle, from (0,0,0) to (4,2,0). */
function triangleGlb(): ArrayBuffer {
  const positions = new Float32Array([0, 0, 0, 4, 0, 0, 0, 2, 0])
  const document = {
    asset: { version: '2.0' },
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: positions.byteLength }],
    bufferViews: [{ buffer: 0, byteLength: positions.byteLength }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [4, 2, 0],
      },
    ],
  }
  let json = JSON.stringify(document)
  while (json.length % 4 !== 0) json += ' '
  const jsonBytes = new TextEncoder().encode(json)
  const total = 12 + 8 + jsonBytes.length + 8 + positions.byteLength
  const data = new DataView(new ArrayBuffer(total))
  data.setUint32(0, 0x46546c67, true)
  data.setUint32(4, 2, true)
  data.setUint32(8, total, true)
  data.setUint32(12, jsonBytes.length, true)
  data.setUint32(16, 0x4e4f534a, true)
  new Uint8Array(data.buffer, 20).set(jsonBytes)
  const binary = 20 + jsonBytes.length
  data.setUint32(binary, positions.byteLength, true)
  data.setUint32(binary + 4, 0x004e4942, true)
  new Uint8Array(data.buffer, binary + 8).set(new Uint8Array(positions.buffer))
  return data.buffer
}

function expectInUnitCube(box: Box3) {
  for (const axis of ['x', 'y', 'z'] as const) {
    expect(box.min[axis]).toBeGreaterThanOrEqual(-0.5 - 1e-6)
    expect(box.max[axis]).toBeLessThanOrEqual(0.5 + 1e-6)
  }
}

describe('fitUnitCube', () => {
  it('centres a model and fits its longest side to the cube, keeping proportions', () => {
    const mesh = new Mesh(new BoxGeometry(10, 4, 2))
    mesh.position.set(30, -7, 5)
    const box = new Box3().setFromObject(fitUnitCube(mesh))
    expectInUnitCube(box)
    const size = box.getSize(new Vector3())
    expect(size.x).toBeCloseTo(1)
    expect(size.y).toBeCloseTo(0.4)
    expect(size.z).toBeCloseTo(0.2)
    expect(box.getCenter(new Vector3()).length()).toBeCloseTo(0)
  })

  it('leaves an empty model empty', () => {
    expect(new Box3().setFromObject(fitUnitCube(new Group())).isEmpty()).toBe(true)
  })
})

describe('parseModel', () => {
  it('reads a .glb into the unit cube', async () => {
    const box = new Box3().setFromObject(await parseModel(triangleGlb()))
    expectInUnitCube(box)
    expect(box.max.x - box.min.x).toBeCloseTo(1)
    expect(box.max.y - box.min.y).toBeCloseTo(0.5)
  })

  it('rejects a file that is not a model', async () => {
    await expect(parseModel(new TextEncoder().encode('not a model').buffer)).rejects.toThrow()
  })
})

describe('model parts', () => {
  it('show a placeholder in the unit cube until the model is loaded', () => {
    const object = createModelObject('0123456789abcdef01234567')
    expectInUnitCube(new Box3().setFromObject(object))
  })

  it('make a model see-through with shared material copies', async () => {
    const id = 'abcdefabcdefabcdefabcdef'
    addLoadedModel(id, await parseModel(triangleGlb()))
    const materials = (object: Object3D) => {
      const found: Material[] = []
      object.traverse((o) => {
        if (o instanceof Mesh) found.push(o.material as Material)
      })
      return found
    }
    const solid = materials(createModelObject(id))[0]!
    const glass = materials(createModelObject(id, 0.5))[0]!
    expect(solid.transparent).toBe(false)
    expect(glass).not.toBe(solid)
    expect(glass.opacity).toBeCloseTo(0.5)
    expect(glass.transparent).toBe(true)
    expect(materials(createModelObject(id, 0.5))[0]).toBe(glass)
  })

  it('mirror a model with a true reflection', () => {
    const part = newPart('model')
    part.modelId = '0123456789abcdef01234567'
    part.position = [2, 1, 0]
    part.rotation = [0.3, 0.5, 0.7]
    part.scale = [1, 2, 3]
    const original = createPartMesh(part)
    const mirror = createPartMesh(part, true)
    original.updateMatrix()
    mirror.updateMatrix()
    const reflect = new Matrix4().makeScale(-1, 1, 1)
    const expected = reflect.multiply(original.matrix)
    mirror.matrix.elements.forEach((value, i) => expect(value).toBeCloseTo(expected.elements[i]!))
  })
})

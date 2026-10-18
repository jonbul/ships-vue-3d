import { describe, expect, it } from 'vitest'
import { Vector3, type BufferGeometry } from 'three'

import { partGeometry } from './shipMesh'
import { PART_TYPES } from './shipModel'

function triangles(geometry: BufferGeometry): Vector3[][] {
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  const count = index ? index.count : position.count
  const vertex = (i: number) =>
    new Vector3().fromBufferAttribute(position, index ? index.getX(i) : i)
  const result: Vector3[][] = []
  for (let i = 0; i < count; i += 3) result.push([vertex(i), vertex(i + 1), vertex(i + 2)])
  return result
}

describe('partGeometry', () => {
  it.each(PART_TYPES)('%s fits the unit cube', (type) => {
    // boundingRadius (here and on the server) relies on it.
    const geometry = partGeometry(type)
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(box.min[axis]).toBeGreaterThanOrEqual(-0.5 - 1e-6)
      expect(box.max[axis]).toBeLessThanOrEqual(0.5 + 1e-6)
    }
  })

  it.each(PART_TYPES)('%s faces point outwards', (type) => {
    // The signed volume of a closed mesh is positive only when its
    // triangles wind counter-clockwise seen from outside; inward faces would
    // be culled and the part would render inside out.
    let volume = 0
    for (const [a, b, c] of triangles(partGeometry(type))) {
      volume += a!.dot(b!.clone().cross(c!)) / 6
    }
    expect(volume).toBeGreaterThan(0.05)
  })

  it.each(PART_TYPES)('%s is symmetric in its own x', (type) => {
    // mirroredTransform needs it to mirror a part without a negative scale.
    const points = triangles(partGeometry(type)).flat()
    for (const point of points) {
      const reflected = new Vector3(-point.x, point.y, point.z)
      expect(points.some((p) => p.distanceTo(reflected) < 1e-4)).toBe(true)
    }
  })
})

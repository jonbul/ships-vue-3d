import { Euler, Matrix4, Quaternion, Vector3 } from 'three'

import { mirroredTransform, visibleParts, type Layer, type Part } from '@/shared/shipModel'

const local = new Vector3()
const localEnd = new Vector3()
const euler = new Euler()
const rotation = new Quaternion()
const position = new Vector3()
const size = new Vector3()

/**
 * A ship's shape for hit tests: every part's scaled, rotated unit cube, the
 * same boxes the server checks hits on the mothership against (hull.go). Only
 * for a ship that never moves - the mothership, at the origin, unrotated.
 */
export class Hull {
  /** World space to each box's unit-cube space. */
  private readonly inverses: Matrix4[] = []

  constructor(layers: Layer[], scale: number) {
    const shipScale = new Matrix4().makeScale(scale, scale, scale)
    const add = (part: Part, mirrored: boolean) => {
      const transform = mirrored ? mirroredTransform(part) : part
      position.fromArray(transform.position)
      rotation.setFromEuler(euler.fromArray([...transform.rotation, 'XYZ']))
      size.fromArray(part.scale)
      const matrix = new Matrix4().compose(position, rotation, size).premultiply(shipScale)
      this.inverses.push(matrix.invert())
    }
    for (const part of visibleParts(layers)) {
      add(part, false)
      if (part.mirror) add(part, true)
    }
  }

  /** Whether the segment a-b passes through any part's box. */
  segmentHits(a: Vector3, b: Vector3): boolean {
    for (const inverse of this.inverses) {
      local.copy(a).applyMatrix4(inverse)
      localEnd.copy(b).applyMatrix4(inverse)
      if (segmentHitsUnitBox(local, localEnd)) return true
    }
    return false
  }
}

/** Whether the segment p-q passes through the box [-0.5, 0.5] on every axis. */
export function segmentHitsUnitBox(p: Vector3, q: Vector3): boolean {
  let tMin = 0
  let tMax = 1
  for (const axis of ['x', 'y', 'z'] as const) {
    const d = q[axis] - p[axis]
    if (Math.abs(d) < 1e-12) {
      if (Math.abs(p[axis]) > 0.5) return false
      continue
    }
    let t1 = (-0.5 - p[axis]) / d
    let t2 = (0.5 - p[axis]) / d
    if (t1 > t2) [t1, t2] = [t2, t1]
    tMin = Math.max(tMin, t1)
    tMax = Math.min(tMax, t2)
    if (tMin > tMax) return false
  }
  return true
}

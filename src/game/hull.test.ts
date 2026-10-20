import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import type { Layer, Part } from '@/shared/shipModel'
import { Hull } from './hull'

function part(changes: Partial<Part>): Part {
  return {
    type: 'box',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#ffffff',
    mirror: false,
    ...changes,
  }
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z)

describe('Hull', () => {
  it('hits a scaled part and misses beside it', () => {
    const layers: Layer[] = [{ name: 'Hull', visible: true, parts: [part({ scale: [2, 1, 10] })] }]
    const hull = new Hull(layers, 3) // 6 x 3 x 30 in world units.
    expect(hull.segmentHits(v(0, 10, 14), v(0, -10, 14))).toBe(true)
    expect(hull.segmentHits(v(0, 10, 16), v(0, -10, 16))).toBe(false)
    expect(hull.segmentHits(v(4, 10, 0), v(4, -10, 0))).toBe(false)
    // Stopping short of it.
    expect(hull.segmentHits(v(0, 10, 0), v(0, 2, 0))).toBe(false)
  })

  it('follows rotation and mirroring', () => {
    const layers: Layer[] = [
      {
        name: 'Hull',
        visible: true,
        // A long box along X, off to the left, and its mirror on the right.
        parts: [
          part({
            position: [5, 0, 0],
            rotation: [0, 0, Math.PI / 2],
            scale: [1, 4, 1],
            mirror: true,
          }),
        ],
      },
    ]
    const hull = new Hull(layers, 1)
    expect(hull.segmentHits(v(6.8, 0, -5), v(6.8, 0, 5))).toBe(true)
    expect(hull.segmentHits(v(-6.8, 0, -5), v(-6.8, 0, 5))).toBe(true)
    expect(hull.segmentHits(v(5, 1.5, -5), v(5, 1.5, 5))).toBe(false)
  })

  it('tells when a sphere touches it', () => {
    const hull = new Hull(
      [{ name: 'Hull', visible: true, parts: [part({ scale: [2, 1, 10] })] }],
      3,
    )
    expect(hull.sphereHits(v(0, 0, 0), 1)).toBe(true)
    expect(hull.sphereHits(v(0, 3, 10), 1.6)).toBe(true) // 1.5 above the top.
    expect(hull.sphereHits(v(0, 3, 10), 1.4)).toBe(false)
    expect(hull.sphereHits(v(0, 0, 17), 1.9)).toBe(false) // 2 past the end.
  })

  it('ignores hidden layers', () => {
    const hull = new Hull([{ name: 'Hidden', visible: false, parts: [part({})] }], 1)
    expect(hull.segmentHits(v(0, 0, -5), v(0, 0, 5))).toBe(false)
  })
})

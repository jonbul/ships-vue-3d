import { describe, expect, it } from 'vitest'
import { Points, Scene, Vector3 } from 'three'

import { World } from './world'

describe('World dust', () => {
  it('follows the camera anywhere in the world', () => {
    const scene = new Scene()
    const world = new World(scene, 5000)
    const dust = scene.children.find((child): child is Points => child instanceof Points)!
    const camera = new Vector3(4000, -1500, 900)

    world.update(camera)

    const drawn = dust.geometry.attributes.position!
    const speck = new Vector3()
    for (let i = 0; i < drawn.count; i++) {
      speck.fromBufferAttribute(drawn, i).sub(camera)
      expect(Math.max(Math.abs(speck.x), Math.abs(speck.y), Math.abs(speck.z))).toBeLessThanOrEqual(
        150,
      )
    }
    world.dispose()
  })
})

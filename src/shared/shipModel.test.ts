import { describe, expect, it } from 'vitest'
import { Euler, Matrix4, Vector3 } from 'three'

import {
  LIMITS,
  boundingRadius,
  mirroredTransform,
  newPart,
  newProject,
  validateProject,
  type Project,
} from './shipModel'

function project(): Project {
  const p = newProject()
  p.name = 'Falcon'
  p.layers[0]!.parts.push(newPart('box'))
  return p
}

describe('validateProject', () => {
  it('accepts a valid project', () => {
    expect(validateProject(project())).toEqual([])
  })

  it.each([
    ['no name', (p: Project) => (p.name = '  ')],
    ['bad color', (p: Project) => (p.layers[0]!.parts[0]!.color = 'red')],
    ['far position', (p: Project) => (p.layers[0]!.parts[0]!.position[0] = LIMITS.coordinate + 1)],
    ['zero scale', (p: Project) => (p.layers[0]!.parts[0]!.scale[1] = 0)],
    ['no layers', (p: Project) => (p.layers = [])],
  ])('rejects %s', (_, mutate) => {
    const p = project()
    mutate(p)
    expect(validateProject(p)).not.toEqual([])
  })
})

describe('boundingRadius', () => {
  it('matches the server formula: |position| + |scale| / 2', () => {
    const p = project()
    const part = p.layers[0]!.parts[0]!
    part.position = [3, 4, 0]
    part.scale = [2, 2, 2]
    expect(boundingRadius(p.layers)).toBeCloseTo(5 + Math.sqrt(3))
  })

  it('ignores hidden layers', () => {
    const p = project()
    p.layers[0]!.visible = false
    expect(boundingRadius(p.layers)).toBe(0)
  })
})

describe('mirroredTransform', () => {
  it('is the reflection of the part across the X=0 plane', () => {
    const part = newPart('box')
    part.position = [2, 1, -3]
    part.rotation = [0.3, 0.7, -1.1]
    const mirrored = mirroredTransform(part)

    // Reflect a point of the original part through x and compare with the
    // same (x-reflected) local point transformed by the mirrored part.
    const local = new Vector3(0.5, 0.2, -0.4)
    const original = local
      .clone()
      .applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(...part.rotation)))
      .add(new Vector3(...part.position))
    const reflected = new Vector3(-local.x, local.y, local.z)
      .applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(...mirrored.rotation)))
      .add(new Vector3(...mirrored.position))
    expect(reflected.x).toBeCloseTo(-original.x)
    expect(reflected.y).toBeCloseTo(original.y)
    expect(reflected.z).toBeCloseTo(original.z)
  })
})

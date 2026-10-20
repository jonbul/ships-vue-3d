import { describe, expect, it } from 'vitest'
import { Euler, Matrix4, Vector3 } from 'three'

import {
  LIMITS,
  PART_TEXTURES,
  boundingRadius,
  countLights,
  mirroredTransform,
  newPart,
  newProject,
  validateProject,
  type PartTexture,
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

  it('accepts a see-through part and a light', () => {
    const p = project()
    p.layers[0]!.parts[0]!.opacity = 0.3
    p.layers[0]!.parts.push(newPart('light'))
    expect(validateProject(p)).toEqual([])
  })

  it.each([0, 1.5, NaN])('rejects opacity %s', (opacity) => {
    const p = project()
    p.layers[0]!.parts[0]!.opacity = opacity
    expect(validateProject(p)).toHaveLength(1)
  })

  it.each([undefined, 0, 11, Infinity])('rejects a light with intensity %s', (intensity) => {
    const p = project()
    const light = newPart('light')
    light.intensity = intensity
    p.layers[0]!.parts.push(light)
    expect(validateProject(p)).toHaveLength(1)
  })

  it('counts a mirrored light twice against the limit of lights', () => {
    const p = project()
    const light = { ...newPart('light'), mirror: true }
    for (let i = 0; i < LIMITS.lights / 2; i++) p.layers[0]!.parts.push(light)
    expect(countLights(p.layers)).toBe(LIMITS.lights)
    expect(validateProject(p)).toEqual([])
    p.layers[0]!.parts.push(newPart('light'))
    expect(validateProject(p)).toHaveLength(1)
  })

  it('accepts an https image link', () => {
    const p = project()
    p.layers[0]!.parts[0]!.textureUrl = 'https://i.imgur.com/abc123.png?size=2'
    expect(validateProject(p)).toEqual([])
  })

  it.each(PART_TEXTURES)('accepts the %s texture', (texture) => {
    const p = project()
    p.layers[0]!.parts[0]!.texture = texture
    expect(validateProject(p)).toEqual([])
  })

  it.each([
    ['no name', (p: Project) => (p.name = '  ')],
    ['bad color', (p: Project) => (p.layers[0]!.parts[0]!.color = 'red')],
    ['far position', (p: Project) => (p.layers[0]!.parts[0]!.position[0] = LIMITS.coordinate + 1)],
    ['zero scale', (p: Project) => (p.layers[0]!.parts[0]!.scale[1] = 0)],
    ['no layers', (p: Project) => (p.layers = [])],
    ['unknown texture', (p: Project) => (p.layers[0]!.parts[0]!.texture = 'marble' as PartTexture)],
    ['http image link', (p: Project) => (p.layers[0]!.parts[0]!.textureUrl = 'http://a.com/a.png')],
    [
      'spaced image link',
      (p: Project) => (p.layers[0]!.parts[0]!.textureUrl = 'https://a.com/a b'),
    ],
    [
      'long image link',
      (p: Project) =>
        (p.layers[0]!.parts[0]!.textureUrl = `https://a.com/${'a'.repeat(LIMITS.textureUrl)}`),
    ],
    [
      'texture and image link',
      (p: Project) => {
        p.layers[0]!.parts[0]!.texture = 'panels'
        p.layers[0]!.parts[0]!.textureUrl = 'https://a.com/a.png'
      },
    ],
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

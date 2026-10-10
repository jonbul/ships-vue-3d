import { describe, expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'

import { toRadarSpace } from './radar'

const origin = new Vector3()
const level = new Quaternion()

function radar(target: Vector3, ship = origin, rotation = level, range = 100) {
  const out = new Vector3()
  const inRange = toRadarSpace(target, ship, rotation, range, out)
  return { out, inRange }
}

describe('toRadarSpace', () => {
  it('puts a contact straight ahead on +Z, scaled by the range', () => {
    const { out, inRange } = radar(new Vector3(0, 0, 50))
    expect(inRange).toBe(true)
    expect(out.z).toBeCloseTo(0.5)
  })

  it("puts a contact on the ship's right at -X", () => {
    // +Z forward and +Y up make -X the ship's right.
    expect(radar(new Vector3(-50, 0, 0)).out.x).toBeCloseTo(-0.5)
  })

  it('shows height above the ship as +Y', () => {
    expect(radar(new Vector3(0, 30, 0)).out.y).toBeCloseTo(0.3)
  })

  it('pins contacts out of range to the surface', () => {
    const { out, inRange } = radar(new Vector3(0, 0, 500))
    expect(inRange).toBe(false)
    expect(out.length()).toBeCloseTo(1)
    expect(out.z).toBeCloseTo(1)
  })

  it('turns with the ship: whatever is ahead of the nose is ahead on the radar', () => {
    // Ship yawed 90° left (+90° about Y): its nose points at world +X.
    const yawedLeft = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2)
    const { out } = radar(new Vector3(60, 0, 0), origin, yawedLeft)
    expect(out.z).toBeCloseTo(0.6)
    expect(out.x).toBeCloseTo(0)
  })

  it('is relative to the ship position', () => {
    const ship = new Vector3(1000, 0, 1000)
    expect(radar(new Vector3(1000, 0, 1040), ship).out.z).toBeCloseTo(0.4)
  })
})

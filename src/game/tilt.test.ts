import { describe, expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'

import { deviceQuaternion, tiltAngles, tiltToAxis } from './tilt'

const DEG = Math.PI / 180

// A phone held in front of the player, screen facing them.
const held = deviceQuaternion(0, 70, 0)

/** `held`, then turned by `degrees` about a device axis (device frame). */
function turned(axis: Vector3, degrees: number): Quaternion {
  return held.clone().multiply(new Quaternion().setFromAxisAngle(axis, degrees * DEG))
}

const X = new Vector3(1, 0, 0)
const Y = new Vector3(0, 1, 0)
const Z = new Vector3(0, 0, 1)

describe('deviceQuaternion', () => {
  it('raising beta brings the top edge (+y) up out of the flat plane', () => {
    const top = new Vector3(0, 1, 0).applyQuaternion(deviceQuaternion(0, 30, 0))
    expect(top.z).toBeCloseTo(Math.sin(30 * DEG))
  })
})

describe('tiltAngles', () => {
  it('reads nothing when the phone has not moved', () => {
    const t = tiltAngles(held, held, 0)
    expect(t.pitch).toBeCloseTo(0)
    expect(t.steer).toBeCloseTo(0)
  })

  it('portrait: top edge towards the player is positive pitch', () => {
    expect(tiltAngles(held, turned(X, 10), 0).pitch).toBeCloseTo(10 * DEG)
  })

  it('portrait: turning the phone clockwise is positive steer', () => {
    const t = tiltAngles(held, turned(Z, -10), 0)
    expect(t.steer).toBeCloseTo(10 * DEG)
    expect(t.pitch).toBeCloseTo(0)
  })

  // Landscape with the screen turned 90° counter-clockwise: the screen's
  // right edge is the device's -y, its top edge the device's +x.
  it('landscape (90°): the screen top coming towards the player is positive pitch', () => {
    expect(tiltAngles(held, turned(Y.clone().negate(), 10), 90).pitch).toBeCloseTo(10 * DEG)
  })

  it('landscape (270°): the same gesture is a rotation about the device +y', () => {
    expect(tiltAngles(held, turned(Y, 10), 270).pitch).toBeCloseTo(10 * DEG)
  })

  it('steering is about the axis through the screen, whichever way round', () => {
    for (const angle of [0, 90, 180, 270]) {
      expect(tiltAngles(held, turned(Z, -10), angle).steer).toBeCloseTo(10 * DEG)
    }
  })
})

describe('tiltToAxis', () => {
  const dead = 3 * DEG
  const full = 25 * DEG

  it('ignores small tremors', () => {
    expect(tiltToAxis(2 * DEG, dead, full)).toBe(0)
  })

  it('saturates at full deflection and keeps the sign', () => {
    expect(tiltToAxis(40 * DEG, dead, full)).toBe(1)
    expect(tiltToAxis(-40 * DEG, dead, full)).toBe(-1)
  })

  it('grows monotonically in between', () => {
    const a = tiltToAxis(8 * DEG, dead, full)
    const b = tiltToAxis(16 * DEG, dead, full)
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(a)
    expect(b).toBeLessThan(1)
  })
})

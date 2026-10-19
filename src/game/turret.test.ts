import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { FORWARD } from './flight'
import { aimFrom, aimQuaternion, stepAim } from './turret'

const still = { pitch: 0, yaw: 0, roll: 0, throttle: 0 }

describe('turret aim', () => {
  it('points where the aim says', () => {
    const q = aimQuaternion({ yaw: Math.PI / 2, pitch: Math.PI / 4 }, new Quaternion())
    const d = FORWARD.clone().applyQuaternion(q)
    expect(d.x).toBeCloseTo(Math.SQRT1_2)
    expect(d.y).toBeCloseTo(Math.SQRT1_2)
    expect(d.z).toBeCloseTo(0)
  })

  it('round-trips through a quaternion', () => {
    const aim = aimFrom(aimQuaternion({ yaw: -2, pitch: 0.5 }, new Quaternion()))
    expect(aim.yaw).toBeCloseTo(-2)
    expect(aim.pitch).toBeCloseTo(0.5)
  })

  it('turns right and up with the stick, and stops short of straight up', () => {
    const aim = { yaw: 0, pitch: 0 }
    stepAim(aim, { ...still, yaw: 1, pitch: 1 }, 1, 0.5)
    const d = FORWARD.clone().applyQuaternion(aimQuaternion(aim, new Quaternion()))
    // Facing +Z with +Y up, right is -X.
    expect(d.x).toBeLessThan(0)
    expect(d.y).toBeGreaterThan(0)
    stepAim(aim, { ...still, pitch: 1 }, 1, 10)
    expect(aim.pitch).toBeLessThan(Math.PI / 2)
    expect(new Vector3().copy(d).length()).toBeCloseTo(1)
  })
})

import { describe, expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'

import {
  FORWARD,
  UP,
  segmentHitsSphere,
  stepFlight,
  type Controls,
  type FlightState,
} from './flight'

const settings = {
  worldRadius: 1000,
  maxSpeed: 80,
  minSpeed: -20,
  acceleration: 40,
  pitchRate: 1,
  yawRate: 1,
  rollRate: 1,
}

const idle: Controls = { pitch: 0, yaw: 0, roll: 0, throttle: 0 }

function state(speed = 0): FlightState {
  return { position: new Vector3(), quaternion: new Quaternion(), speed }
}

const nose = (s: FlightState) => FORWARD.clone().applyQuaternion(s.quaternion)
const top = (s: FlightState) => UP.clone().applyQuaternion(s.quaternion)
// +Z forward, +Y up: the ship's right is -X.
const RIGHT = new Vector3(-1, 0, 0)

describe('stepFlight', () => {
  it('flies along the nose', () => {
    const s = state(10)
    stepFlight(s, idle, settings, 1)
    expect(s.position.z).toBeCloseTo(10)
  })

  it('raises the nose on positive pitch', () => {
    const s = state()
    stepFlight(s, { ...idle, pitch: 1 }, settings, 0.2)
    expect(nose(s).y).toBeGreaterThan(0)
  })

  it('turns right on positive yaw', () => {
    const s = state()
    stepFlight(s, { ...idle, yaw: 1 }, settings, 0.2)
    expect(nose(s).dot(RIGHT)).toBeGreaterThan(0)
  })

  it('rolls right on positive roll (the top tilts right)', () => {
    const s = state()
    stepFlight(s, { ...idle, roll: 1 }, settings, 0.2)
    expect(top(s).dot(RIGHT)).toBeGreaterThan(0)
  })

  it('clamps speed to the limits', () => {
    const s = state()
    stepFlight(s, { ...idle, throttle: 1 }, settings, 100)
    expect(s.speed).toBe(settings.maxSpeed)
    stepFlight(s, { ...idle, throttle: -1 }, settings, 100)
    expect(s.speed).toBe(settings.minSpeed)
  })

  it('stops at the edge of the world', () => {
    const s = state(settings.maxSpeed)
    for (let i = 0; i < 100; i++) stepFlight(s, idle, settings, 1)
    expect(s.position.length()).toBeCloseTo(settings.worldRadius)
  })
})

describe('segmentHitsSphere', () => {
  const center = new Vector3(0, 0, 50)

  it('catches a bullet that passes through the sphere within one step', () => {
    expect(segmentHitsSphere(new Vector3(0, 1, 0), new Vector3(0, 1, 100), center, 4)).toBe(true)
  })

  it('misses a bullet passing beside it', () => {
    expect(segmentHitsSphere(new Vector3(10, 0, 0), new Vector3(10, 0, 100), center, 4)).toBe(false)
  })

  it('misses a bullet that stops short', () => {
    expect(segmentHitsSphere(new Vector3(0, 0, 0), new Vector3(0, 0, 40), center, 4)).toBe(false)
  })
})

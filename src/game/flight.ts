import { Euler, Quaternion, Vector3 } from 'three'

import type { Settings } from './protocol'

/**
 * Stick and throttle, each in [-1, 1]:
 * pitch +1 raises the nose, yaw +1 turns right, roll +1 rolls right,
 * throttle +1 accelerates.
 */
export interface Controls {
  pitch: number
  yaw: number
  roll: number
  throttle: number
}

export interface FlightState {
  position: Vector3
  quaternion: Quaternion
  /** Along the nose; negative is reverse. */
  speed: number
}

export type FlightSettings = Pick<
  Settings,
  'worldRadius' | 'maxSpeed' | 'minSpeed' | 'acceleration' | 'pitchRate' | 'yawRate' | 'rollRate'
>

/** Ships face +Z with +Y up, as in the editor. */
export const FORWARD = new Vector3(0, 0, 1)
export const UP = new Vector3(0, 1, 0)

const turn = new Quaternion()
const euler = new Euler()
const direction = new Vector3()

/**
 * Advances one ship by dt seconds. Arcade 6-degrees-of-freedom flight: the
 * ship turns at fixed rates in its own frame and always moves along its nose,
 * so there is no drift to manage - simple to fly with a mouse, and later with
 * a touch stick.
 *
 * In a right-handed frame with +Z forward and +Y up, +X is the ship's left:
 * so raising the nose is a negative rotation about X, and turning right a
 * negative rotation about Y.
 */
export function stepFlight(
  state: FlightState,
  controls: Controls,
  s: FlightSettings,
  dt: number,
): void {
  euler.set(
    -clamp(controls.pitch, -1, 1) * s.pitchRate * dt,
    -clamp(controls.yaw, -1, 1) * s.yawRate * dt,
    clamp(controls.roll, -1, 1) * s.rollRate * dt,
    'XYZ',
  )
  turn.setFromEuler(euler)
  state.quaternion.multiply(turn).normalize()

  state.speed = clamp(
    state.speed + clamp(controls.throttle, -1, 1) * s.acceleration * dt,
    s.minSpeed,
    s.maxSpeed,
  )
  direction.copy(FORWARD).applyQuaternion(state.quaternion)
  state.position.addScaledVector(direction, state.speed * dt)

  // The edge of the world is a wall: the ship slides along it.
  if (state.position.length() > s.worldRadius) state.position.setLength(s.worldRadius)
}

/** The ship's velocity vector. */
export function velocityOf(state: FlightState, target = new Vector3()): Vector3 {
  return target.copy(FORWARD).applyQuaternion(state.quaternion).multiplyScalar(state.speed)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Whether a bullet moving from `from` to `to` this frame passed within
 * `radius` of `center`. Testing the swept segment rather than the end point
 * matters: a bullet covers several ship widths per frame.
 */
export function segmentHitsSphere(
  from: Vector3,
  to: Vector3,
  center: Vector3,
  radius: number,
): boolean {
  const abX = to.x - from.x
  const abY = to.y - from.y
  const abZ = to.z - from.z
  const lengthSq = abX * abX + abY * abY + abZ * abZ
  let t = 0
  if (lengthSq > 1e-12) {
    t =
      ((center.x - from.x) * abX + (center.y - from.y) * abY + (center.z - from.z) * abZ) / lengthSq
    t = clamp(t, 0, 1)
  }
  const dx = from.x + abX * t - center.x
  const dy = from.y + abY * t - center.y
  const dz = from.z + abZ * t - center.z
  return dx * dx + dy * dy + dz * dz <= radius * radius
}

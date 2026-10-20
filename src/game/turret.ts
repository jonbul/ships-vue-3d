import {
  CylinderGeometry,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'

import { FORWARD, type Controls } from './flight'

/** Highest and lowest a turret aims, in radians from level: short of straight up. */
const MAX_PITCH = 1.4

/** Where a gunner's turret points: yaw about +Y (positive turns left), pitch above level. */
export interface Aim {
  yaw: number
  pitch: number
}

// Shared by every turret and never disposed, like the ship parts in
// shipMesh.ts: there are only a few, and they outlive any one game.
const ball = new SphereGeometry(1, 20, 14)
const barrel = new CylinderGeometry(0.16, 0.2, 2.6, 8).rotateX(Math.PI / 2)
// Amber and lit from within, so the turrets stand out against the grey hull.
const ballMaterial = new MeshStandardMaterial({
  color: 0xffb74d,
  emissive: 0xff8f00,
  emissiveIntensity: 0.35,
  roughness: 0.5,
  metalness: 0.3,
})
const barrelMaterial = new MeshStandardMaterial({ color: 0x3d4148, roughness: 0.5 })

/**
 * A ball turret with twin barrels along +Z, `radius` across: a gunner, as
 * the others see them on the mothership. The whole group turns with the aim.
 */
export function buildTurret(radius: number): Group {
  const group = new Group()
  const body = new Group()
  body.add(new Mesh(ball, ballMaterial))
  for (const x of [-0.35, 0.35]) {
    const mesh = new Mesh(barrel, barrelMaterial)
    mesh.position.set(x, 0.1, 1.6)
    body.add(mesh)
  }
  body.scale.setScalar(radius)
  group.add(body)
  return group
}

const euler = new Euler(0, 0, 0, 'YXZ')
const direction = new Vector3()

export function aimQuaternion(aim: Aim, out: Quaternion): Quaternion {
  // Raising the nose is a negative rotation about X (see flight.ts).
  return out.setFromEuler(euler.set(-aim.pitch, aim.yaw, 0, 'YXZ'))
}

/** The aim that points the way a quaternion faces. */
export function aimFrom(quaternion: Quaternion): Aim {
  direction.copy(FORWARD).applyQuaternion(quaternion)
  return {
    yaw: Math.atan2(direction.x, direction.z),
    pitch: clampPitch(Math.asin(Math.max(-1, Math.min(1, direction.y)))),
  }
}

/** Turns the aim by the stick, at `rate` radians a second at full deflection. */
export function stepAim(aim: Aim, controls: Controls, rate: number, dt: number): void {
  // Yaw +1 is a turn right, which is a negative angle about +Y.
  aim.yaw -= controls.yaw * rate * dt
  aim.pitch = clampPitch(aim.pitch + controls.pitch * rate * dt)
}

function clampPitch(pitch: number): number {
  return Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch))
}

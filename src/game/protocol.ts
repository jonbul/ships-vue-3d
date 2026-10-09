// The websocket protocol, mirrored by hand from ships-go-3d (game/protocol.go
// and game/settings.go): change both together. Every message is one JSON
// object with a "type" field.

import type { Layer } from '@/shared/shipModel'

export type V3 = [number, number, number]
/** A rotation quaternion as [x, y, z, w] (three.js order). */
export type Q4 = [number, number, number, number]

/** The rules of the game, sent by the server in `welcome`. */
export interface Settings {
  tickRate: number
  worldRadius: number
  shipRadius: number
  maxLife: number
  maxSpeed: number
  minSpeed: number
  acceleration: number
  pitchRate: number
  yawRate: number
  rollRate: number
  bulletSpeed: number
  bulletTtlMs: number
  bulletDamage: number
  fireCooldownMs: number
  respawnDelayMs: number
}

export interface ShipInfo {
  id: string
  name: string
  layers: Layer[]
}

export interface PlayerInfo {
  id: string
  /** Free text typed by a guest: only ever render it as text. */
  name: string
  guest: boolean
  ship: ShipInfo
  /** Scale that normalises the ship's design to `shipRadius`. */
  scale: number
  life: number
  dead: boolean
  kills: number
  deaths: number
  p: V3
  q: Q4
  v: V3
}

export interface PlayerState {
  id: string
  p: V3
  q: Q4
  v: V3
}

export type ServerMessage =
  | { type: 'welcome'; id: string; settings: Settings; players: PlayerInfo[] }
  | { type: 'playerJoined'; player: PlayerInfo }
  | { type: 'playerLeft'; id: string }
  | { type: 'snapshot'; players: PlayerState[] }
  | { type: 'fire'; id: string; owner: string; p: V3; d: V3 }
  | { type: 'damage'; target: string; from: string; bulletId: string; life: number }
  | { type: 'died'; target: string; from: string }
  | { type: 'respawned'; id: string; life: number; p: V3; q: Q4 }
  | { type: 'error'; message: string }

export type ClientMessage =
  | { type: 'join'; shipId: string; name: string }
  | { type: 'state'; p: V3; q: Q4; v: V3 }
  | { type: 'fire'; id: string; p: V3; d: V3 }
  | { type: 'hit'; bulletId: string; target: string }
  | { type: 'respawn' }

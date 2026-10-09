import {
  Group,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'

import { buildShip } from '@/shared/shipMesh'
import { Effects } from './effects'
import { FORWARD, UP, segmentHitsSphere, stepFlight, velocityOf, type FlightState } from './flight'
import { Hud, type Marker } from './hud'
import { KeyboardMouseInput, type InputSource } from './input'
import { Connection } from './net'
import type { PlayerInfo, PlayerState, Q4, ServerMessage, Settings, V3 } from './protocol'
import { World } from './world'

export interface GameOptions {
  /** ships-go-3d's websocket URL. */
  wsUrl: string
  shipId: string
  /** Shown to others when playing as a guest; ignored for a logged-in user. */
  name: string
  /** The player chose to leave, or the game ended (e.g. disconnected). */
  onExit(): void
}

/** How long, in seconds, a remote ship keeps moving on its last reported velocity. */
const MAX_EXTRAPOLATION = 0.5
/** How quickly a remote ship's drawn position catches up with its reported one, per second. */
const REMOTE_SMOOTHING = 12
const CAMERA_POSITION_SMOOTHING = 6
const CAMERA_ROTATION_SMOOTHING = 8

interface Ship {
  info: PlayerInfo
  group: Group
}

interface RemoteShip extends Ship {
  reported: Vector3
  reportedQuaternion: Quaternion
  velocity: Vector3
  reportedAt: number
}

interface Bullet {
  mesh: Mesh
  position: Vector3
  previous: Vector3
  direction: Vector3
  expiresAt: number
}

/**
 * One game session: a renderer, a websocket and a loop, inside a container
 * element. It depends on nothing but three.js and the DOM - no Vue, no
 * router - so it can be embedded as is in another shell, such as a mobile
 * app's webview.
 *
 * Everything it starts (the animation loop, the socket, listeners, GPU
 * resources) is released by destroy(); the host must call it.
 */
export class Game {
  private readonly root: HTMLDivElement
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(70, 1, 0.5, 20000)
  private readonly hud: Hud
  private readonly input: InputSource
  private readonly connection: Connection
  private readonly effects: Effects
  private readonly resizeObserver: ResizeObserver
  private world: World | null = null

  private settings: Settings | null = null
  private myId = ''
  private me: Ship | null = null
  private readonly flight: FlightState = {
    position: new Vector3(),
    quaternion: new Quaternion(),
    speed: 0,
  }
  private alive = false
  private diedAt = 0
  private killerName: string | null = null
  private readonly remotes = new Map<string, RemoteShip>()

  private readonly myBullets = new Map<string, Bullet>()
  private readonly otherBullets = new Map<string, Bullet>()
  private bulletCounter = 0
  private lastFire = 0
  private lastStateSent = 0

  private frame = 0
  private lastFrameTime = 0
  private destroyed = false
  private ended = false
  private hintTimer: ReturnType<typeof setTimeout>

  constructor(
    container: HTMLElement,
    private readonly options: GameOptions,
  ) {
    this.root = document.createElement('div')
    this.root.className = 'game-root'
    container.appendChild(this.root)

    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.root.appendChild(this.renderer.domElement)

    this.effects = new Effects(this.scene)
    this.hud = new Hud(this.root, {
      onLeave: () => this.exit(),
      onRespawn: () => this.requestRespawn(),
    })
    this.hintTimer = setTimeout(() => this.hud.setHintVisible(false), 15000)
    this.input = new KeyboardMouseInput(this.renderer.domElement)
    window.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('visibilitychange', this.onVisibilityChange)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.root)
    this.resize()

    this.connection = new Connection(options.wsUrl, {
      onOpen: () =>
        this.connection.send({ type: 'join', shipId: options.shipId, name: options.name }),
      onMessage: (message) => this.handle(message),
      onClose: () => this.end('Disconnected from the server.'),
    })

    this.lastFrameTime = performance.now()
    this.frame = requestAnimationFrame(this.loop)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    cancelAnimationFrame(this.frame)
    clearTimeout(this.hintTimer)
    window.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.resizeObserver.disconnect()
    this.connection.close()
    this.input.dispose()
    this.hud.destroy()
    this.effects.dispose()
    this.world?.dispose()
    // Ship meshes share geometries and materials owned by shipMesh.ts,
    // which must outlive this game: only the renderer's GPU copies go.
    this.renderer.dispose()
    this.root.remove()
  }

  // --- Server messages -------------------------------------------------------

  private handle(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        return this.onWelcome(message.id, message.settings, message.players)
      case 'playerJoined':
        this.addRemote(message.player)
        this.hud.message(`${message.player.name} joined`)
        return
      case 'playerLeft': {
        const remote = this.remotes.get(message.id)
        if (remote) this.hud.message(`${remote.info.name} left`)
        return this.removeRemote(message.id)
      }
      case 'snapshot':
        return this.onSnapshot(message.players)
      case 'fire':
        return this.onRemoteFire(message.id, message.p, message.d)
      case 'damage':
        return this.onDamage(message.target, message.bulletId, message.life)
      case 'died':
        return this.onDied(message.target, message.from)
      case 'respawned':
        return this.onRespawned(message.id, message.life, message.p, message.q)
      case 'error':
        return this.end(message.message)
    }
  }

  private onWelcome(id: string, settings: Settings, players: PlayerInfo[]): void {
    this.settings = settings
    this.myId = id
    this.world = new World(this.scene, settings.worldRadius)
    for (const player of players) {
      if (player.id === id) {
        this.me = this.createShip(player)
        this.flight.position.fromArray(player.p)
        this.flight.quaternion.fromArray(player.q)
        this.alive = !player.dead
        this.placeCameraBehind()
      } else {
        this.addRemote(player)
      }
    }
    this.hud.setStatus(null)
    this.hud.setLife(this.me?.info.life ?? 0, settings.maxLife)
  }

  private onSnapshot(states: PlayerState[]): void {
    const now = performance.now()
    for (const state of states) {
      const remote = this.remotes.get(state.id)
      if (!remote) continue
      remote.reported.fromArray(state.p)
      remote.reportedQuaternion.fromArray(state.q)
      remote.velocity.fromArray(state.v)
      remote.reportedAt = now
    }
  }

  private onRemoteFire(id: string, p: V3, d: V3): void {
    // A hidden tab renders nothing, so bullets would only pile up and then
    // all fly at once on return (a lesson from the 2D game).
    if (document.hidden || !this.settings) return
    const position = new Vector3().fromArray(p)
    const direction = new Vector3().fromArray(d).normalize()
    this.otherBullets.set(id, {
      mesh: this.effects.bullet(false, position, direction),
      position,
      previous: position.clone(),
      direction,
      expiresAt: performance.now() + this.settings.bulletTtlMs,
    })
  }

  private onDamage(target: string, bulletId: string, life: number): void {
    const bullet = this.otherBullets.get(bulletId)
    if (bullet) {
      this.effects.releaseBullet(bullet.mesh)
      this.otherBullets.delete(bulletId)
    }
    const ship = target === this.myId ? this.me : this.remotes.get(target)
    if (!ship) return
    ship.info.life = life
    if (ship === this.me && this.settings) this.hud.setLife(life, this.settings.maxLife)
    if (!document.hidden) this.effects.explosion(ship.group.position, 1.5, 0xffe082)
  }

  private onDied(target: string, from: string): void {
    const victim = target === this.myId ? this.me : this.remotes.get(target)
    const killer = from === this.myId ? this.me : this.remotes.get(from)
    if (killer) killer.info.kills++
    if (!victim) return
    victim.info.deaths++
    victim.info.dead = true
    victim.group.visible = false
    if (!document.hidden && this.settings) {
      this.effects.explosion(victim.group.position, this.settings.shipRadius * 3)
    }
    this.hud.message(
      killer ? `${killer.info.name} ✹ ${victim.info.name}` : `${victim.info.name} was destroyed`,
    )
    if (victim === this.me) {
      this.alive = false
      this.diedAt = performance.now()
      this.flight.speed = 0
      this.killerName = killer?.info.name ?? null
    }
  }

  private onRespawned(id: string, life: number, p: V3, q: Q4): void {
    if (id === this.myId && this.me) {
      this.me.info.life = life
      this.me.info.dead = false
      this.flight.position.fromArray(p)
      this.flight.quaternion.fromArray(q)
      this.flight.speed = 0
      this.alive = true
      this.me.group.visible = true
      this.placeCameraBehind()
      this.hud.hideDeath()
      if (this.settings) this.hud.setLife(life, this.settings.maxLife)
      return
    }
    const remote = this.remotes.get(id)
    if (!remote) return
    remote.info.life = life
    remote.info.dead = false
    remote.reported.fromArray(p)
    remote.reportedQuaternion.fromArray(q)
    remote.velocity.set(0, 0, 0)
    remote.reportedAt = performance.now()
    // Appear at the spawn point, rather than sliding there from the wreck.
    remote.group.position.copy(remote.reported)
    remote.group.quaternion.copy(remote.reportedQuaternion)
    remote.group.visible = true
  }

  // --- Ships -----------------------------------------------------------------

  private createShip(info: PlayerInfo): Ship {
    const group = new Group()
    const model = buildShip(info.ship.layers)
    model.scale.setScalar(info.scale)
    group.add(model)
    group.position.fromArray(info.p)
    group.quaternion.fromArray(info.q)
    group.visible = !info.dead
    this.scene.add(group)
    return { info, group }
  }

  private addRemote(info: PlayerInfo): void {
    if (info.id === this.myId || this.remotes.has(info.id)) return
    const ship = this.createShip(info)
    this.remotes.set(info.id, {
      ...ship,
      reported: new Vector3().fromArray(info.p),
      reportedQuaternion: new Quaternion().fromArray(info.q),
      velocity: new Vector3().fromArray(info.v),
      reportedAt: performance.now(),
    })
  }

  private removeRemote(id: string): void {
    const remote = this.remotes.get(id)
    if (!remote) return
    this.scene.remove(remote.group)
    this.remotes.delete(id)
  }

  // --- Loop ------------------------------------------------------------------

  private loop = (time: number): void => {
    if (this.destroyed) return
    this.frame = requestAnimationFrame(this.loop)
    // Capped, so a frame after a long stall (or a background tab) doesn't
    // teleport everything.
    const dt = Math.min((time - this.lastFrameTime) / 1000, 0.1)
    this.lastFrameTime = time
    if (this.settings && this.me) this.update(dt, time, this.settings, this.me)
    this.renderer.render(this.scene, this.camera)
  }

  private update(dt: number, now: number, settings: Settings, me: Ship): void {
    const input = this.input.read(dt)

    if (this.alive) {
      stepFlight(this.flight, input, settings, dt)
      me.group.position.copy(this.flight.position)
      me.group.quaternion.copy(this.flight.quaternion)
      if (input.fire && now - this.lastFire >= settings.fireCooldownMs) this.fire(now, settings)
      if (now - this.lastStateSent >= 1000 / settings.tickRate) this.sendState(now)
    } else {
      const left = (this.diedAt + settings.respawnDelayMs - now) / 1000
      this.hud.showDeath(this.killerName, left)
    }

    this.updateRemotes(dt, now)
    this.updateBullets(dt, now, settings)
    this.effects.update(dt)
    this.updateCamera(dt, settings)
    // The renderer would only refresh this when drawing, after the markers
    // below were projected with last frame's camera.
    this.camera.updateMatrixWorld()
    this.world?.update(this.camera.position)

    this.hud.setSpeed(this.flight.speed)
    this.hud.setBoundaryWarning(this.flight.position.length() > settings.worldRadius * 0.92)
    this.hud.setMarkers(this.markers())
    this.hud.showScoreboard(
      input.scoreboard || !this.alive,
      input.scoreboard || !this.alive ? this.scores() : [],
    )
  }

  private sendState(now: number): void {
    this.lastStateSent = now
    const velocity = velocityOf(this.flight)
    this.connection.send({
      type: 'state',
      p: this.flight.position.toArray() as V3,
      q: this.flight.quaternion.toArray() as Q4,
      v: velocity.toArray() as V3,
    })
  }

  private fire(now: number, settings: Settings): void {
    this.lastFire = now
    const direction = FORWARD.clone().applyQuaternion(this.flight.quaternion)
    const position = this.flight.position
      .clone()
      .addScaledVector(direction, settings.shipRadius * 1.2)
    const id = String(++this.bulletCounter)
    this.myBullets.set(id, {
      mesh: this.effects.bullet(true, position, direction),
      position,
      previous: position.clone(),
      direction,
      expiresAt: now + settings.bulletTtlMs,
    })
    this.connection.send({
      type: 'fire',
      id,
      p: position.toArray() as V3,
      d: direction.toArray() as V3,
    })
  }

  /**
   * Moves every bullet. Our own are also hit-tested against the other ships
   * as drawn here - the shooter's view decides, and the server checks that
   * the claim is plausible before applying any damage.
   */
  private updateBullets(dt: number, now: number, settings: Settings): void {
    const step = settings.bulletSpeed * dt
    for (const [id, bullet] of this.myBullets) {
      bullet.previous.copy(bullet.position)
      bullet.position.addScaledVector(bullet.direction, step)
      bullet.mesh.position.copy(bullet.position)
      let done = now > bullet.expiresAt
      if (!done) {
        for (const [targetId, remote] of this.remotes) {
          if (remote.info.dead) continue
          if (
            segmentHitsSphere(
              bullet.previous,
              bullet.position,
              remote.group.position,
              settings.shipRadius,
            )
          ) {
            this.connection.send({ type: 'hit', bulletId: id, target: targetId })
            done = true
            break
          }
        }
      }
      if (done) {
        this.effects.releaseBullet(bullet.mesh)
        this.myBullets.delete(id)
      }
    }
    for (const [id, bullet] of this.otherBullets) {
      bullet.position.addScaledVector(bullet.direction, step)
      bullet.mesh.position.copy(bullet.position)
      if (now > bullet.expiresAt) {
        this.effects.releaseBullet(bullet.mesh)
        this.otherBullets.delete(id)
      }
    }
  }

  private readonly predicted = new Vector3()

  /** Draws each remote ship where it probably is now, easing towards it. */
  private updateRemotes(dt: number, now: number): void {
    const blend = 1 - Math.exp(-REMOTE_SMOOTHING * dt)
    for (const remote of this.remotes.values()) {
      if (remote.info.dead) continue
      const age = Math.min((now - remote.reportedAt) / 1000, MAX_EXTRAPOLATION)
      this.predicted.copy(remote.reported).addScaledVector(remote.velocity, age)
      remote.group.position.lerp(this.predicted, blend)
      remote.group.quaternion.slerp(remote.reportedQuaternion, blend)
    }
  }

  private readonly cameraTarget = new Vector3()
  private readonly cameraEye = new Vector3()
  private readonly cameraUp = new Vector3()
  private readonly cameraMatrix = new Matrix4()
  private readonly cameraQuaternion = new Quaternion()

  /** A chase camera, above and behind the ship, rolling with it. */
  private updateCamera(dt: number, settings: Settings, snap = false): void {
    if (!this.alive && !snap) return // Watch the wreck from where we were.
    const r = settings.shipRadius
    const q = this.flight.quaternion
    this.cameraEye
      .set(0, r * 1.3, -r * 3.6)
      .applyQuaternion(q)
      .add(this.flight.position)
    this.cameraTarget
      .copy(FORWARD)
      .multiplyScalar(r * 5)
      .applyQuaternion(q)
      .add(this.flight.position)
    this.cameraUp.copy(UP).applyQuaternion(q)
    this.cameraMatrix.lookAt(this.cameraEye, this.cameraTarget, this.cameraUp)
    this.cameraQuaternion.setFromRotationMatrix(this.cameraMatrix)
    if (snap) {
      this.camera.position.copy(this.cameraEye)
      this.camera.quaternion.copy(this.cameraQuaternion)
      return
    }
    this.camera.position.lerp(this.cameraEye, 1 - Math.exp(-CAMERA_POSITION_SMOOTHING * dt))
    this.camera.quaternion.slerp(
      this.cameraQuaternion,
      1 - Math.exp(-CAMERA_ROTATION_SMOOTHING * dt),
    )
  }

  private placeCameraBehind(): void {
    if (this.settings) this.updateCamera(0, this.settings, true)
  }

  private readonly projected = new Vector3()

  /** Screen markers for every live enemy: a label on screen, an arrow at the edge off it. */
  private markers(): Marker[] {
    const width = this.root.clientWidth
    const height = this.root.clientHeight
    const markers: Marker[] = []
    for (const [id, remote] of this.remotes) {
      if (remote.info.dead) continue
      const p = this.projected.copy(remote.group.position)
      p.applyMatrix4(this.camera.matrixWorldInverse)
      const behind = p.z > 0 // Camera space looks down -Z.
      p.applyMatrix4(this.camera.projectionMatrix)
      let x = p.x
      let y = p.y
      if (behind) {
        x = -x
        y = -y
      }
      const onScreen = !behind && Math.abs(x) <= 1 && Math.abs(y) <= 1
      const angle = Math.atan2(-y, x)
      if (!onScreen) {
        // Pin to an ellipse just inside the screen edge.
        x = Math.cos(angle) * 0.9
        y = -Math.sin(angle) * 0.85
      }
      markers.push({
        id,
        name: remote.info.name,
        lifeFraction: this.settings ? remote.info.life / this.settings.maxLife : 1,
        x: ((x + 1) / 2) * width,
        y: ((1 - y) / 2) * height - (onScreen ? 28 : 0),
        onScreen,
        angle,
      })
    }
    return markers
  }

  private scores() {
    const ships: Ship[] = [...(this.me ? [this.me] : []), ...this.remotes.values()]
    return ships
      .map((ship) => ({
        name: ship.info.name,
        kills: ship.info.kills,
        deaths: ship.info.deaths,
        me: ship === this.me,
      }))
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
  }

  // --- Misc ------------------------------------------------------------------

  private requestRespawn(): void {
    if (!this.alive) this.connection.send({ type: 'respawn' })
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Enter' && !this.alive && this.settings) {
      if (performance.now() >= this.diedAt + this.settings.respawnDelayMs) this.requestRespawn()
    }
  }

  // Bullets drawn here move only while frames are rendered; after time in a
  // background tab they would be far from where they should be.
  private onVisibilityChange = (): void => {
    if (document.hidden) return
    for (const bullet of this.otherBullets.values()) this.effects.releaseBullet(bullet.mesh)
    this.otherBullets.clear()
  }

  private end(reason: string): void {
    if (this.ended || this.destroyed) return
    this.ended = true
    this.hud.setStatus(reason)
    setTimeout(() => this.exit(), 2500)
  }

  private exit(): void {
    if (!this.destroyed) this.options.onExit()
  }

  private resize(): void {
    const width = this.root.clientWidth
    const height = this.root.clientHeight
    if (width === 0 || height === 0) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }
}

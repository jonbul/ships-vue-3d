import {
  BufferGeometry,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
  Vector2,
  type Material,
  type WebGLRenderer,
} from 'three'

/** Radar ranges in world units, cycled with +/-. */
export const RADAR_RANGES = [300, 600, 1200, 2400] as const
const DEFAULT_RANGE_INDEX = 1
/** Blips drawn at most; more contacts than this are simply not shown. */
const MAX_BLIPS = 64
const BLIP_SIZE = 0.06

const inverse = new Quaternion()
const canvasSize = new Vector2()

/**
 * Where `target` appears on a radar of the given range, in the radar's unit
 * sphere. The radar turns with the ship (it is the ship's own frame: +Z ahead,
 * +Y up, -X right), so "ahead" is always the same way on screen. Contacts
 * beyond range are pinned to the surface. Returns whether it is in range.
 */
export function toRadarSpace(
  target: Vector3,
  shipPosition: Vector3,
  shipQuaternion: Quaternion,
  range: number,
  out: Vector3,
): boolean {
  out.copy(target).sub(shipPosition).applyQuaternion(inverse.copy(shipQuaternion).invert())
  out.divideScalar(range)
  const length = out.length()
  if (length <= 1) return true
  out.divideScalar(length)
  return false
}

/**
 * A 3D sphere radar, drawn by the game's own renderer into a small viewport
 * in a corner after the main scene: a second WebGL context would be costly,
 * and on phones might not be available at all.
 *
 * Each contact is a blip with a stalk down to the radar's equator, so above
 * and below read at a glance, as in the classic space-sim radars.
 */
export class Radar {
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(32, 1, 0.1, 20)
  private readonly blips: Mesh[] = []
  private readonly stalks: LineSegments
  private readonly stalkPositions = new Float32Array(MAX_BLIPS * 6)
  private readonly blipGeometry = new SphereGeometry(BLIP_SIZE, 10, 8)
  private readonly inRange = new MeshBasicMaterial({ color: 0xff5252 })
  private readonly outOfRange = new MeshBasicMaterial({
    color: 0xff5252,
    transparent: true,
    opacity: 0.4,
  })
  private readonly disposables: Array<BufferGeometry | Material> = []
  private readonly point = new Vector3()
  private rangeIndex = DEFAULT_RANGE_INDEX

  constructor() {
    this.disposables.push(this.blipGeometry, this.inRange, this.outOfRange)

    // Seen from above and behind the ship, so ahead is "up and away".
    this.camera.position.set(0, 1.5, -3.4)
    this.camera.lookAt(0, -0.1, 0)

    const shell = new Mesh(
      this.track(new SphereGeometry(1, 32, 16)),
      this.track(
        new MeshBasicMaterial({
          color: 0x4fc3f7,
          transparent: true,
          opacity: 0.07,
          side: DoubleSide,
          depthWrite: false,
        }),
      ),
    )
    this.scene.add(shell)

    // The equator (the ship's own horizontal plane) and two meridians.
    const ring = (axis: 'x' | 'y' | 'z', opacity: number) => {
      const points: number[] = []
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2
        const [u, v] = [Math.cos(a), Math.sin(a)]
        points.push(...(axis === 'y' ? [u, 0, v] : axis === 'x' ? [0, u, v] : [u, v, 0]))
      }
      const geometry = this.track(new BufferGeometry())
      geometry.setAttribute('position', new Float32BufferAttribute(points, 3))
      const material = this.track(
        new LineBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity }),
      )
      this.scene.add(new LineLoop(geometry, material))
    }
    ring('y', 0.55)
    ring('x', 0.18)
    ring('z', 0.18)

    // A tick from the centre to the front: which way the nose points.
    const tick = this.track(new BufferGeometry())
    tick.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, 1], 3))
    this.scene.add(
      new LineSegments(
        tick,
        this.track(new LineBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.4 })),
      ),
    )

    // Our own ship, at the centre, pointing ahead.
    const ownGeometry = this.track(new ConeGeometry(0.05, 0.14, 8))
    ownGeometry.rotateX(Math.PI / 2)
    this.scene.add(new Mesh(ownGeometry, this.track(new MeshBasicMaterial({ color: 0x4fc3f7 }))))

    const stalkGeometry = this.track(new BufferGeometry())
    stalkGeometry.setAttribute('position', new Float32BufferAttribute(this.stalkPositions, 3))
    this.stalks = new LineSegments(
      stalkGeometry,
      this.track(new LineBasicMaterial({ color: 0xff8a80, transparent: true, opacity: 0.6 })),
    )
    this.stalks.frustumCulled = false
    this.scene.add(this.stalks)
  }

  get range(): number {
    return RADAR_RANGES[this.rangeIndex]!
  }

  zoomIn(): void {
    this.rangeIndex = Math.max(0, this.rangeIndex - 1)
  }

  zoomOut(): void {
    this.rangeIndex = Math.min(RADAR_RANGES.length - 1, this.rangeIndex + 1)
  }

  /** Next range, wrapping round: for a single tap target on phones. */
  cycle(): void {
    this.rangeIndex = (this.rangeIndex + 1) % RADAR_RANGES.length
  }

  /** Places a blip for every contact, relative to our ship. */
  update(shipPosition: Vector3, shipQuaternion: Quaternion, contacts: Iterable<Vector3>): void {
    let count = 0
    for (const contact of contacts) {
      if (count >= MAX_BLIPS) break
      const inRange = toRadarSpace(contact, shipPosition, shipQuaternion, this.range, this.point)
      const blip = this.blip(count)
      blip.position.copy(this.point)
      blip.material = inRange ? this.inRange : this.outOfRange
      blip.visible = true

      const p = this.stalkPositions
      const i = count * 6
      p[i] = p[i + 3] = this.point.x
      p[i + 1] = this.point.y
      p[i + 4] = 0
      p[i + 2] = p[i + 5] = this.point.z
      count++
    }
    for (let i = count; i < this.blips.length; i++) this.blips[i]!.visible = false
    this.stalks.geometry.setDrawRange(0, count * 2)
    this.stalks.geometry.attributes.position!.needsUpdate = true
  }

  /**
   * Draws the radar into a square viewport whose bottom-left corner is at
   * (x, y) CSS pixels from the bottom-left of the canvas. Call it after the
   * main scene has been rendered.
   */
  render(renderer: WebGLRenderer, x: number, y: number, size: number): void {
    const autoClear = renderer.autoClear
    renderer.autoClear = false
    renderer.setScissorTest(true)
    renderer.setScissor(x, y, size, size)
    renderer.setViewport(x, y, size, size)
    renderer.clearDepth()
    renderer.render(this.scene, this.camera)
    renderer.setScissorTest(false)
    // Back to the whole canvas, or the next frame's scene would be drawn
    // into the radar's corner.
    renderer.getSize(canvasSize)
    renderer.setViewport(0, 0, canvasSize.x, canvasSize.y)
    renderer.autoClear = autoClear
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose()
  }

  private blip(index: number): Mesh {
    let blip = this.blips[index]
    if (!blip) {
      blip = new Mesh(this.blipGeometry, this.inRange)
      this.blips.push(blip)
      this.scene.add(blip)
    }
    return blip
  }

  private track<T extends BufferGeometry | Material>(item: T): T {
    this.disposables.push(item)
    return item
  }
}

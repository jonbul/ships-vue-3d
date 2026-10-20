import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Scene,
  Vector3,
} from 'three'

import { FORWARD } from './flight'

const BULLET_LENGTH = 5
const EXPLOSION_SECONDS = 0.9
/** The debris a blast throws, as the 3DS's: how many pieces, how long they fly and how fast. */
const DEBRIS_PER_BLAST = 14
const DEBRIS_SECONDS = 1.4
const DEBRIS_SPEED = 40
const DEBRIS_SIZE = 1.1
const DEBRIS_COLOUR = 0xff9940
/** The sparks of a crash into the world's edge: smaller, faster to fade, in the force field's blue. */
const SPARKS_PER_CRASH = 26
const SPARK_SECONDS = 0.7
const SPARK_SPEED = 45
const SPARK_SIZE = 0.6

/**
 * Bullet and explosion visuals, from pools. A busy fight creates and drops
 * dozens of these a second; reusing meshes (and sharing two geometries) keeps
 * that from turning into garbage collection pauses on a phone.
 */
export class Effects {
  private readonly bulletGeometry = new CylinderGeometry(0.25, 0.25, BULLET_LENGTH, 6)
  private readonly ownBulletMaterial = new MeshBasicMaterial({ color: 0xffe082 })
  private readonly enemyBulletMaterial = new MeshBasicMaterial({ color: 0xff5252 })
  private readonly explosionGeometry = new IcosahedronGeometry(1, 1)
  private readonly freeBullets: Mesh[] = []
  private readonly explosions: Array<{ mesh: Mesh; age: number; size: number }> = []
  private readonly freeExplosions: Mesh[] = []
  private readonly orientation = new Quaternion()
  private readonly pieceGeometry = new BoxGeometry(1, 1, 1)
  private readonly pieces: Array<{
    mesh: Mesh
    velocity: Vector3
    spin: Vector3
    age: number
    seconds: number
    size: number
  }> = []
  private readonly freePieces: Mesh[] = []

  constructor(private readonly scene: Scene) {
    // Cylinders are built along Y; bullets fly along their direction.
    this.bulletGeometry.rotateX(Math.PI / 2)
  }

  bullet(own: boolean, position: Vector3, direction: Vector3): Mesh {
    const mesh = this.freeBullets.pop() ?? new Mesh(this.bulletGeometry)
    mesh.material = own ? this.ownBulletMaterial : this.enemyBulletMaterial
    mesh.position.copy(position)
    mesh.quaternion.copy(this.orientation.setFromUnitVectors(FORWARD, direction))
    this.scene.add(mesh)
    return mesh
  }

  releaseBullet(mesh: Mesh): void {
    this.scene.remove(mesh)
    this.freeBullets.push(mesh)
  }

  /** A flash that grows and fades; `size` is its final radius. */
  explosion(position: Vector3, size: number, color = 0xff8a3d): void {
    const mesh =
      this.freeExplosions.pop() ??
      new Mesh(
        this.explosionGeometry,
        new MeshBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false }),
      )
    ;(mesh.material as MeshBasicMaterial).color.setHex(color)
    mesh.position.copy(position)
    this.scene.add(mesh)
    this.explosions.push({ mesh, age: 0, size })
  }

  /** A ship blowing up: a fireball and debris thrown out from it, tumbling and fading. */
  blast(position: Vector3, size: number): void {
    this.explosion(position, size)
    this.scatter(
      position,
      DEBRIS_PER_BLAST,
      DEBRIS_SPEED,
      DEBRIS_SIZE,
      DEBRIS_SECONDS,
      DEBRIS_COLOUR,
    )
  }

  /** The ship running into the edge: sparks fly from where it struck. */
  sparks(position: Vector3, color: number): void {
    this.scatter(position, SPARKS_PER_CRASH, SPARK_SPEED, SPARK_SIZE, SPARK_SECONDS, color)
  }

  private scatter(
    position: Vector3,
    count: number,
    speed: number,
    size: number,
    seconds: number,
    color: number,
  ): void {
    for (let index = 0; index < count; index++) {
      const mesh =
        this.freePieces.pop() ??
        new Mesh(
          this.pieceGeometry,
          new MeshBasicMaterial({
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
          }),
        )
      ;(mesh.material as MeshBasicMaterial).color.setHex(color)
      mesh.position.copy(position)
      mesh.scale.setScalar(size)
      this.scene.add(mesh)
      this.pieces.push({
        mesh,
        velocity: new Vector3()
          .randomDirection()
          .multiplyScalar(speed * (0.4 + 0.6 * Math.random())),
        spin: new Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        age: 0,
        seconds,
        size,
      })
    }
  }

  private updatePieces(dt: number): void {
    for (let index = this.pieces.length - 1; index >= 0; index--) {
      const piece = this.pieces[index]!
      piece.age += dt
      const left = 1 - piece.age / piece.seconds
      if (left <= 0) {
        this.scene.remove(piece.mesh)
        this.freePieces.push(piece.mesh)
        this.pieces.splice(index, 1)
        continue
      }
      piece.mesh.position.addScaledVector(piece.velocity, dt)
      piece.velocity.multiplyScalar(Math.exp(-1.5 * dt)) // space has no air, but it reads better slowing
      piece.mesh.rotation.x += piece.spin.x * dt
      piece.mesh.rotation.y += piece.spin.y * dt
      piece.mesh.rotation.z += piece.spin.z * dt
      ;(piece.mesh.material as MeshBasicMaterial).opacity = left * left
      piece.mesh.scale.setScalar(piece.size * (0.5 + 0.5 * left))
    }
  }

  update(dt: number): void {
    this.updatePieces(dt)
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i]!
      explosion.age += dt
      const t = explosion.age / EXPLOSION_SECONDS
      if (t >= 1) {
        this.scene.remove(explosion.mesh)
        this.freeExplosions.push(explosion.mesh)
        this.explosions.splice(i, 1)
        continue
      }
      explosion.mesh.scale.setScalar(explosion.size * (0.3 + 0.7 * Math.sqrt(t)))
      ;(explosion.mesh.material as MeshBasicMaterial).opacity = 1 - t
    }
  }

  dispose(): void {
    this.bulletGeometry.dispose()
    this.ownBulletMaterial.dispose()
    this.enemyBulletMaterial.dispose()
    this.explosionGeometry.dispose()
    this.pieceGeometry.dispose()
    for (const { mesh } of this.pieces) (mesh.material as MeshBasicMaterial).dispose()
    for (const mesh of this.freePieces) (mesh.material as MeshBasicMaterial).dispose()
    for (const { mesh } of this.explosions) (mesh.material as MeshBasicMaterial).dispose()
    for (const mesh of this.freeExplosions) (mesh.material as MeshBasicMaterial).dispose()
  }
}

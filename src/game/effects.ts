import {
  AdditiveBlending,
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

  update(dt: number): void {
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
    for (const { mesh } of this.explosions) (mesh.material as MeshBasicMaterial).dispose()
    for (const mesh of this.freeExplosions) (mesh.material as MeshBasicMaterial).dispose()
  }
}

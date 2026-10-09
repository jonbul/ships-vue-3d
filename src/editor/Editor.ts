import {
  ArrowHelper,
  Box3Helper,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Sphere,
  Box3,
  Vector2,
  Vector3,
  WebGLRenderer,
  MathUtils,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'

import { applyPartTransform, createPartMesh } from '@/shared/shipMesh'
import { LIMITS, type Layer, type Vec3 } from '@/shared/shipModel'

export interface PartRef {
  layer: number
  part: number
}

export type GizmoMode = 'translate' | 'rotate' | 'scale'

export interface EditorEvents {
  /** The selected part changed (by a click in the viewport). */
  onSelect(ref: PartRef | null): void
  /** A gizmo drag finished: a good moment to record an undo step. */
  onCommit(): void
}

interface PartMeshes {
  ref: PartRef
  mesh: Mesh
  mirror: Mesh | null
}

const SNAP = { translate: 0.25, rotate: MathUtils.degToRad(15), scale: 0.1 }
/** Pointer travel, in pixels, beyond which a press is a drag, not a click. */
const CLICK_TOLERANCE = 5

/**
 * The 3D editor viewport: renders a ship's layers, lets the user orbit the
 * view, pick a part by clicking it and move/rotate/scale it with a gizmo.
 *
 * It deliberately knows nothing about Vue. It is handed the layers array and
 * writes gizmo edits straight into it; the host calls rebuild() whenever it
 * changed the layers itself. Rendering is on demand only (nothing animates),
 * so an idle editor costs no battery.
 */
export class Editor {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera: PerspectiveCamera
  private readonly orbit: OrbitControls
  private readonly gizmo: TransformControls
  private readonly selectionBox = new Box3Helper(new Box3(), 0xffd54f)
  private readonly raycaster = new Raycaster()
  private readonly resizeObserver: ResizeObserver

  private layers: Layer[] = []
  private meshes: PartMeshes[] = []
  private selected: PartRef | null = null
  private renderQueued = false
  private pointerDown: Vector2 | null = null
  private gizmoUsed = false
  private destroyed = false

  constructor(
    private readonly container: HTMLElement,
    private readonly events: EditorEvents,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(this.renderer.domElement)
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.touchAction = 'none'

    this.scene.background = new Color(0x0a0e17)
    this.scene.add(new HemisphereLight(0xdfe8ff, 0x202030, 1.4))
    const sun = new DirectionalLight(0xffffff, 2)
    sun.position.set(6, 10, 4)
    this.scene.add(sun)

    const grid = new GridHelper(40, 40, 0x3a4766, 0x1c2438)
    this.scene.add(grid)
    // The nose of every ship points along +Z: show it, since it decides
    // which way the ship flies in game.
    const front = new ArrowHelper(new Vector3(0, 0, 1), new Vector3(0, 0, 0), 8, 0x4fc3f7, 1, 0.6)
    this.scene.add(front)

    this.selectionBox.visible = false
    this.scene.add(this.selectionBox)

    this.camera = new PerspectiveCamera(50, 1, 0.1, 1000)
    this.camera.position.set(-10, 7, 12)

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement)
    this.orbit.enableDamping = false
    this.orbit.addEventListener('change', this.requestRender)

    this.gizmo = new TransformControls(this.camera, this.renderer.domElement)
    this.gizmo.setSpace('local')
    this.gizmo.addEventListener('change', this.requestRender)
    this.gizmo.addEventListener('dragging-changed', (event) => {
      this.orbit.enabled = !event.value
      if (event.value) this.gizmoUsed = true
      else this.events.onCommit()
    })
    this.gizmo.addEventListener('objectChange', this.onGizmoChange)
    this.scene.add(this.gizmo.getHelper())

    const canvas = this.renderer.domElement
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointerup', this.onPointerUp)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
  }

  /** Shows these layers (kept by reference; gizmo edits are written into them). */
  setLayers(layers: Layer[]): void {
    this.layers = layers
    this.rebuild()
  }

  /** Recreates every mesh from the layers, keeping the selection if it still exists. */
  rebuild(): void {
    for (const { mesh, mirror } of this.meshes) {
      this.scene.remove(mesh)
      if (mirror) this.scene.remove(mirror)
    }
    this.meshes = []
    this.layers.forEach((layer, layerIndex) => {
      if (!layer.visible) return
      layer.parts.forEach((part, partIndex) => {
        const mesh = createPartMesh(part)
        const mirror = part.mirror ? createPartMesh(part, true) : null
        this.scene.add(mesh)
        if (mirror) this.scene.add(mirror)
        this.meshes.push({ ref: { layer: layerIndex, part: partIndex }, mesh, mirror })
      })
    })
    this.attachGizmo()
    this.requestRender()
  }

  select(ref: PartRef | null): void {
    this.selected = ref
    this.attachGizmo()
    this.requestRender()
  }

  setMode(mode: GizmoMode): void {
    this.gizmo.setMode(mode)
    this.requestRender()
  }

  setSnap(enabled: boolean): void {
    this.gizmo.setTranslationSnap(enabled ? SNAP.translate : null)
    this.gizmo.setRotationSnap(enabled ? SNAP.rotate : null)
    this.gizmo.setScaleSnap(enabled ? SNAP.scale : null)
  }

  /** Points the camera at the selected part, or at the whole ship. */
  focus(): void {
    const target = this.selectedMeshes()?.mesh
    const box = new Box3()
    if (target) box.setFromObject(target)
    else
      for (const { mesh, mirror } of this.meshes) {
        box.expandByObject(mesh)
        if (mirror) box.expandByObject(mirror)
      }
    const sphere = box.isEmpty()
      ? new Sphere(new Vector3(), 5)
      : box.getBoundingSphere(new Sphere())
    const distance = Math.max(sphere.radius, 1) / Math.sin(MathUtils.degToRad(this.camera.fov / 2))
    const direction = this.camera.position.clone().sub(this.orbit.target).normalize()
    this.orbit.target.copy(sphere.center)
    this.camera.position.copy(sphere.center).addScaledVector(direction, distance * 1.1)
    this.orbit.update()
    this.requestRender()
  }

  destroy(): void {
    this.destroyed = true
    this.resizeObserver.disconnect()
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    this.gizmo.detach()
    this.gizmo.dispose()
    this.orbit.dispose()
    // Shared part geometries/materials are deliberately not disposed (see
    // shipMesh.ts); the renderer frees its own GPU copies.
    this.renderer.dispose()
    canvas.remove()
  }

  private selectedMeshes(): PartMeshes | undefined {
    const selected = this.selected
    if (!selected) return undefined
    return this.meshes.find((m) => m.ref.layer === selected.layer && m.ref.part === selected.part)
  }

  private attachGizmo(): void {
    const target = this.selectedMeshes()
    if (target) {
      this.gizmo.attach(target.mesh)
      this.selectionBox.box.setFromObject(target.mesh)
      this.selectionBox.visible = true
    } else {
      this.gizmo.detach()
      this.selectionBox.visible = false
    }
  }

  /** Writes a gizmo edit back into the part, and moves its mirror image along. */
  private onGizmoChange = (): void => {
    const target = this.selectedMeshes()
    if (!target) return
    const part = this.layers[target.ref.layer]?.parts[target.ref.part]
    if (!part) return
    const { position, rotation, scale } = target.mesh
    const limit = LIMITS.coordinate
    part.position = [position.x, position.y, position.z].map((c) =>
      MathUtils.clamp(c, -limit, limit),
    ) as Vec3
    part.rotation = [rotation.x, rotation.y, rotation.z]
    part.scale = [scale.x, scale.y, scale.z].map((c) =>
      MathUtils.clamp(Math.abs(c), LIMITS.minScale, LIMITS.maxScale),
    ) as Vec3
    // Re-apply, so the clamped values are what is shown.
    applyPartTransform(target.mesh, part)
    if (target.mirror) applyPartTransform(target.mirror, part, true)
    this.selectionBox.box.setFromObject(target.mesh)
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.pointerDown = new Vector2(event.clientX, event.clientY)
    this.gizmoUsed = false
  }

  /** A click (not a drag, not a gizmo use) selects the part under the pointer. */
  private onPointerUp = (event: PointerEvent): void => {
    const start = this.pointerDown
    this.pointerDown = null
    if (!start || this.gizmoUsed) return
    if (start.distanceTo(new Vector2(event.clientX, event.clientY)) > CLICK_TOLERANCE) return

    const rect = this.renderer.domElement.getBoundingClientRect()
    const pointer = new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(pointer, this.camera)
    const candidates = this.meshes.flatMap((m) => (m.mirror ? [m.mesh, m.mirror] : [m.mesh]))
    const hit = this.raycaster.intersectObjects(candidates, false)[0]
    const found = hit && this.meshes.find((m) => m.mesh === hit.object || m.mirror === hit.object)
    this.select(found ? found.ref : null)
    this.events.onSelect(this.selected)
  }

  private resize(): void {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (width === 0 || height === 0) return
    this.renderer.setSize(width, height, false)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.requestRender()
  }

  private requestRender = (): void => {
    if (this.renderQueued || this.destroyed) return
    this.renderQueued = true
    requestAnimationFrame(() => {
      this.renderQueued = false
      if (!this.destroyed) this.renderer.render(this.scene, this.camera)
    })
  }
}

import {
  AmbientLight,
  Box3,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three'

import { buildShip } from './shipMesh'
import type { Layer } from './shipModel'

// Every thumbnail on every page is drawn by this one offscreen renderer and
// handed out as an image. Browsers allow only a handful of live WebGL
// contexts (phones fewer), so a canvas per ship card would start losing
// contexts after a dozen ships.
const SIZE = 256

let renderer: WebGLRenderer | null = null
let scene: Scene
let camera: PerspectiveCamera
const cache = new Map<string, string>()

function setup(): WebGLRenderer {
  if (renderer) return renderer
  renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setSize(SIZE, SIZE, false)
  scene = new Scene()
  scene.add(new AmbientLight(0xffffff, 1.2))
  const sun = new DirectionalLight(0xffffff, 2.2)
  sun.position.set(4, 6, 3)
  scene.add(sun)
  camera = new PerspectiveCamera(35, 1, 0.1, 1000)
  return renderer
}

/** A PNG data URL of the ship seen from the front-right, above. */
export function shipThumbnail(layers: Layer[]): string {
  const key = JSON.stringify(layers)
  const cached = cache.get(key)
  if (cached) return cached

  const r = setup()
  const ship = buildShip(layers)
  scene.add(ship)

  const bounds = new Box3().setFromObject(ship)
  const sphere = bounds.isEmpty()
    ? new Sphere(new Vector3(), 1)
    : bounds.getBoundingSphere(new Sphere())
  const distance = Math.max(sphere.radius, 0.5) / Math.sin((camera.fov * Math.PI) / 360)
  camera.position
    .copy(sphere.center)
    .add(new Vector3(-0.6, 0.5, 0.75).normalize().multiplyScalar(distance))
  camera.lookAt(sphere.center)

  r.render(scene, camera)
  const url = r.domElement.toDataURL('image/png')
  scene.remove(ship)
  cache.set(key, url)
  return url
}

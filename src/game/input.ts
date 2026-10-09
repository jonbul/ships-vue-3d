import { clamp, type Controls } from './flight'

export interface InputState extends Controls {
  fire: boolean
  /** Held to show the scoreboard. */
  scoreboard: boolean
}

/**
 * Anything that can fly a ship. Keyboard + mouse is the only one today; a
 * touch implementation (virtual stick + fire button) can be added for phones
 * without the game itself changing.
 */
export interface InputSource {
  /** The controls for this frame. */
  read(dt: number): InputState
  dispose(): void
}

/** How far the mouse must travel, in pixels, to push the virtual stick fully. */
const MOUSE_RANGE = 250
/** How fast the virtual stick re-centres when the mouse stops, per second. */
const MOUSE_RECENTER = 2.5

/**
 * Keyboard and mouse. Clicking the game captures the mouse (pointer lock);
 * moving it then pushes a virtual stick that drifts back to centre, so a
 * small flick is a gentle turn and holding a direction keeps turning.
 */
export class KeyboardMouseInput implements InputSource {
  private readonly keys = new Set<string>()
  private stickX = 0
  private stickY = 0
  private mouseFire = false
  private readonly cleanup: Array<() => void> = []

  constructor(private readonly element: HTMLElement) {
    this.listen(window, 'keydown', this.onKeyDown)
    this.listen(window, 'keyup', this.onKeyUp)
    this.listen(window, 'blur', this.releaseAll)
    this.listen(document, 'visibilitychange', this.releaseAll)
    this.listen(document, 'mousemove', this.onMouseMove)
    this.listen(element, 'mousedown', this.onMouseDown)
    this.listen(window, 'mouseup', this.onMouseUp)
    this.listen(document, 'pointerlockchange', this.onPointerLockChange)
  }

  get locked(): boolean {
    return document.pointerLockElement === this.element
  }

  read(dt: number): InputState {
    const decay = Math.exp(-MOUSE_RECENTER * dt)
    this.stickX *= decay
    this.stickY *= decay
    const axis = (positive: string, negative: string) =>
      (this.keys.has(positive) ? 1 : 0) - (this.keys.has(negative) ? 1 : 0)
    return {
      pitch: clamp(axis('ArrowUp', 'ArrowDown') + this.stickY, -1, 1),
      yaw: clamp(axis('ArrowRight', 'ArrowLeft') + this.stickX, -1, 1),
      roll: axis('KeyD', 'KeyA'),
      throttle: axis('KeyW', 'KeyS'),
      fire: this.keys.has('Space') || this.mouseFire,
      scoreboard: this.keys.has('Tab'),
    }
  }

  dispose(): void {
    for (const remove of this.cleanup) remove()
    this.cleanup.length = 0
    if (this.locked) document.exitPointerLock()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listen(target: EventTarget, type: string, handler: (event: any) => void): void {
    target.addEventListener(type, handler as EventListener)
    this.cleanup.push(() => target.removeEventListener(type, handler as EventListener))
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if ((event.target as HTMLElement | null)?.closest('input, textarea, select')) return
    // Keep the page from scrolling (arrows, space) or tabbing away.
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault()
    }
    this.keys.add(event.code)
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code)
  }

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.locked) return
    this.stickX = clamp(this.stickX + event.movementX / MOUSE_RANGE, -1, 1)
    // Mouse up raises the nose.
    this.stickY = clamp(this.stickY - event.movementY / MOUSE_RANGE, -1, 1)
  }

  private onMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return
    // The first click only captures the mouse; it doesn't fire.
    if (!this.locked) {
      void this.element.requestPointerLock()
      return
    }
    this.mouseFire = true
  }

  private onMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) this.mouseFire = false
  }

  private onPointerLockChange = (): void => {
    if (!this.locked) {
      this.stickX = this.stickY = 0
      this.mouseFire = false
    }
  }

  // A key released while the window had no focus never sends keyup: without
  // this the ship would keep turning or firing forever.
  private releaseAll = (): void => {
    this.keys.clear()
    this.mouseFire = false
  }
}

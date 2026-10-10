import { Euler, Quaternion, Vector3 } from 'three'

const DEG = Math.PI / 180
const Z = new Vector3(0, 0, 1)

const euler = new Euler()
const relative = new Quaternion()
const screenTurn = new Quaternion()
const screenTurnBack = new Quaternion()
const angles = new Euler()

/**
 * The device's orientation as a quaternion, from a `deviceorientation`
 * event's alpha/beta/gamma (degrees). The W3C angles are intrinsic Z-X'-Y''
 * rotations of the device frame (x: right edge, y: top edge, z: out of the
 * screen, all with the device in its natural portrait orientation), which is
 * three.js' 'ZXY' Euler order.
 */
export function deviceQuaternion(
  alpha: number,
  beta: number,
  gamma: number,
  out = new Quaternion(),
): Quaternion {
  euler.set(beta * DEG, gamma * DEG, alpha * DEG, 'ZXY')
  return out.setFromEuler(euler)
}

export interface Tilt {
  /** Radians the top edge of the screen has come towards the player. */
  pitch: number
  /** Radians the screen has turned clockwise, as the player sees it. */
  steer: number
}

/**
 * How far the device has tilted from `neutral` to `now`, in the axes of the
 * screen as the player sees it - whichever way round the phone is held.
 *
 * `screenAngle` is screen.orientation.angle (degrees): the screen's content
 * is rotated that much counter-clockwise from the device's natural
 * orientation, so the screen's right is the device's x axis turned by
 * -screenAngle about z. The relative rotation is re-expressed in that frame
 * (S·R·S⁻¹ with S = Rz(screenAngle)), where pitch is a rotation about the
 * screen's x axis and steering one about z, the axis through the screen.
 */
export function tiltAngles(neutral: Quaternion, now: Quaternion, screenAngle: number): Tilt {
  // The rotation from neutral to now, in the neutral device frame.
  relative.copy(neutral).invert().multiply(now)
  screenTurn.setFromAxisAngle(Z, screenAngle * DEG)
  screenTurnBack.copy(screenTurn).invert()
  relative.premultiply(screenTurn).multiply(screenTurnBack)
  angles.setFromQuaternion(relative, 'XYZ')
  // +x rotation brings the top edge (+y) towards the player (+z); seen from
  // the player (+z), clockwise is a negative rotation about z.
  return { pitch: angles.x, steer: -angles.z }
}

/**
 * Maps a tilt angle to a control axis in [-1, 1]: nothing inside the dead
 * zone (hands are never perfectly still), full deflection at `full`, and a
 * gentle curve in between so small corrections stay small.
 */
export function tiltToAxis(angle: number, deadZone: number, full: number): number {
  const magnitude = Math.abs(angle)
  if (magnitude <= deadZone) return 0
  const t = Math.min(1, (magnitude - deadZone) / (full - deadZone))
  return Math.sign(angle) * (0.4 * t + 0.6 * t * t)
}

/** The screen's rotation from the device's natural orientation, in degrees. */
export function screenAngle(): number {
  const angle = screen.orientation?.angle
  if (typeof angle === 'number') return angle
  // Older iOS Safari only has the deprecated window.orientation.
  const legacy = (window as unknown as { orientation?: number }).orientation
  return typeof legacy === 'number' ? (legacy + 360) % 360 : 0
}

/**
 * Asks for motion-sensor access where the browser requires it (iOS Safari).
 * Must be called from a user gesture (a tap), or iOS refuses without asking.
 * Resolves true where no permission is needed.
 */
export async function requestTiltPermission(): Promise<boolean> {
  const request = (
    globalThis.DeviceOrientationEvent as unknown as
      | { requestPermission?: () => Promise<'granted' | 'denied'> }
      | undefined
  )?.requestPermission
  if (typeof request !== 'function') return typeof DeviceOrientationEvent !== 'undefined'
  try {
    return (await request()) === 'granted'
  } catch {
    return false
  }
}

/**
 * Follows the device's orientation. The first reading after start() (or
 * recenter()) becomes neutral, so the player can hold the phone however is
 * comfortable.
 */
export class TiltSensor {
  private readonly neutral = new Quaternion()
  private readonly current = new Quaternion()
  private hasNeutral = false
  private hasReading = false
  private listening = false

  /** Whether any reading has arrived since start(); false on devices without sensors. */
  get active(): boolean {
    return this.hasReading
  }

  start(): void {
    if (this.listening) return
    this.listening = true
    this.hasReading = false
    this.hasNeutral = false
    window.addEventListener('deviceorientation', this.onOrientation)
  }

  stop(): void {
    this.listening = false
    window.removeEventListener('deviceorientation', this.onOrientation)
  }

  /** Makes the next reading the new neutral position. */
  recenter(): void {
    this.hasNeutral = false
  }

  read(): Tilt {
    if (!this.hasNeutral) return { pitch: 0, steer: 0 }
    return tiltAngles(this.neutral, this.current, screenAngle())
  }

  private onOrientation = (event: DeviceOrientationEvent): void => {
    if (event.alpha === null || event.beta === null || event.gamma === null) return
    deviceQuaternion(event.alpha, event.beta, event.gamma, this.current)
    this.hasReading = true
    if (!this.hasNeutral) {
      this.neutral.copy(this.current)
      this.hasNeutral = true
    }
  }
}

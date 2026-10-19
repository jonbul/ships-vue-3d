import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

import type { PartTexture } from './shipModel'

// The built-in part textures. Each is drawn once, on first use, into a canvas:
// no image files to download, and every texture tiles seamlessly. They are
// light greys, so the part's color tints them (the material multiplies the
// two) and a textured part keeps the color it was given.
//
// Like geometries and materials (see shipMesh.ts), textures are shared and
// never disposed.

const SIZE = 256
const textures = new Map<PartTexture, Texture | null>()

type Draw = (ctx: CanvasRenderingContext2D, random: () => number) => void

/** The texture for a part, or null where there is no canvas (tests). */
export function partTexture(name: PartTexture): Texture | null {
  if (!textures.has(name)) textures.set(name, createTexture(name))
  return textures.get(name)!
}

/** The texture as an image URL, for the editor's texture picker. */
export function textureSwatch(name: PartTexture): string {
  const image = partTexture(name)?.image as HTMLCanvasElement | undefined
  return image ? image.toDataURL() : ''
}

function createTexture(name: PartTexture): Texture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  // Seeded, so a texture looks the same on every screen and every visit.
  DRAW[name](ctx, seededRandom(name.length * 7919 + name.charCodeAt(0)))
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function seededRandom(seed: number): () => number {
  // mulberry32
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const grey = (level: number) => {
  const v = Math.round(Math.max(0, Math.min(1, level)) * 255)
  return `rgb(${v},${v},${v})`
}

/** Calls draw at the 9 offsets that make anything crossing an edge wrap round. */
function wrapped(draw: (dx: number, dy: number) => void): void {
  for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) draw(dx, dy)
}

function fill(ctx: CanvasRenderingContext2D, level: number): void {
  ctx.fillStyle = grey(level)
  ctx.fillRect(0, 0, SIZE, SIZE)
}

/** Faint speckle so flat areas don't look like plastic. */
function grain(ctx: CanvasRenderingContext2D, random: () => number, amount: number): void {
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = random() < 0.5 ? `rgba(0,0,0,${amount})` : `rgba(255,255,255,${amount})`
    ctx.fillRect(Math.floor(random() * SIZE), Math.floor(random() * SIZE), 2, 2)
  }
}

const DRAW: Record<PartTexture, Draw> = {
  // Hull plating: staggered plates of slightly different shades, dark seams,
  // a rivet in every corner.
  panels(ctx, random) {
    fill(ctx, 0.85)
    const rows = 4
    const h = SIZE / rows
    for (let row = 0; row < rows; row++) {
      const w = SIZE / 2
      const offset = row % 2 ? w / 2 : 0
      for (let col = -1; col < 2; col++) {
        const x = col * w + offset
        ctx.fillStyle = grey(0.8 + random() * 0.15)
        ctx.fillRect(x, row * h, w, h)
        ctx.fillStyle = grey(0.45)
        ctx.fillRect(x, row * h, w, 3)
        ctx.fillRect(x, row * h, 3, h)
        ctx.fillStyle = grey(0.6)
        for (const [rx, ry] of [
          [10, 12],
          [w - 10, 12],
          [10, h - 9],
          [w - 10, h - 9],
        ] as const) {
          ctx.beginPath()
          ctx.arc(x + rx, row * h + ry, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    grain(ctx, random, 0.05)
  },

  // Square tiles with thin seams.
  grid(ctx, random) {
    fill(ctx, 0.9)
    const step = SIZE / 4
    ctx.fillStyle = grey(0.55)
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(i * step, 0, 2, SIZE)
      ctx.fillRect(0, i * step, SIZE, 2)
    }
    grain(ctx, random, 0.04)
  },

  // Diagonal hazard stripes.
  stripes(ctx) {
    fill(ctx, 1)
    ctx.fillStyle = grey(0.3)
    const period = SIZE / 4
    for (let i = -4; i < 8; i++) {
      const x = i * period
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + period / 2, 0)
      ctx.lineTo(x + period / 2 + SIZE, SIZE)
      ctx.lineTo(x + SIZE, SIZE)
      ctx.closePath()
      ctx.fill()
    }
  },

  // Carbon fibre: a woven checker of light and dark bands.
  carbon(ctx) {
    const cells = 8
    const c = SIZE / cells
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const across = (x + y) % 2 === 0
        const gradient = across
          ? ctx.createLinearGradient(x * c, 0, x * c + c, 0)
          : ctx.createLinearGradient(0, y * c, 0, y * c + c)
        gradient.addColorStop(0, grey(0.45))
        gradient.addColorStop(0.5, grey(0.75))
        gradient.addColorStop(1, grey(0.45))
        ctx.fillStyle = gradient
        ctx.fillRect(x * c, y * c, c, c)
      }
    }
  },

  // Honeycomb armour.
  hexagons(ctx) {
    fill(ctx, 0.88)
    // 6 columns x 5 rows of hexagons of radius r tile a 9r x 5√3r area,
    // squeezed (by 4%) into the square canvas.
    const r = 1
    const width = 9 * r
    const height = 5 * Math.sqrt(3) * r
    ctx.save()
    ctx.scale(SIZE / width, SIZE / height)
    ctx.strokeStyle = grey(0.5)
    ctx.lineWidth = 0.1
    const hexagon = (cx: number, cy: number) => {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3
        ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
      }
      ctx.closePath()
      ctx.stroke()
    }
    const dy = Math.sqrt(3) * r
    for (let col = -1; col <= 7; col++) {
      for (let row = -1; row <= 6; row++) {
        hexagon(col * 1.5 * r, row * dy + (col % 2 ? dy / 2 : 0))
      }
    }
    ctx.restore()
  },

  // Worn metal: speckle and scratches.
  worn(ctx, random) {
    fill(ctx, 0.82)
    grain(ctx, random, 0.08)
    for (let i = 0; i < 60; i++) {
      const x = random() * SIZE
      const y = random() * SIZE
      const angle = random() * Math.PI
      const length = 10 + random() * 50
      const light = random() < 0.6
      ctx.strokeStyle = light ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 1
      wrapped((dx, dy) => {
        ctx.beginPath()
        ctx.moveTo(x + dx, y + dy)
        ctx.lineTo(x + dx + Math.cos(angle) * length, y + dy + Math.sin(angle) * length)
        ctx.stroke()
      })
    }
  },

  // Camouflage: overlapping blobs in three shades.
  camo(ctx, random) {
    fill(ctx, 0.95)
    for (const level of [0.75, 0.55, 0.4]) {
      ctx.fillStyle = grey(level)
      for (let i = 0; i < 9; i++) {
        const x = random() * SIZE
        const y = random() * SIZE
        const rx = 18 + random() * 30
        const ry = 12 + random() * 20
        const angle = random() * Math.PI
        wrapped((dx, dy) => {
          ctx.beginPath()
          ctx.ellipse(x + dx, y + dy, rx, ry, angle, 0, Math.PI * 2)
          ctx.fill()
        })
      }
    }
  },

  // Rows of portholes, some lit.
  windows(ctx, random) {
    fill(ctx, 0.85)
    const columns = 8
    const rows = 4
    const w = SIZE / columns
    const h = SIZE / rows
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        ctx.fillStyle = random() < 0.4 ? grey(1) : grey(0.25)
        ctx.fillRect(col * w + w * 0.25, row * h + h * 0.3, w * 0.5, h * 0.35)
      }
    }
    grain(ctx, random, 0.04)
  },
}

import './game.css'

export interface HudActions {
  onLeave(): void
  onRespawn(): void
  onRadarTap(): void
}

export interface ScoreRow {
  name: string
  kills: number
  deaths: number
  me: boolean
}

/** A ship to point out: where it is on screen, or the edge it is beyond. */
export interface Marker {
  id: string
  name: string
  lifeFraction: number
  /** Screen position in pixels. */
  x: number
  y: number
  onScreen: boolean
  /** For off-screen markers: the direction to the ship, in radians. */
  angle: number
}

const KILL_FEED_SECONDS = 6
const KILL_FEED_MAX = 5

/**
 * The heads-up display, as plain DOM over the canvas. Player names are typed
 * by strangers, so every piece of text goes in through textContent, never
 * innerHTML.
 */
export class Hud {
  readonly root: HTMLDivElement
  private readonly lifeFill: HTMLDivElement
  private readonly speedText: HTMLSpanElement
  private readonly status: HTMLDivElement
  private readonly warning: HTMLDivElement
  private readonly feed: HTMLDivElement
  private readonly scoreboard: HTMLDivElement
  private readonly scoreBody: HTMLTableSectionElement
  private readonly death: HTMLDivElement
  private readonly deathText: HTMLParagraphElement
  private readonly respawnButton: HTMLButtonElement
  private readonly hint: HTMLDivElement
  private readonly radarLabel: HTMLButtonElement
  private radarLayout = ''
  private readonly markers = new Map<string, HTMLDivElement>()
  private readonly markerLayer: HTMLDivElement

  constructor(container: HTMLElement, actions: HudActions) {
    this.root = el('div', 'hud')
    container.appendChild(this.root)

    this.markerLayer = el('div', 'hud-markers', this.root)

    const top = el('div', 'hud-top', this.root)
    const leave = el('button', 'hud-leave', top)
    leave.textContent = 'Leave'
    leave.addEventListener('click', () => actions.onLeave())

    const gauges = el('div', 'hud-gauges', top)
    const life = el('div', 'hud-life', gauges)
    this.lifeFill = el('div', 'hud-life-fill', life)
    this.speedText = el('span', 'hud-speed', gauges)

    this.feed = el('div', 'hud-feed', this.root)
    el('div', 'hud-crosshair', this.root)

    this.status = el('div', 'hud-status', this.root)
    this.warning = el('div', 'hud-warning', this.root)
    this.warning.textContent = 'Leaving the battle zone'

    this.hint = el('div', 'hud-hint', this.root)
    this.hint.textContent =
      'Click to steer with the mouse · W/S throttle · A/D roll · arrows turn · Space fire · Tab scores · +/- radar range'

    // A button: tapping the radar's caption cycles its range (phones have no
    // +/- keys; it works with a mouse too).
    this.radarLabel = el('button', 'hud-radar-label', this.root)
    this.radarLabel.title = 'Change the radar range (+ / -)'
    this.radarLabel.addEventListener('click', () => actions.onRadarTap())

    this.scoreboard = el('div', 'hud-scoreboard', this.root)
    const table = el('table', '', this.scoreboard)
    const head = el('tr', '', el('thead', '', table))
    for (const title of ['Player', 'Kills', 'Deaths']) el('th', '', head).textContent = title
    this.scoreBody = el('tbody', '', table)

    this.death = el('div', 'hud-death', this.root)
    el('h2', '', this.death).textContent = 'Destroyed'
    this.deathText = el('p', '', this.death)
    this.respawnButton = el('button', 'primary', this.death)
    this.respawnButton.addEventListener('click', () => actions.onRespawn())

    this.warning.hidden = true
    this.scoreboard.hidden = true
    this.death.hidden = true
    this.setStatus('Connecting…')
  }

  setLife(life: number, max: number): void {
    const fraction = Math.max(0, Math.min(1, life / max))
    this.lifeFill.style.width = `${fraction * 100}%`
    this.lifeFill.classList.toggle('low', fraction <= 0.3)
  }

  setSpeed(speed: number): void {
    this.speedText.textContent = `${Math.round(speed)} u/s`
  }

  /** A blocking message (connecting, disconnected…); null hides it. */
  setStatus(text: string | null): void {
    this.status.textContent = text ?? ''
    this.status.hidden = text === null
  }

  setBoundaryWarning(visible: boolean): void {
    this.warning.hidden = !visible
  }

  setHint(text: string): void {
    this.hint.textContent = text
  }

  setHintVisible(visible: boolean): void {
    this.hint.hidden = !visible
  }

  message(text: string): void {
    const line = el('div', 'hud-feed-line', this.feed)
    line.textContent = text
    while (this.feed.children.length > KILL_FEED_MAX) this.feed.firstElementChild?.remove()
    setTimeout(() => line.remove(), KILL_FEED_SECONDS * 1000)
  }

  showScoreboard(visible: boolean, rows: ScoreRow[] = []): void {
    this.scoreboard.hidden = !visible
    if (!visible) return
    this.scoreBody.replaceChildren(
      ...rows.map((row) => {
        const tr = document.createElement('tr')
        if (row.me) tr.className = 'me'
        for (const value of [row.name, String(row.kills), String(row.deaths)]) {
          el('td', '', tr).textContent = value
        }
        return tr
      }),
    )
  }

  /** Shows the death screen; the respawn button unlocks after `seconds`. */
  showDeath(killer: string | null, secondsLeft: number): void {
    this.death.hidden = false
    this.deathText.textContent = killer ? `Shot down by ${killer}` : 'Your ship was destroyed'
    const ready = secondsLeft <= 0
    this.respawnButton.disabled = !ready
    this.respawnButton.textContent = ready
      ? 'Respawn (Enter)'
      : `Respawn in ${Math.ceil(secondsLeft)}`
  }

  hideDeath(): void {
    this.death.hidden = true
  }

  /**
   * Positions the radar's caption next to the radar the game draws in the
   * right-hand corner: above it at the bottom, below it at the top.
   */
  setRadar(size: number, margin: number, atTop: boolean, range: number): void {
    const layout = `${size}:${margin}:${atTop}:${range}`
    if (layout === this.radarLayout) return
    this.radarLayout = layout
    const label = this.radarLabel.style
    label.width = `${size}px`
    label.right = `${margin}px`
    label.top = atTop ? `${margin + size}px` : ''
    label.bottom = atTop ? '' : `${margin + size}px`
    this.radarLabel.textContent = `Radar · ${range} u`
  }

  setMarkers(markers: Marker[]): void {
    const seen = new Set<string>()
    for (const marker of markers) {
      seen.add(marker.id)
      let node = this.markers.get(marker.id)
      if (!node) {
        node = el('div', 'hud-marker', this.markerLayer)
        el('span', 'hud-marker-name', node)
        el('div', 'hud-marker-life', node)
        el('div', 'hud-marker-arrow', node)
        this.markers.set(marker.id, node)
      }
      const [name, life, arrow] = node.children as unknown as [
        HTMLElement,
        HTMLElement,
        HTMLElement,
      ]
      if (name.textContent !== marker.name) name.textContent = marker.name
      life.style.setProperty('--life', String(marker.lifeFraction))
      node.classList.toggle('offscreen', !marker.onScreen)
      node.style.transform = `translate(${marker.x}px, ${marker.y}px)`
      arrow.style.transform = `rotate(${marker.angle}rad)`
    }
    for (const [id, node] of this.markers) {
      if (!seen.has(id)) {
        node.remove()
        this.markers.delete(id)
      }
    }
  }

  destroy(): void {
    this.root.remove()
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (parent) parent.appendChild(node)
  return node
}

import type { Layer } from '@/shared/shipModel'

const MAX_STEPS = 100

/**
 * Undo/redo as whole snapshots of the layers. A ship is at most a few hundred
 * parts, so a snapshot is a few tens of KB: simpler and safer than recording
 * and inverting every kind of edit.
 */
export class History {
  private steps: string[] = []
  private index = -1

  /** Starts over from this state (e.g. after loading a project). */
  reset(layers: Layer[]): void {
    this.steps = [JSON.stringify(layers)]
    this.index = 0
  }

  /** Records the current state, if it differs from the last recorded one. */
  commit(layers: Layer[]): void {
    const snapshot = JSON.stringify(layers)
    if (snapshot === this.steps[this.index]) return
    this.steps = this.steps.slice(0, this.index + 1)
    this.steps.push(snapshot)
    if (this.steps.length > MAX_STEPS) this.steps.shift()
    this.index = this.steps.length - 1
  }

  undo(): Layer[] | null {
    if (!this.canUndo) return null
    this.index--
    return JSON.parse(this.steps[this.index]!)
  }

  redo(): Layer[] | null {
    if (!this.canRedo) return null
    this.index++
    return JSON.parse(this.steps[this.index]!)
  }

  get canUndo(): boolean {
    return this.index > 0
  }

  get canRedo(): boolean {
    return this.index < this.steps.length - 1
  }
}

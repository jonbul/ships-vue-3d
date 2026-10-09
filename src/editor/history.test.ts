import { describe, expect, it } from 'vitest'

import { newLayer, type Layer } from '@/shared/shipModel'
import { History } from './history'

const layers = (name: string): Layer[] => [newLayer(name)]

describe('History', () => {
  it('undoes and redoes', () => {
    const history = new History()
    history.reset(layers('a'))
    history.commit(layers('b'))
    history.commit(layers('c'))

    expect(history.undo()?.[0]?.name).toBe('b')
    expect(history.undo()?.[0]?.name).toBe('a')
    expect(history.canUndo).toBe(false)
    expect(history.redo()?.[0]?.name).toBe('b')
  })

  it('ignores a commit that changes nothing', () => {
    const history = new History()
    history.reset(layers('a'))
    history.commit(layers('a'))
    expect(history.canUndo).toBe(false)
  })

  it('drops the redo branch on a new edit', () => {
    const history = new History()
    history.reset(layers('a'))
    history.commit(layers('b'))
    history.undo()
    history.commit(layers('c'))
    expect(history.canRedo).toBe(false)
    expect(history.undo()?.[0]?.name).toBe('a')
  })
})

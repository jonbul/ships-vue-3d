import { afterEach, describe, expect, it } from 'vitest'

import { newProject, validateProject } from '@/shared/shipModel'
import en from './en'
import es from './es'
import eu from './eu'
import { locale, setLocale, t } from '.'

/** Every key path, with functions as leaves. */
function keys(messages: object, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  )
}

describe('catalogs', () => {
  afterEach(() => setLocale('en'))

  it.each([
    ['es', es],
    ['eu', eu],
  ])('%s has exactly the English keys', (_, messages) => {
    expect(keys(messages).sort()).toEqual(keys(en).sort())
  })

  it('switches the messages with the locale', () => {
    setLocale('eu')
    expect(locale.value).toBe('eu')
    expect(t.value.nav.play).toBe('Jokatu')
    const project = newProject()
    expect(project.layers[0]!.name).toBe('Kaskoa')
    expect(validateProject(project)).toEqual(['Ontziak izen bat behar du.'])
  })
})

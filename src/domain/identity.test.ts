import { describe, expect, it } from 'vitest'
import { withStableIds } from './identity'
import type { Buono } from './types'

const b = (over: Partial<Buono>): Buono => ({
  id: 'x', serie: 'Q', sottoscritto: '1995-04-13', nominale: 1_000_000, valuta: 'ITL', ...over,
})

describe('withStableIds', () => {
  it('derives ids from the data, not the row', () => {
    const first = withStableIds([b({ id: 'r3' }), b({ id: 'r4', serie: 'R' })])
    const again = withStableIds([b({ id: 'r10' }), b({ id: 'r11', serie: 'R' })])
    expect(first.map((x) => x.id)).toEqual(again.map((x) => x.id))
  })

  it('distinguishes identical rows by order', () => {
    const ids = withStableIds([b({}), b({}), b({})]).map((x) => x.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids[0]).toMatch(/#0$/)
    expect(ids[2]).toMatch(/#2$/)
  })
})

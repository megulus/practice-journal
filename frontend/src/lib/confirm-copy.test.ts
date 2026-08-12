import { describe, it, expect } from 'vitest'
import {
  alsoRemoves,
  archiveConfirmCopy,
  count,
  deleteConfirmCopy,
} from './confirm-copy'

describe('count', () => {
  it('pluralizes by the number', () => {
    expect(count(0, 'plan')).toBe('0 plans')
    expect(count(1, 'plan')).toBe('1 plan')
    expect(count(2, 'plan')).toBe('2 plans')
  })

  it('takes an explicit plural for irregular nouns', () => {
    expect(count(2, 'entry', 'entries')).toBe('2 entries')
  })
})

describe('alsoRemoves', () => {
  it('agrees with a count of one', () => {
    expect(alsoRemoves(1, 'block')).toBe('Deleting it also removes its 1 block.')
  })

  it('agrees with a count of many', () => {
    expect(alsoRemoves(2, 'block')).toBe(
      'Deleting it also removes its 2 blocks.',
    )
  })

  it('agrees the contents pronoun too', () => {
    expect(alsoRemoves(1, 'section', { andContents: true })).toBe(
      'Deleting it also removes its 1 section and everything in it.',
    )
    expect(alsoRemoves(3, 'section', { andContents: true })).toBe(
      'Deleting it also removes its 3 sections and everything in them.',
    )
  })

  it('takes an explicit plural', () => {
    expect(alsoRemoves(2, 'entry', { plural: 'entries' })).toBe(
      'Deleting it also removes its 2 entries.',
    )
  })

  // The bug this helper exists to prevent: `count()` pluralized the noun while
  // the verb stayed hardcoded plural, giving "Its 1 block go too."
  it('never disagrees with the number, at any count', () => {
    for (const n of [0, 1, 2, 11]) {
      const singular = n === 1
      expect(alsoRemoves(n, 'block')).toContain(
        singular ? '1 block.' : `${n} blocks.`,
      )
      expect(alsoRemoves(n, 'block', { andContents: true })).toContain(
        singular ? 'everything in it.' : 'everything in them.',
      )
    }
  })
})

describe('deleteConfirmCopy', () => {
  it('names the target in the title and says how permanent it is', () => {
    expect(deleteConfirmCopy('block', 'Scales')).toEqual({
      title: 'Delete “Scales”?',
      message: 'This deletes the block “Scales”. This can’t be undone.',
    })
  })

  it('puts cascade sentences between the lead and the permanence line', () => {
    const { message } = deleteConfirmCopy('instrument', 'Violin', {
      cascade: ['Its 2 plans go too.'],
    })
    expect(message).toBe(
      'This deletes the instrument “Violin”. Its 2 plans go too. ' +
        'This can’t be undone.',
    )
  })

  it('closes with the gentler alternative when there is one', () => {
    const { message } = deleteConfirmCopy('spot', 'Coda run', {
      note: 'Retire it instead.',
    })
    expect(message).toBe(
      'This deletes the spot “Coda run”. This can’t be undone. Retire it instead.',
    )
  })
})

describe('archiveConfirmCopy', () => {
  it('reassures rather than warns, because archiving is recoverable', () => {
    expect(archiveConfirmCopy('plan', 'Morning routine')).toEqual({
      title: 'Archive “Morning routine”?',
      message:
        'This archives the plan “Morning routine”. You can bring it back anytime.',
    })
  })

  it('accepts cascade detail', () => {
    const { message } = archiveConfirmCopy('plan', 'Morning routine', {
      cascade: ['It stops being offered on Today.'],
    })
    expect(message).toBe(
      'This archives the plan “Morning routine”. It stops being offered on ' +
        'Today. You can bring it back anytime.',
    )
  })
})

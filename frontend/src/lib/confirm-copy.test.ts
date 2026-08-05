import { describe, it, expect } from 'vitest'
import { archiveConfirmCopy, count, deleteConfirmCopy } from './confirm-copy'

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

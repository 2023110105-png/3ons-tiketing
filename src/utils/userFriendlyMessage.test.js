import { describe, it, expect } from 'vitest'
import { humanizeUserMessage } from './userFriendlyMessage'

describe('humanizeUserMessage', () => {
  it('maps HTTP status to Indonesian', () => {
    expect(humanizeUserMessage('HTTP 404')).toMatch(/tidak ditemukan/i)
    expect(humanizeUserMessage('HTTP 500')).toMatch(/bermasalah/i)
  })

  it('maps network errors', () => {
    expect(humanizeUserMessage('Failed to fetch')).toMatch(/sambungan/i)
  })

  it('uses fallback for empty input', () => {
    expect(humanizeUserMessage('', { fallback: 'X' })).toBe('X')
    expect(humanizeUserMessage(null, { fallback: 'Y' })).toBe('Y')
  })
})

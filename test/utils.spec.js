import { expect } from 'chai'
import { normalizeStringText } from '../src/utils.js'

describe('normalizeStringText', () => {
  it('removes combining accents after NFD normalization', () => {
    expect(normalizeStringText('João')).to.equal('Joao')
    expect(normalizeStringText('Cafe\u0301')).to.equal('Cafe')
  })

  it('keeps characters available in Windows-1252', () => {
    expect(normalizeStringText('90° € “quote” Œ ß')).to.equal('90° € “quote” Œ ß')
  })

  it('replaces each unsupported Unicode code point with a question mark', () => {
    expect(normalizeStringText('A🧪B字C')).to.equal('A?B?C')
  })
})

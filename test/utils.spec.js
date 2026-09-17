import { expect } from 'chai'
import { removeAccents } from '../src/utils.js'

describe('removeAccents', () => {
  it('should remove accents and degree symbols', () => {
    expect(removeAccents('João 90°')).to.be.equal('Joao 90')
  })
})

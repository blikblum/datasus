import { expect } from 'chai'
import { generateBPA, parseBPA } from '../src/index.js'
import { indexBPARecords, paginateRecords } from '../demo/export-records.js'

const procedure = {
  cns: '552083124090009',
  cbo: '223605',
  code: '0302040030',
  quantity: 1,
  patient: { name: 'Ana Lima', cns: '123456789012345' },
}

const getExport = (procedures = [procedure], options) =>
  generateBPA(
    {
      competence: { year: 2026, month: 7 },
      origin: { cnes: '0001234', name: 'Unidade de teste' },
      procedures,
    },
    options
  )

const index = (text) => indexBPARecords(text, parseBPA(text))

describe('indexBPARecords', () => {
  it('retains order and physical line numbers in a mixed export with blank lines', () => {
    const text = getExport([procedure, { ...procedure, code: '0302040056' }])
      .replace(/\r\n/g, '\n')
      .replace('\n02', '\n\n02')
      .replace('\n03', '\n\n03')
    const records = index(text)

    expect(records.consolidated.map(({ lineNumber }) => lineNumber)).to.deep.equal([3, 4])
    expect(records.individual.map(({ lineNumber }) => lineNumber)).to.deep.equal([6, 7])
    expect(records.individual.map(({ entry }) => entry.code)).to.deep.equal([
      '0302040030',
      '0302040056',
    ])
    expect(records.individual[0].rawLine).to.equal(text.split('\n')[5])
  })

  it('handles individual-only and consolidated-only exports', () => {
    const individual = index(getExport([procedure], { consolidated: false }))
    const consolidated = index(getExport([procedure], { individual: false }))

    expect(individual.individual).to.have.lengthOf(1)
    expect(individual.consolidated).to.deep.equal([])
    expect(individual.individual[0].lineNumber).to.equal(2)
    expect(consolidated.consolidated).to.have.lengthOf(1)
    expect(consolidated.individual).to.deep.equal([])
    expect(consolidated.consolidated[0].lineNumber).to.equal(2)
  })

  it('paginates after 50 records and clamps invalid page requests', () => {
    const procedures = Array.from({ length: 51 }, (_, index) => ({
      ...procedure,
      code: String(index + 1).padStart(10, '0'),
    }))
    const records = index(getExport(procedures, { consolidated: false })).individual

    expect(paginateRecords(records, 1).records).to.have.lengthOf(50)
    expect(paginateRecords(records, 2).records).to.have.lengthOf(1)
    expect(paginateRecords(records, 2).records[0].entry.code).to.equal('0000000051')
    expect(paginateRecords(records, 99).page).to.equal(2)
    expect(paginateRecords([], 1).pageCount).to.equal(1)
  })
})

import { expect } from 'chai'
import { generateBPA, parseBPA, parseBPARaw } from '../src/index.js'
import { indexBPARecords, paginateRecords, parseBPAForInspection } from '../demo/export-records.js'
import { getShiftedBPAExport } from './fixtures/bpa-encoding.js'
import { getValidBPAExport, validProcedure } from './fixtures/bpa-records.js'

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

const index = (text) => indexBPARecords(text, parseBPA(text).records)

describe('indexBPARecords', () => {
  it('associates raw and native entries by group order with their original lines', () => {
    const text =
      '\uFEFF' +
      getExport([procedure, { ...procedure, quantity: 12 }])
        .replace(/\r\n/g, '\n')
        .replace('\n03', '\n\n03')
    const parsed = parseBPA(text).records
    const rawParsed = parseBPARaw(text)
    const records = indexBPARecords(text, parsed, rawParsed)

    for (const group of ['individual', 'consolidated']) {
      records[group].forEach((record, index) => {
        expect(record.entry).to.equal(parsed[group][index])
        expect(record.rawEntry).to.equal(rawParsed[group][index])
        expect(record.rawLine).to.equal(text.split('\n')[record.lineNumber - 1])
      })
    }
    expect(records.individual[1].entry.quantity).to.equal(12)
    expect(records.individual[1].rawEntry.quantity).to.equal('000012')
  })

  it('rejects missing and excess raw entries instead of silently misassociating records', () => {
    const text = getExport()
    const parsed = parseBPA(text).records
    const raw = parseBPARaw(text)
    for (const group of ['individual', 'consolidated']) {
      for (const entries of [[], [...raw[group], raw[group][0]]]) {
        expect(() => indexBPARecords(text, parsed, { ...raw, [group]: entries })).to.throw(
          'Não foi possível associar os registros às linhas da exportação.'
        )
      }
    }
  })

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

describe('parseBPAForInspection', () => {
  it('retains native data and raw strings with an empty error array for valid records', () => {
    const { records, rawRecords, errors } = parseBPAForInspection(getValidBPAExport())
    expect(errors).to.deep.equal([])
    expect(records.individual[0].sheetNumber).to.equal(1)
    expect(rawRecords.individual[0].sheetNumber).to.equal('001')
  })

  it('retains partial native records, shifted raw fields, and the complete original line', () => {
    const { windows1252Text } = getShiftedBPAExport()
    const { records, rawRecords, errors } = parseBPAForInspection(windows1252Text)
    const indexed = indexBPARecords(windows1252Text, records, rawRecords, errors)
    expect(records.individual[0].patient).to.include({ homeless: null, noCpf: null })
    expect(rawRecords.individual[0].patient).to.include({ homeless: '0', noCpf: '5' })
    expect(indexed.individual[0].errors).to.deep.equal(
      errors.filter(({ lineNumber }) => lineNumber === 3)
    )
    expect(indexed.individual[0].rawLine).to.have.lengthOf(355)
    expect(indexed.individual[0].rawLine.slice(351)).to.equal('53NN')
    expect(indexed.individual[0].lineNumber).to.equal(3)
  })

  it('associates native and raw entries after unknown types and short records', () => {
    const valid = getValidBPAExport(undefined, { consolidated: false }).split('\r\n')[1]
    const text = '01#BPA#header\n99unknown\n03short\n\n' + valid
    const { records, rawRecords, errors } = parseBPAForInspection(text)
    const indexed = indexBPARecords(text, records, rawRecords, errors)
    expect(records.individual).to.have.lengthOf(2)
    expect(rawRecords.individual).to.have.lengthOf(2)
    expect(indexed.individual.map(({ lineNumber }) => lineNumber)).to.deep.equal([3, 5])
    expect(indexed.individual[0].entry.sheetNumber).to.equal(null)
    expect(indexed.individual[0].rawEntry.sheetNumber).to.equal('')
    expect(indexed.individual[1].errors).to.deep.equal([])
    expect(errors[0]).to.include({ lineNumber: 2, field: 'type' })
  })

  it('keeps valid native records in a file containing malformed fields and paginates all recognized records', () => {
    const lines = getValidBPAExport(
      Array.from({ length: 51 }, () => validProcedure),
      { consolidated: false }
    ).split('\r\n')
    lines[51] = lines[51].slice(0, 349) + 'X' + lines[51].slice(350)
    const text = lines.join('\n')
    const { records, rawRecords, errors } = parseBPAForInspection(text)
    const indexed = indexBPARecords(text, records, rawRecords, errors).individual
    const page = paginateRecords(indexed, 2)
    expect(records.individual[0].sheetNumber).to.equal(1)
    expect(page.records).to.have.lengthOf(1)
    expect(page.records[0].entry.sheetNumber).to.equal(3)
    expect(page.records[0].entry.patient.homeless).to.equal(null)
    expect(page.records[0].rawEntry.patient.homeless).to.equal('X')
    expect(page.records[0].errors.map(({ field }) => field)).to.include('patient.homeless')
    expect(page.records[0].lineNumber).to.equal(52)
  })
})

import { expect } from 'chai'
import { generateBPA, parseBPA, parseBPARaw } from '../src/index.js'
import { indexBPARecords, paginateRecords, parseBPAForInspection } from '../demo/export-records.js'
import { getShiftedBPAExport } from './fixtures/bpa-encoding.js'

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
  it('associates raw and native entries by group order with their original lines', () => {
    const text =
      '\uFEFF' +
      getExport([procedure, { ...procedure, quantity: 12 }])
        .replace(/\r\n/g, '\n')
        .replace('\n03', '\n\n03')
    const parsed = parseBPA(text)
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
    const parsed = parseBPA(text)
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
  it('inspects overlong Windows-1252 records and retains the complete decoded line', () => {
    const { windows1252Text } = getShiftedBPAExport()
    const { parsed, rawParsed, conversionError } = parseBPAForInspection(windows1252Text)
    const records = indexBPARecords(windows1252Text, parsed, rawParsed)

    expect(conversionError.message).to.equal('Invalid individual entry width at line 3')
    expect(parsed).to.equal(rawParsed)
    expect(parsed.individual[0].patient).to.include({ homeless: '0', noCpf: '5' })
    expect(parsed.consolidated[0].sheetNumber).to.equal('001')
    expect(records.individual[0].lineNumber).to.equal(3)
    expect(records.individual[0].rawLine).to.equal(windows1252Text.split('\r\n')[2])
    expect(records.individual[0].rawLine).to.have.lengthOf(355)
    expect(records.individual[0].rawLine.slice(351)).to.equal('53NN')
  })

  it('retains native and raw values when conversion succeeds', () => {
    const { parsed, rawParsed, conversionError } = parseBPAForInspection(getExport())

    expect(conversionError).to.equal(null)
    expect(parsed.individual[0].sheetNumber).to.equal(1)
    expect(rawParsed.individual[0].sheetNumber).to.equal('001')
    expect(parsed.individual[0].patient.homeless).to.equal(false)
    expect(rawParsed.individual[0].patient.homeless).to.equal('N')
  })

  it('falls back to raw values for the entire file and retains the physical error line', () => {
    const lines = getExport([procedure, procedure]).split('\r\n')
    lines[4] = lines[4].slice(0, 349) + 'X' + lines[4].slice(350)
    const text = lines.join('\n')
    const { parsed, rawParsed, conversionError } = parseBPAForInspection(text)
    const records = indexBPARecords(text, parsed, rawParsed)

    expect(conversionError.message).to.equal('Invalid homeless flag at line 5')
    expect(parsed).to.equal(rawParsed)
    expect(parsed.consolidated[0].quantity).to.equal('000001')
    expect(parsed.individual[0].sheetNumber).to.equal('001')
    expect(parsed.individual[1].patient.homeless).to.equal('X')
    expect(records.individual[1].entry).to.equal(records.individual[1].rawEntry)
    expect(records.individual[1].lineNumber).to.equal(5)
    expect(records.individual[1].rawLine).to.equal(lines[4])
  })

  it('paginates fallback records with their raw values intact', () => {
    const lines = getExport(
      Array.from({ length: 51 }, () => procedure),
      { consolidated: false }
    ).split('\r\n')
    lines[51] = lines[51].slice(0, 349) + 'X' + lines[51].slice(350)
    const text = lines.join('\n')
    const { parsed, rawParsed } = parseBPAForInspection(text)
    const records = indexBPARecords(text, parsed, rawParsed).individual
    const page = paginateRecords(records, 2)

    expect(page.records).to.have.lengthOf(1)
    expect(page.records[0].rawEntry.patient.homeless).to.equal('X')
    expect(page.records[0].entry.sheetNumber).to.equal('003')
    expect(page.records[0].lineNumber).to.equal(52)
  })

  it('still blocks structural errors, even after an invalid native field', () => {
    const line = getExport([procedure], { consolidated: false }).split('\r\n')[1]
    const invalid = line.slice(0, 349) + 'X' + line.slice(350)

    expect(() => parseBPAForInspection(invalid + '\n03short')).to.throw(
      'Invalid individual entry width at line 2'
    )
    expect(() => parseBPAForInspection('99unknown')).to.throw('Unknown BPA record type at line 1')
  })
})

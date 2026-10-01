import { expect } from 'chai'
import { generateBPA, parseBPA, parseBPARaw, parseBPAErrorReport } from '../src/index.js'
import { matchBPAErrors } from '../demo/match-errors.js'
import { parseBPAForInspection } from '../demo/export-records.js'
import { getShiftedBPAExport } from './fixtures/bpa-encoding.js'

const procedure = {
  cns: '552083124090009',
  cbo: '223605',
  code: '0302040030',
  quantity: 1,
  patient: { name: 'Ana Lima', cns: '123456789012345', cpf: '12345678901' },
}

const getExport = (procedures = [procedure]) =>
  generateBPA(
    {
      competence: { year: 2026, month: 7 },
      origin: { cnes: '0001234', name: 'Unidade de teste' },
      procedures,
    },
    { consolidated: true, individual: true }
  )

const reportRow = (message = 'CEP DO USUARIO INVALIDO', professionalCns = procedure.cns) =>
  ['BPAI 08/2026 001/01 0302040030 223605', professionalCns, message].join(' ')

const getOccurrences = (...rows) =>
  parseBPAErrorReport(['CNES : 0001234 Unidade de teste', ...rows].join('\n'))

const match = (occurrences, text) => matchBPAErrors(occurrences, text, parseBPA(text).individual)

describe('matchBPAErrors', () => {
  it('matches reports to overlong Windows-1252 records without realigning their flags', () => {
    const { windows1252Text } = getShiftedBPAExport()
    const { parsed, rawParsed } = parseBPAForInspection(windows1252Text)
    const [result] = matchBPAErrors(
      getOccurrences(reportRow('PESSOA EM SITUACAO DE RUA INVALIDA', '000000000000001')),
      windows1252Text,
      parsed.individual,
      rawParsed.individual
    )

    expect(result.status).to.equal('matched')
    expect(result.matches[0].rawEntry.patient).to.include({ homeless: '0', noCpf: '5' })
    expect(result.matches[0].lineNumber).to.equal(3)
    expect(result.matches[0].rawLine).to.equal(windows1252Text.split('\r\n')[2])
  })

  it('keeps raw values alongside the matched native record', () => {
    const text = getExport()
    const native = parseBPA(text).individual
    const raw = parseBPARaw(text).individual
    const [result] = matchBPAErrors(getOccurrences(reportRow()), text, native, raw)

    expect(result.matches[0].entry).to.equal(native[0])
    expect(result.matches[0].rawEntry).to.equal(raw[0])
    expect(result.matches[0].rawEntry.patient.noCpf).to.equal('N')
  })

  it('matches raw records when invalid flags prevent native conversion', () => {
    const lines = getExport().split('\r\n')
    lines[2] = lines[2].slice(0, 349) + 'X' + lines[2].slice(350)
    const text = lines.join('\n')
    const { parsed, rawParsed } = parseBPAForInspection(text)
    const [result] = matchBPAErrors(
      getOccurrences(reportRow()),
      text,
      parsed.individual,
      rawParsed.individual
    )

    expect(result.status).to.equal('matched')
    expect(result.matches[0].entry).to.equal(result.matches[0].rawEntry)
    expect(result.matches[0].rawEntry.patient.homeless).to.equal('X')
    expect(result.matches[0].lineNumber).to.equal(3)
    expect(result.matches[0].rawLine).to.equal(lines[2])
  })

  it('rejects mismatched raw entry counts', () => {
    const text = getExport()
    const native = parseBPA(text).individual
    const raw = parseBPARaw(text).individual
    for (const entries of [[], [...raw, raw[0]]]) {
      expect(() => matchBPAErrors(getOccurrences(reportRow()), text, native, entries)).to.throw(
        'Não foi possível associar os registros às linhas da exportação.'
      )
    }
  })

  it('links an error to its patient and physical line in a mixed export', () => {
    const text = getExport().replace(/\r\n/g, '\n')
    const withBlankLine = text.replace('\n03', '\n\n03')
    const [result] = match(getOccurrences(reportRow()), withBlankLine)

    expect(result.status).to.equal('matched')
    expect(result.matches).to.have.lengthOf(1)
    expect(result.matches[0].entry.patient).to.include({
      name: 'Ana Lima',
      cns: '123456789012345',
      cpf: '12345678901',
    })
    expect(result.matches[0].lineNumber).to.equal(4)
    expect(result.matches[0].rawLine).to.equal(withBlankLine.split('\n')[3])
  })

  it('keeps separate report occurrences for the same export record', () => {
    const results = match(getOccurrences(reportRow('ERRO A'), reportRow('ERRO B')), getExport())

    expect(results.map(({ status }) => status)).to.deep.equal(['matched', 'matched'])
    expect(results.map(({ occurrence }) => occurrence.occurrence)).to.deep.equal([
      'ERRO A',
      'ERRO B',
    ])
    expect(results[0].matches[0].lineNumber).to.equal(results[1].matches[0].lineNumber)
  })

  it('marks missing records without using a near match', () => {
    const [result] = match(getOccurrences(reportRow('ERRO', '000000000000001')), getExport())

    expect(result.status).to.equal('missing')
    expect(result.matches).to.deep.equal([])
  })

  it('marks duplicate record identities as ambiguous', () => {
    const text = getExport()
    const individualLine = text.split('\r\n')[2]
    const [result] = match(getOccurrences(reportRow()), text + '\r\n' + individualLine)

    expect(result.status).to.equal('ambiguous')
    expect(result.matches.map(({ lineNumber }) => lineNumber)).to.deep.equal([3, 4])
  })
})

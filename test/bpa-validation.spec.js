import { expect } from 'chai'
import { parseBPA, parseBPARaw } from '../src/index.js'
import { getValidBPAExport } from './fixtures/bpa-records.js'

const individual = () => getValidBPAExport(undefined, { consolidated: false }).split('\r\n')[1]
const consolidated = () => getValidBPAExport(undefined, { individual: false }).split('\r\n')[1]
const replace = (line, start, width, value) =>
  line.slice(0, start) + value + line.slice(start + width)
const fieldErrors = (text, field) => parseBPA(text).errors.filter((error) => error.field === field)

describe('BPA layout validation', () => {
  it('returns records and an empty error array for valid layout data', () => {
    const { records, errors } = parseBPA(getValidBPAExport())
    expect(errors).to.deep.equal([])
    expect(records.consolidated).to.have.lengthOf(1)
    expect(records.individual).to.have.lengthOf(1)
    expect(records.individual[0].date).to.deep.equal(new Date(2026, 7, 1))
    expect(records.individual[0].patient.homeless).to.equal(false)
  })

  it('collects all errors and continues into later valid records in physical line order', () => {
    let invalid = replace(individual(), 36, 8, '20260230')
    invalid = replace(invalid, 44, 3, 'ABC')
    invalid = replace(invalid, 85, 3, '131')
    invalid = replace(invalid, 349, 2, 'XY')
    const { records, errors } = parseBPA(
      '01#BPA#ignored\n\n' + invalid + '\n99unknown\n' + individual()
    )
    expect(records.individual).to.have.lengthOf(2)
    expect(records.individual[0]).to.include({ date: null, sheetNumber: null, age: 131 })
    expect(records.individual[0].patient).to.include({ homeless: null, noCpf: null })
    expect(records.individual[1].sheetNumber).to.equal(1)
    expect(
      errors.map(({ lineNumber, field, value }) => ({ lineNumber, field, value }))
    ).to.deep.equal([
      { lineNumber: 3, field: 'date', value: '20260230' },
      { lineNumber: 3, field: 'sheetNumber', value: 'ABC' },
      { lineNumber: 3, field: 'age', value: '131' },
      { lineNumber: 3, field: 'patient.homeless', value: 'X' },
      { lineNumber: 3, field: 'patient.noCpf', value: 'Y' },
      { lineNumber: 4, field: 'type', value: '99' },
    ])
    expect(
      errors.every(({ recordType, message }) => recordType && typeof message === 'string')
    ).to.equal(true)
  })

  it('keeps short and overlong records and reports their full original line', () => {
    const short = individual().slice(0, 44)
    const long = consolidated() + 'EXTRA'
    const { records, errors } = parseBPA(short + '\n' + long + '\n' + individual())
    expect(records.individual).to.have.lengthOf(2)
    expect(records.consolidated).to.have.lengthOf(1)
    expect(records.individual[0].sheetNumber).to.equal(null)
    expect(records.individual[0].patient.homeless).to.equal(null)
    expect(errors.filter(({ field }) => field === null).map(({ value }) => value)).to.deep.equal([
      short,
      long,
    ])
    expect(records.consolidated[0].quantity).to.equal(1)
  })

  const ranges = [
    { field: 'sheetNumber', start: 44, width: 3, valid: ['001', '999'], invalid: ['000'] },
    { field: 'sequenceNumber', start: 47, width: 2, valid: ['01', '99'], invalid: ['00'] },
    { field: 'age', start: 85, width: 3, valid: ['000', '130'], invalid: ['131'] },
    {
      field: 'sequenceNumber',
      start: 24,
      width: 2,
      valid: ['01', '20'],
      invalid: ['00', '21', '99'],
      consolidated: true,
    },
  ]
  ranges.forEach(({ field, start, width, valid, invalid, consolidated: isConsolidated }) => {
    it('checks ' + field + ' boundaries for ' + (isConsolidated ? 'BPAC' : 'BPAI'), () => {
      const line = isConsolidated ? consolidated() : individual()
      valid.forEach((value) =>
        expect(fieldErrors(replace(line, start, width, value), field)).to.deep.equal([])
      )
      invalid.forEach((value) =>
        expect(fieldErrors(replace(line, start, width, value), field)).to.have.lengthOf(1)
      )
    })
  })

  const required = [
    ['cnes', 2, 7],
    ['competence', 9, 6],
    ['cns', 15, 15],
    ['cbo', 30, 6],
    ['sheetNumber', 44, 3],
    ['sequenceNumber', 47, 2],
    ['code', 49, 10],
    ['age', 85, 3],
    ['quantity', 88, 6],
    ['patient.race', 150, 2],
  ]
  required.forEach(([field, start, width]) => {
    it('requires ' + field + ' without omitting its record', () => {
      const { records, errors } = parseBPA(replace(individual(), start, width, ' '.repeat(width)))
      expect(records.individual).to.have.lengthOf(1)
      expect(errors).to.deep.include({
        lineNumber: 1,
        recordType: '03',
        field,
        value: '',
        message: 'Required field',
      })
    })
  })

  const numericFields = [
    ['cnes', 2, 7],
    ['cns', 15, 15],
    ['code', 49, 10],
    ['patient.cns', 59, 15],
    ['patient.ibge', 75, 6],
    ['character', 94, 2],
    ['authorization', 96, 13],
    ['patient.ethnicity', 152, 4],
    ['patient.nationality', 156, 3],
    ['serviceCode', 159, 3],
    ['classification', 162, 3],
    ['sequenceCode', 165, 8],
    ['areaCode', 173, 4],
    ['maintainerCnpj', 177, 14],
    ['patient.cep', 191, 8],
    ['patient.placeCode', 199, 3],
    ['patient.phone', 277, 11],
    ['nationalId', 328, 10],
    ['patient.cpf', 338, 11],
  ]
  numericFields.forEach(([field, start, width]) => {
    it('validates digits for ' + field, () => {
      expect(
        fieldErrors(replace(individual(), start, width, 'A'.padEnd(width, ' ')), field).some(
          ({ message }) => message === 'Must contain only digits'
        )
      ).to.equal(true)
    })
  })

  it('preserves numeric identifiers and leading zeros even when they are invalid', () => {
    const { records, errors } = parseBPA(replace(individual(), 15, 15, 'A00000000000001'))
    expect(records.individual[0].cns).to.equal('A00000000000001')
    expect(records.individual[0].nationalId).to.equal('0000000007')
    expect(errors.map(({ field }) => field)).to.include('cns')
  })

  it('checks zero and space padding without discarding convertible values', () => {
    const result = parseBPA(replace(individual(), 44, 3, ' 01'))
    expect(result.records.individual[0].sheetNumber).to.equal(1)
    expect(result.errors[0].field).to.equal('sheetNumber')
    expect(
      fieldErrors(replace(individual(), 202, 30, ' Rua Teste'.padEnd(30, ' ')), 'patient.address')
    ).to.have.lengthOf(1)
    expect(fieldErrors(replace(individual(), 15, 15, '1'.padEnd(15, ' ')), 'cns')).to.have.lengthOf(
      1
    )
  })

  it('validates competence months and calendar dates, including leap years', () => {
    for (const value of ['202600', '202613', '000008', '2026AB']) {
      expect(
        fieldErrors(replace(individual(), 9, 6, value), 'competence').length
      ).to.be.greaterThan(0)
    }
    expect(fieldErrors(replace(individual(), 36, 8, '20240229'), 'date')).to.deep.equal([])
    for (const value of ['20230229', '20260431', '20260001', '00000101', 'ABCDEFGH']) {
      const { records, errors } = parseBPA(replace(individual(), 36, 8, value))
      expect(records.individual[0].date).to.equal(null)
      expect(errors.map(({ field }) => field)).to.include('date')
    }
  })

  it('accepts blank optional dates, flags, numeric fields, and text', () => {
    let line = replace(individual(), 36, 8, ' '.repeat(8))
    line = replace(line, 142, 8, ' '.repeat(8))
    line = replace(line, 349, 2, '  ')
    const { records, errors } = parseBPA(line)
    expect(errors).to.deep.equal([])
    expect(records.individual[0].date).to.equal(null)
    expect(records.individual[0].patient).to.include({
      birthDate: null,
      homeless: null,
      noCpf: null,
    })
    expect(parseBPARaw(line).individual[0].patient).to.include({ homeless: '', noCpf: '' })
  })

  it('checks all declared domains without external code-table lookups', () => {
    for (const value of ['BPA', 'PNI', 'SIE', 'SIB', 'MIN', 'PAC', 'SCL', 'EXT']) {
      expect(fieldErrors(replace(individual(), 109, 3, value), 'origin')).to.deep.equal([])
      expect(fieldErrors(replace(consolidated(), 45, 3, value), 'origin')).to.deep.equal([])
    }
    for (const value of ['01', '02', '03', '04', '05', '99']) {
      expect(fieldErrors(replace(individual(), 150, 2, value), 'patient.race')).to.deep.equal([])
    }
    for (const [field, start, width, value] of [
      ['origin', 109, 3, 'XXX'],
      ['patient.race', 150, 2, '06'],
      ['patient.gender', 74, 1, 'X'],
      ['patient.homeless', 349, 1, '0'],
      ['patient.noCpf', 350, 1, '5'],
    ])
      expect(fieldErrors(replace(individual(), start, width, value), field)).to.have.lengthOf(1)
    expect(fieldErrors(replace(individual(), 30, 6, 'AB1234'), 'cbo')).to.deep.equal([])
    for (const field of ['patient.homeless', 'patient.noCpf']) {
      const start = field === 'patient.homeless' ? 349 : 350
      for (const value of ['S', 'N'])
        expect(fieldErrors(replace(individual(), start, 1, value), field)).to.deep.equal([])
    }
  })

  it('accepts INE, ethnicity, and flags independently of competence', () => {
    let line = replace(individual(), 150, 2, '05')
    line = replace(line, 152, 4, '1234')
    line = replace(line, 349, 2, 'SS')
    for (const competence of ['201001', '202608']) {
      expect(parseBPA(replace(line, 9, 6, competence)).errors).to.deep.equal([])
    }
  })

  it('permits blank INE for any competence', () => {
    const line = replace(individual(), 328, 10, ' '.repeat(10))
    for (const competence of ['201001', '202608']) {
      const result = parseBPA(replace(line, 9, 6, competence))
      expect(result.errors).to.deep.equal([])
      expect(result.records.individual[0].nationalId).to.equal('')
    }
  })

  it('enforces the ethnicity/race condition', () => {
    const line = replace(individual(), 152, 4, '1234')
    expect(
      fieldErrors(line, 'patient.ethnicity').some(({ message }) => message.includes('patient.race'))
    ).to.equal(true)
    expect(fieldErrors(replace(line, 150, 2, '05'), 'patient.ethnicity')).to.deep.equal([])
  })

  it('rejects patient CPF and CNS together while preserving both identifiers', () => {
    const both = replace(individual(), 59, 15, '000000000000002')
    const { records, errors } = parseBPA(both)
    expect(errors).to.deep.equal([
      {
        lineNumber: 1,
        recordType: '03',
        field: 'patient.cpf',
        value: '12345678901',
        message: 'Must be blank when patient.cns is supplied',
      },
    ])
    expect(records.individual[0].patient).to.include({
      cns: '000000000000002',
      cpf: '12345678901',
    })
    expect(parseBPARaw(both).individual[0].patient).to.include({
      cns: '000000000000002',
      cpf: '12345678901',
    })
  })

  it('accepts patient CPF alone, CNS alone, or neither identifier', () => {
    const cpfOnly = individual()
    const neither = replace(cpfOnly, 338, 11, ' '.repeat(11))
    const cnsOnly = replace(neither, 59, 15, '000000000000002')
    for (const line of [cpfOnly, cnsOnly, neither]) {
      expect(parseBPA(line).errors).to.deep.equal([])
    }
  })

  it('reports the CPF/CNS conflict alongside field errors in layout order', () => {
    let line = replace(individual(), 59, 15, 'A00000000000002')
    line = replace(line, 338, 11, 'A2345678901')
    line = replace(line, 349, 1, 'X')
    const { errors } = parseBPA(line + '\n' + individual())
    expect(
      errors.map(({ lineNumber, field, message }) => ({ lineNumber, field, message }))
    ).to.deep.equal([
      { lineNumber: 1, field: 'patient.cns', message: 'Must contain only digits' },
      { lineNumber: 1, field: 'patient.cpf', message: 'Must contain only digits' },
      {
        lineNumber: 1,
        field: 'patient.cpf',
        message: 'Must be blank when patient.cns is supplied',
      },
      { lineNumber: 1, field: 'patient.homeless', message: 'Expected one of: S, N' },
    ])
  })

  it('checks alphanumeric patient names while leaving other text unrestricted', () => {
    expect(
      fieldErrors(replace(individual(), 112, 30, 'João Teste 2'.padEnd(30, ' ')), 'patient.name')
    ).to.deep.equal([])
    expect(
      fieldErrors(replace(individual(), 112, 30, 'Paciente@Teste'.padEnd(30, ' ')), 'patient.name')
    ).to.have.lengthOf(1)
    expect(
      fieldErrors(
        replace(individual(), 202, 30, 'Rua-Teste, nº 2'.padEnd(30, ' ')),
        'patient.address'
      )
    ).to.deep.equal([])
    expect(
      fieldErrors(replace(individual(), 288, 40, 'invalid email'.padEnd(40, ' ')), 'patient.email')
    ).to.deep.equal([])
  })

  it('does not validate headers and retains CRLF, LF, CR, BOM, and entry-only support', () => {
    const line = individual()
    for (const separator of ['\r\n', '\n', '\r']) {
      const result = parseBPA('\uFEFF01#BPA#invalid header' + separator + separator + line)
      expect(result.errors).to.deep.equal([])
      expect(result.records).to.deep.equal(parseBPA(line).records)
    }
  })
})

import { expect } from 'chai'
import { differenceInYears } from 'date-fns'
import { generateBPA, parseBPA, parseBPARaw } from '../src/index.js'
import { getShiftedBPAExport } from './fixtures/bpa-encoding.js'

const birthDate = new Date(1990, 3, 2)
const procedureDate = new Date(2020, 0, 20)
const procedure = {
  cns: '009876543210987',
  cbo: '223505',
  date: procedureDate,
  code: '03.02.04.005-6',
  cid: 'E11',
  quantity: 12,
  character: 2,
  authorization: '000123',
  origin: 'PNI',
  serviceCode: 7,
  classification: 9,
  nationalId: 7,
  patient: {
    cns: '001234567890123',
    gender: 'F',
    ibge: '355030',
    name: 'Ana Líma',
    birthDate,
    race: 2,
    ethnicity: '1234',
    nationality: 21,
    cep: 123,
    placeCode: 5,
    address: 'Rua Árvore',
    addressComplement: 'Ap 2',
    addressNumber: '10',
    addressDistrict: 'Centro',
    phone: '(11) 9999-7777',
    email: 'ana@example.com',
    cpf: '00123456789',
    homeless: true,
  },
}

const getExport = (procedures = [procedure], options) =>
  generateBPA(
    {
      origin: { name: 'Hospital Teste', cnes: 1234 },
      competence: { year: 2020, month: 0 },
      procedures,
    },
    options
  )

describe('parseBPA', () => {
  it('parses every consolidated and individual field from a mixed export', () => {
    const result = parseBPA(getExport()).records
    const age = differenceInYears(new Date(), birthDate)

    expect(result.consolidated).to.deep.equal([
      {
        type: '02',
        cnes: '0001234',
        competence: '202001',
        cbo: '223505',
        sheetNumber: 1,
        sequenceNumber: 1,
        code: '0302040056',
        age,
        quantity: 12,
        origin: 'PNI',
      },
    ])

    expect(result.individual).to.deep.equal([
      {
        type: '03',
        cnes: '0001234',
        competence: '202001',
        cns: '009876543210987',
        cbo: '223505',
        date: procedureDate,
        sheetNumber: 1,
        sequenceNumber: 1,
        code: '0302040056',
        cid: 'E11',
        age,
        quantity: 12,
        character: '02',
        authorization: '000123',
        origin: 'PNI',
        serviceCode: '007',
        classification: '009',
        sequenceCode: '',
        areaCode: '',
        maintainerCnpj: '',
        nationalId: '0000000007',
        patient: {
          cns: '',
          gender: 'F',
          ibge: '355030',
          name: 'Ana Lima',
          birthDate,
          race: '02',
          ethnicity: '1234',
          nationality: '021',
          cep: '00000123',
          placeCode: '005',
          address: 'Rua Arvore',
          addressComplement: 'Ap 2',
          addressNumber: '10',
          addressDistrict: 'Centro',
          phone: '1199997777',
          email: 'ana@example.com',
          cpf: '00123456789',
          homeless: true,
          noCpf: false,
        },
      },
    ])
  })

  it('preserves fields that the generator leaves blank', () => {
    const line = getExport([procedure], { consolidated: false }).split('\r\n')[1]
    const edited = line.slice(0, 165) + 'SEQ00001' + '1234' + '00123456789012' + line.slice(191)
    const { individual } = parseBPA(edited).records

    expect(individual[0].sequenceCode).to.equal('SEQ00001')
    expect(individual[0].areaCode).to.equal('1234')
    expect(individual[0].maintainerCnpj).to.equal('00123456789012')
  })

  it('supports individual-only and consolidated-only exports', () => {
    const individual = parseBPA(getExport([procedure], { consolidated: false })).records
    const consolidated = parseBPA(getExport([procedure], { individual: false })).records

    expect(individual.consolidated).to.deep.equal([])
    expect(individual.individual).to.have.length(1)
    expect(consolidated.consolidated).to.have.length(1)
    expect(consolidated.individual).to.deep.equal([])
  })

  it('keeps entry order and sheet positions', () => {
    const procedures = Array.from({ length: 21 }, (_, index) => ({
      ...procedure,
      code: String(index + 1).padStart(10, '0'),
    }))
    const result = parseBPA(getExport(procedures)).records

    expect(result.consolidated.map((entry) => entry.code)).to.deep.equal(
      procedures.map((entry) => entry.code)
    )
    expect(result.individual.map((entry) => entry.code)).to.deep.equal(
      procedures.map((entry) => entry.code)
    )
    expect(result.consolidated[19].sequenceNumber).to.equal(20)
    expect(result.consolidated[20].sheetNumber).to.equal(2)
    expect(result.individual[20].sequenceNumber).to.equal(1)
  })

  it('represents blank text and dates without losing generated defaults', () => {
    const { individual } = parseBPA(
      getExport([{ code: '03.02.04.005-6' }], { consolidated: false })
    ).records
    const entry = individual[0]

    expect(entry.cns).to.equal('')
    expect(entry.date).to.equal(null)
    expect(entry.quantity).to.equal(0)
    expect(entry.character).to.equal('01')
    expect(entry.patient.name).to.equal('')
    expect(entry.patient.birthDate).to.equal(null)
    expect(entry.patient.race).to.equal('99')
    expect(entry.patient.nationality).to.equal('010')
    expect(entry.patient.cpf).to.equal('')
    expect(entry.patient.homeless).to.equal(false)
    expect(entry.patient.noCpf).to.equal(true)
  })

  it('accepts LF, a BOM, extra blank lines, and entry-only input', () => {
    const exportText = getExport().replace(/\r\n/g, '\n')
    const withBlankLines = '\uFEFF' + exportText + '\n\n'
    const entryLines = exportText.split('\n').slice(1).join('\n')

    expect(parseBPA(withBlankLines).records).to.deep.equal(parseBPA(entryLines).records)
    expect(parseBPA('')).to.deep.equal({
      records: { consolidated: [], individual: [] },
      errors: [],
    })
  })

  it('collects unknown types and width errors while keeping recognized records', () => {
    const result = parseBPA('01#BPA#header\n99unknown\n02short\n03short')
    expect(result.records.consolidated).to.have.lengthOf(1)
    expect(result.records.individual).to.have.lengthOf(1)
    expect(
      result.errors
        .filter(({ field }) => field === 'type' || field === null)
        .map(({ lineNumber, field }) => ({ lineNumber, field }))
    ).to.deep.equal([
      { lineNumber: 2, field: 'type' },
      { lineNumber: 3, field: null },
      { lineNumber: 4, field: null },
    ])
    expect(result.records.individual[0].sheetNumber).to.equal(null)
  })

  it('uses null for invalid dates, numbers, and flags without stopping', () => {
    const line = getExport([procedure], { consolidated: false }).split('\r\n')[1]
    const edited =
      line.slice(0, 36) +
      '20200230' +
      'ABC' +
      line.slice(47, 142) +
      '19901302' +
      line.slice(150, 349) +
      'X' +
      line.slice(350)
    const { records, errors } = parseBPA(edited)
    expect(records.individual[0]).to.include({ date: null, sheetNumber: null })
    expect(records.individual[0].patient).to.include({ birthDate: null, homeless: null })
    expect(errors.map(({ field }) => field)).to.include.members([
      'date',
      'sheetNumber',
      'patient.birthDate',
      'patient.homeless',
    ])
    expect(() => parseBPA()).to.throw(TypeError)
  })
})

describe('parseBPARaw', () => {
  it('extracts Windows-1252 byte positions from overlong records without an option', () => {
    const { utf8Text, windows1252Text } = getShiftedBPAExport()
    expect(utf8Text.split('\r\n')[2]).to.have.lengthOf(351)
    expect(windows1252Text.split('\r\n')[2]).to.have.lengthOf(355)
    expect(parseBPARaw(utf8Text).individual[0].patient).to.include({ homeless: 'N', noCpf: 'N' })
    expect(parseBPARaw(windows1252Text).individual[0].patient).to.include({
      homeless: '0',
      noCpf: '5',
    })
    const { records, errors } = parseBPA(windows1252Text)
    expect(records.individual[0].patient).to.include({ homeless: null, noCpf: null })
    expect(errors.some(({ lineNumber, field }) => lineNumber === 3 && field === null)).to.equal(
      true
    )
    expect(windows1252Text.split('\r\n')[2].slice(351)).to.equal('53NN')
  })

  it('ignores extra characters after consolidated entries', () => {
    const text = getExport([procedure], { individual: false })
    expect(parseBPARaw(text + 'EXTRA')).to.deep.equal(parseBPARaw(text))
    expect(parseBPA(text + 'EXTRA').errors.some(({ field }) => field === null)).to.equal(true)
  })

  it('extracts short records with empty strings for missing slices', () => {
    const result = parseBPARaw('02short\n03short')
    expect(result.consolidated[0]).to.include({
      type: '02',
      cnes: 'short',
      sheetNumber: '',
      quantity: '',
    })
    expect(result.individual[0]).to.include({ type: '03', cnes: 'short', date: '', quantity: '' })
    expect(result.individual[0].patient).to.include({
      cns: '',
      birthDate: '',
      homeless: '',
      noCpf: '',
    })
  })

  it('returns all fields as trimmed strings without losing zeros, dates, or flags', () => {
    const text = getExport()
    const native = parseBPA(text).records
    const raw = parseBPARaw(text)
    const age = String(differenceInYears(new Date(), birthDate)).padStart(3, '0')

    expect(raw).to.deep.equal({
      consolidated: [
        {
          ...native.consolidated[0],
          sheetNumber: '001',
          sequenceNumber: '01',
          age,
          quantity: '000012',
        },
      ],
      individual: [
        {
          ...native.individual[0],
          date: '20200120',
          sheetNumber: '001',
          sequenceNumber: '01',
          age,
          quantity: '000012',
          patient: {
            ...native.individual[0].patient,
            birthDate: '19900402',
            homeless: 'S',
            noCpf: 'N',
          },
        },
      ],
    })
    for (const entry of [...raw.consolidated, ...raw.individual]) {
      const { patient, ...fields } = entry
      Object.values({ ...fields, ...patient }).forEach((value) => expect(value).to.be.a('string'))
    }
    expect(raw.individual[0].patient.name).to.equal('Ana Lima')
    expect(raw.individual[0].cns).to.equal('009876543210987')
  })

  it('represents all blank fields, including dates, as empty strings', () => {
    const { individual } = parseBPARaw(
      getExport([{ code: '03.02.04.005-6' }], { consolidated: false })
    )
    expect(individual[0]).to.include({ date: '', cns: '', sequenceCode: '', quantity: '000000' })
    expect(individual[0].patient).to.include({
      name: '',
      birthDate: '',
      cpf: '',
      homeless: 'N',
      noCpf: 'S',
    })
  })

  const invalidFields = [
    { start: 36, end: 44, value: '20200230', field: 'date', error: 'date' },
    { start: 44, end: 47, value: 'ABC', field: 'sheetNumber', error: 'sheet number' },
    { start: 47, end: 49, value: '  ', field: 'sequenceNumber', error: 'sequence number' },
    { start: 88, end: 94, value: '00A012', field: 'quantity', error: 'quantity' },
    {
      start: 142,
      end: 150,
      value: '19901302',
      field: 'birthDate',
      error: 'birth date',
      patient: true,
    },
    { start: 349, end: 350, value: 'X', field: 'homeless', error: 'homeless flag', patient: true },
    { start: 350, end: 351, value: 'X', field: 'noCpf', error: 'no CPF flag', patient: true },
  ]
  invalidFields.forEach(({ start, end, value, field, patient }) => {
    it('exposes ' + field + ' while native parsing reports its error', () => {
      const line = getExport([procedure], { consolidated: false }).split('\r\n')[1]
      const text = '01#BPA#header\n\n' + line.slice(0, start) + value + line.slice(end)
      const entry = parseBPARaw(text).individual[0]

      expect((patient ? entry.patient : entry)[field]).to.equal(value.trim())
      expect(parseBPA(text).errors).to.deep.include({
        lineNumber: 3,
        recordType: '03',
        field: patient ? 'patient.' + field : field,
        value: value.trim(),
        message:
          field === 'sequenceNumber'
            ? 'Required field'
            : field === 'date' || field === 'birthDate'
            ? 'Invalid date; expected YYYYMMDD'
            : field === 'homeless' || field === 'noCpf'
            ? 'Expected one of: S, N'
            : 'Must contain only digits',
      })
    })
  })

  it('exposes invalid consolidated numeric values', () => {
    const line = getExport([procedure], { individual: false }).split('\r\n')[1]
    const text = line.slice(0, 21) + 'ABC' + line.slice(24)

    expect(parseBPARaw(text).consolidated[0].sheetNumber).to.equal('ABC')
    expect(parseBPA(text).errors).to.deep.include({
      lineNumber: 1,
      recordType: '02',
      field: 'sheetNumber',
      value: 'ABC',
      message: 'Must contain only digits',
    })
  })

  it('preserves order, sheet positions, and single-type exports', () => {
    const procedures = Array.from({ length: 21 }, (_, index) => ({
      ...procedure,
      code: String(index + 1).padStart(10, '0'),
    }))
    const result = parseBPARaw(getExport(procedures))
    for (const group of ['individual', 'consolidated']) {
      expect(result[group].map((entry) => entry.code)).to.deep.equal(procedures.map((p) => p.code))
      expect(result[group][19].sequenceNumber).to.equal('20')
      expect(result[group][20]).to.include({ sheetNumber: '002', sequenceNumber: '01' })
    }
    expect(parseBPARaw(getExport([procedure], { consolidated: false })).consolidated).to.deep.equal(
      []
    )
    expect(parseBPARaw(getExport([procedure], { individual: false })).individual).to.deep.equal([])
  })

  it('supports all line endings, BOMs, headers, blank lines, and entry-only input', () => {
    const text = getExport()
    const expected = parseBPARaw(text.split('\r\n').slice(1).join('\n'))
    for (const separator of ['\r\n', '\n', '\r']) {
      expect(
        parseBPARaw('\uFEFF' + text.split('\r\n').join(separator) + separator.repeat(2))
      ).to.deep.equal(expected)
    }
    expect(parseBPARaw('')).to.deep.equal({ consolidated: [], individual: [] })
  })

  it('retains decoded Unicode text without changing subsequent field positions', () => {
    const line = getExport([procedure], { consolidated: false }).split('\r\n')[1]
    const text = line.slice(0, 203) + 'Á' + line.slice(204)
    const entry = parseBPARaw(text).individual[0]

    expect(entry.patient.address).to.equal('RÁa Arvore')
    expect(entry.patient.homeless).to.equal('S')
    expect(entry.patient.noCpf).to.equal('N')
  })

  it('rejects unsupported input and unknown record types', () => {
    expect(() => parseBPARaw()).to.throw(TypeError, 'BPA export must be a string')
    expect(() => parseBPARaw('01#BPA#header\n\n99unknown')).to.throw(
      'Unknown BPA record type at line 3'
    )
  })
})

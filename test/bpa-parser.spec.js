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
    const result = parseBPA(getExport())
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
          cns: '001234567890123',
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
    const { individual } = parseBPA(edited)

    expect(individual[0].sequenceCode).to.equal('SEQ00001')
    expect(individual[0].areaCode).to.equal('1234')
    expect(individual[0].maintainerCnpj).to.equal('00123456789012')
  })

  it('supports individual-only and consolidated-only exports', () => {
    const individual = parseBPA(getExport([procedure], { consolidated: false }))
    const consolidated = parseBPA(getExport([procedure], { individual: false }))

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
    const result = parseBPA(getExport(procedures))

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
    )
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

    expect(parseBPA(withBlankLines)).to.deep.equal(parseBPA(entryLines))
    expect(parseBPA('')).to.deep.equal({ consolidated: [], individual: [] })
  })

  it('reports unknown types and incorrect widths with line numbers', () => {
    expect(() => parseBPA('01#BPA#header\n99unknown')).to.throw('Unknown BPA record type at line 2')
    expect(() => parseBPA('02short')).to.throw('Invalid consolidated entry width at line 1')
    expect(() => parseBPA('03short')).to.throw('Invalid individual entry width at line 1')
  })

  it('rejects invalid dates, numeric positions, and flags', () => {
    const line = getExport([procedure], { consolidated: false }).split('\r\n')[1]
    const invalidDate = line.slice(0, 36) + '20200230' + line.slice(44)
    const invalidBirthDate = line.slice(0, 142) + '19901302' + line.slice(150)
    const invalidSheet = line.slice(0, 44) + 'ABC' + line.slice(47)
    const invalidFlag = line.slice(0, 349) + 'X' + line.slice(350)

    expect(() => parseBPA(invalidDate)).to.throw('Invalid date at line 1')
    expect(() => parseBPA(invalidBirthDate)).to.throw('Invalid birth date at line 1')
    expect(() => parseBPA(invalidSheet)).to.throw('Invalid sheet number at line 1')
    expect(() => parseBPA(invalidFlag)).to.throw('Invalid homeless flag at line 1')
    expect(() => parseBPA()).to.throw(TypeError)
  })
})

describe('parseBPARaw', () => {
  it('inspects Windows-1252 byte positions in overlong records only when requested', () => {
    const { utf8Text, windows1252Text } = getShiftedBPAExport()
    const utf8Line = utf8Text.split('\r\n')[2]
    const ansiLine = windows1252Text.split('\r\n')[2]

    expect(utf8Line).to.have.lengthOf(351)
    expect(ansiLine).to.have.lengthOf(355)
    expect(parseBPARaw(utf8Text).individual[0].patient).to.include({ homeless: 'N', noCpf: 'N' })
    expect(() => parseBPARaw(windows1252Text)).to.throw('Invalid individual entry width at line 3')
    expect(() => parseBPARaw(windows1252Text, { allowExtraCharacters: false })).to.throw(
      'Invalid individual entry width at line 3'
    )
    expect(() => parseBPA(windows1252Text)).to.throw('Invalid individual entry width at line 3')

    const raw = parseBPARaw(windows1252Text, { allowExtraCharacters: true })
    expect(raw.individual[0].patient).to.include({ homeless: '0', noCpf: '5' })
    expect(ansiLine.slice(351)).to.equal('53NN')
  })

  it('also allows extra characters after consolidated entries without changing their fields', () => {
    const text = getExport([procedure], { individual: false })
    const overflow = text + 'EXTRA'

    expect(() => parseBPARaw(overflow)).to.throw('Invalid consolidated entry width at line 2')
    expect(() => parseBPA(overflow)).to.throw('Invalid consolidated entry width at line 2')
    expect(parseBPARaw(overflow, { allowExtraCharacters: true })).to.deep.equal(parseBPARaw(text))
  })

  it('still rejects short records and unknown types when extra characters are allowed', () => {
    const options = { allowExtraCharacters: true }
    const lines = getExport().split('\r\n')

    expect(() => parseBPARaw('\n' + lines[1].slice(0, -1), options)).to.throw(
      'Invalid consolidated entry width at line 2'
    )
    expect(() => parseBPARaw('\n' + lines[2].slice(0, -1), options)).to.throw(
      'Invalid individual entry width at line 2'
    )
    expect(() => parseBPARaw('\n99unknown', options)).to.throw('Unknown BPA record type at line 2')
    expect(() => parseBPARaw(undefined, options)).to.throw(TypeError, 'BPA export must be a string')
  })

  it('returns all fields as trimmed strings without losing zeros, dates, or flags', () => {
    const text = getExport()
    const native = parseBPA(text)
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
    { start: 350, end: 351, value: ' ', field: 'noCpf', error: 'no CPF flag', patient: true },
  ]
  invalidFields.forEach(({ start, end, value, field, error, patient }) => {
    it('exposes an invalid ' + field + ' while native parsing still rejects it', () => {
      const line = getExport([procedure], { consolidated: false }).split('\r\n')[1]
      const text = '01#BPA#header\n\n' + line.slice(0, start) + value + line.slice(end)
      const entry = parseBPARaw(text).individual[0]

      expect((patient ? entry.patient : entry)[field]).to.equal(value.trim())
      expect(() => parseBPA(text)).to.throw('Invalid ' + error + ' at line 3')
    })
  })

  it('exposes invalid consolidated numeric values', () => {
    const line = getExport([procedure], { individual: false }).split('\r\n')[1]
    const text = line.slice(0, 21) + 'ABC' + line.slice(24)

    expect(parseBPARaw(text).consolidated[0].sheetNumber).to.equal('ABC')
    expect(() => parseBPA(text)).to.throw('Invalid sheet number at line 1')
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

  it('rejects unsupported input, unknown record types, and incorrect widths', () => {
    expect(() => parseBPARaw()).to.throw(TypeError, 'BPA export must be a string')
    expect(() => parseBPARaw('01#BPA#header\n\n99unknown')).to.throw(
      'Unknown BPA record type at line 3'
    )
    expect(() => parseBPARaw('\n02short')).to.throw('Invalid consolidated entry width at line 2')
    expect(() => parseBPARaw('\n03short')).to.throw('Invalid individual entry width at line 2')
    const line = getExport([procedure], { consolidated: false }).split('\r\n')[1]
    expect(() => parseBPARaw(line + 'X')).to.throw('Invalid individual entry width at line 1')
  })
})

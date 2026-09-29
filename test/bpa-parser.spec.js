import { expect } from 'chai'
import { differenceInYears } from 'date-fns'
import { generateBPA, parseBPA } from '../src/index.js'

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
    const { individual } = parseBPA(getExport([{ code: '03.02.04.005-6' }], { consolidated: false }))
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
    expect(() => parseBPA('01#BPA#header\n99unknown')).to.throw(
      'Unknown BPA record type at line 2'
    )
    expect(() => parseBPA('02short')).to.throw(
      'Invalid consolidated entry width at line 1'
    )
    expect(() => parseBPA('03short')).to.throw(
      'Invalid individual entry width at line 1'
    )
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

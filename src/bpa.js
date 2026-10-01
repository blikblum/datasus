import { normalizeNumberText, padStartNumber, normalizeStringText } from './utils.js'
import { differenceInYears, format } from 'date-fns'

const ENTRIES_PER_SHEET = 20
const THREE_BLANKS = '   '
const EIGHT_BLANKS = '        '
const TEN_BLANKS = '          '
const ELEVEN_BLANKS = '           '
const EMPTY_DATE = EIGHT_BLANKS

const LINE_SEPARATOR = '\r\n'

const formatCompetence = (competence) => {
  const date = competence instanceof Date ? competence : new Date(competence.year, competence.month)

  return format(date, 'yyyyMM')
}

const getHeader = (
  competence,
  origin,
  destination,
  appInfo,
  { lineCount, sheetCount, controlAccumulator }
) => {
  const controlCode = controlAccumulator % 1111
  const header = [
    '01#BPA#',
    formatCompetence(competence),
    padStartNumber(lineCount, 6, '0').slice(0, 6),
    padStartNumber(sheetCount, 6, '0').slice(0, 6),
    `${controlCode}`.padStart(4, '0').slice(0, 4),
    `${normalizeStringText(origin.name)}`.padEnd(30, ' ').slice(0, 30),
    `${origin.abbrev || ''}`.padEnd(6, ' ').slice(0, 6),
    normalizeNumberText(origin.cnpj || origin.cpf)
      .padStart(14, '0')
      .slice(0, 14),
    `${destination.name || ''}`.padEnd(40, ' ').slice(0, 40),
    (destination.indicator || '').slice(0, 1),
    appInfo.padEnd(10, ' ').slice(0, 10),
  ].join('')

  return header
}

const getConsolidatedEntry = (procedure, competence, origin, index) => {
  const { patient = {} } = procedure
  const sheetNumber = Math.trunc(index / ENTRIES_PER_SHEET) + 1
  const sequentialNumber = (index % ENTRIES_PER_SHEET) + 1
  const age = patient.birthDate ? differenceInYears(new Date(), patient.birthDate) : 0
  const entry = [
    '02',
    padStartNumber(origin.cnes, 7, '0').slice(0, 7),
    formatCompetence(competence),
    `${procedure.cbo || ''}`.padStart(6, ' ').slice(0, 6),
    padStartNumber(sheetNumber, 3, '0'),
    padStartNumber(sequentialNumber, 2, '0'),
    normalizeNumberText(procedure.code).padStart(10, '0').slice(0, 10),
    padStartNumber(age, 3, '0').slice(0, 3),
    padStartNumber(procedure.quantity, 6, '0').slice(0, 6),
    (procedure.origin || 'BPA').padStart(3, ' ').slice(0, 3),
  ].join('')

  return entry
}

const getIndividualEntry = (procedure, competence, origin, index) => {
  const { patient = {} } = procedure
  const sheetNumber = Math.trunc(index / ENTRIES_PER_SHEET) + 1
  const sequentialNumber = (index % ENTRIES_PER_SHEET) + 1
  const age = patient.birthDate ? differenceInYears(new Date(), patient.birthDate) : 0
  const birthDate = patient.birthDate ? format(patient.birthDate, 'yyyyMMdd') : EMPTY_DATE
  const date = procedure.date ? format(procedure.date, 'yyyyMMdd') : EMPTY_DATE
  const entry = [
    '03',
    padStartNumber(normalizeNumberText(origin.cnes), 7, '0').slice(0, 7),
    formatCompetence(competence),
    `${procedure.cns || ''}`.padStart(15, ' ').slice(0, 15),
    `${procedure.cbo || ''}`.padStart(6, ' ').slice(0, 6),
    date,
    padStartNumber(sheetNumber, 3, '0').slice(0, 3),
    padStartNumber(sequentialNumber, 2, '0').slice(0, 2),
    normalizeNumberText(procedure.code).padStart(10, '0').slice(0, 10),
    `${patient.cns || ''}`.padStart(15, ' ').slice(0, 15),
    (patient.gender || ' ').slice(0, 1).slice(0, 1),
    `${patient.ibge || ''}`.padEnd(6, ' ').slice(0, 6),
    `${procedure.cid || ''}`.padEnd(4, ' ').slice(0, 4),
    padStartNumber(age, 3, '0').slice(0, 3),
    padStartNumber(procedure.quantity, 6, '0').slice(0, 6),
    padStartNumber(procedure.character || 1, 2, '0').slice(0, 2),
    `${procedure.authorization || ''}`.padEnd(13, ' ').slice(0, 13),
    (procedure.origin || 'BPA').padStart(3, ' ').slice(0, 3),
    `${normalizeStringText(patient.name)}`.padEnd(30, ' ').slice(0, 30),
    birthDate,
    padStartNumber(patient.race || 99, 2, '0').slice(0, 2),
    `${patient.ethnicity || ''}`.padEnd(4, ' ').slice(0, 4),
    padStartNumber(patient.nationality || 10, 3, '0').slice(0, 3),
    `${procedure.serviceCode || THREE_BLANKS}`.padStart(3, '0').slice(0, 3), // service code
    `${procedure.classification || THREE_BLANKS}`.padStart(3, '0').slice(0, 3), // classification code
    EIGHT_BLANKS, // sequence code
    ' '.repeat(4), // area code
    ' '.repeat(14), // maintainer cnpj
    `${patient.cep || EIGHT_BLANKS}`.padStart(8, '0').slice(0, 8),
    `${patient.placeCode || THREE_BLANKS}`.padStart(3, '0').slice(0, 3),
    `${normalizeStringText(patient.address)}`.padEnd(30, ' ').slice(0, 30),
    `${normalizeStringText(patient.addressComplement)}`.padEnd(10, ' ').slice(0, 10),
    `${patient.addressNumber || ''}`.padEnd(5, ' ').slice(0, 5),
    `${normalizeStringText(patient.addressDistrict)}`.padEnd(30, ' ').slice(0, 30),
    normalizeNumberText(patient.phone).padEnd(11, ' ').slice(0, 11),
    `${patient.email || ''}`.padEnd(40, ' ').slice(0, 40),
    padStartNumber(procedure.nationalId || TEN_BLANKS, 10, '0').slice(0, 10),
    patient.cpf || ELEVEN_BLANKS,
    patient.homeless ? 'S' : 'N', // situação de rua
    patient.cpf ? 'N' : 'S', // sem CPF
  ].join('')

  return entry
}

export const generateBPA = (
  { procedures = [], origin = {}, destination = {}, competence = {}, appInfo = '' } = {},
  { consolidated = true, individual = true } = {}
) => {
  const stats = { lineCount: 0, sheetCount: 0, controlAccumulator: 0 }

  const consolidatedEntries = consolidated
    ? procedures.map((procedure, index) => {
        return getConsolidatedEntry(procedure, competence, origin, index)
      })
    : []

  stats.lineCount += consolidatedEntries.length
  stats.sheetCount += Math.ceil(consolidatedEntries.length / ENTRIES_PER_SHEET)

  const individualEntries = individual
    ? procedures.map((procedure, index) => {
        const codeText = normalizeNumberText(procedure.code)
        const code = parseInt(codeText, 10)
        const quantity = procedure.quantity || 1
        stats.controlAccumulator += code + quantity
        return getIndividualEntry(procedure, competence, origin, index)
      })
    : []

  stats.lineCount += individualEntries.length
  stats.sheetCount += Math.ceil(individualEntries.length / ENTRIES_PER_SHEET)

  const header = getHeader(competence, origin, destination, appInfo, stats)

  const content = [header]
  if (consolidated) {
    content.push(consolidatedEntries.join(LINE_SEPARATOR))
  }
  if (individual) {
    content.push(individualEntries.join(LINE_SEPARATOR))
  }

  return content.join(LINE_SEPARATOR)
}

const parseNumber = (value, field, lineNumber) => {
  if (!/^\d+$/.test(value)) {
    throw new Error('Invalid ' + field + ' at line ' + lineNumber)
  }

  return Number(value)
}

const parseDate = (value, field, lineNumber) => {
  if (!value) return null

  if (!/^\d{8}$/.test(value)) {
    throw new Error('Invalid ' + field + ' at line ' + lineNumber)
  }

  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6))
  const day = Number(value.slice(6, 8))
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(0, 0, 0, 0)

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error('Invalid ' + field + ' at line ' + lineNumber)
  }

  return date
}

const parseFlag = (value, field, lineNumber) => {
  if (value !== 'S' && value !== 'N') {
    throw new Error('Invalid ' + field + ' at line ' + lineNumber)
  }

  return value === 'S'
}

const createEntryReader = (line) => {
  let position = 0

  return (width) => {
    const value = line.slice(position, position + width).trim()
    position += width
    return value
  }
}

const nativeParsers = { number: parseNumber, date: parseDate, flag: parseFlag }
const keepString = (value) => value
const rawParsers = { number: keepString, date: keepString, flag: keepString }

const parseConsolidatedEntry = (line, lineNumber, parsers) => {
  const read = createEntryReader(line)

  return {
    type: read(2),
    cnes: read(7),
    competence: read(6),
    cbo: read(6),
    sheetNumber: parsers.number(read(3), 'sheet number', lineNumber),
    sequenceNumber: parsers.number(read(2), 'sequence number', lineNumber),
    code: read(10),
    age: parsers.number(read(3), 'age', lineNumber),
    quantity: parsers.number(read(6), 'quantity', lineNumber),
    origin: read(3),
  }
}

const parseIndividualEntry = (line, lineNumber, parsers) => {
  const read = createEntryReader(line)
  const entry = { type: read(2), cnes: read(7), competence: read(6) }
  const patient = {}

  entry.cns = read(15)
  entry.cbo = read(6)
  entry.date = parsers.date(read(8), 'date', lineNumber)
  entry.sheetNumber = parsers.number(read(3), 'sheet number', lineNumber)
  entry.sequenceNumber = parsers.number(read(2), 'sequence number', lineNumber)
  entry.code = read(10)
  patient.cns = read(15)
  patient.gender = read(1)
  patient.ibge = read(6)
  entry.cid = read(4)
  entry.age = parsers.number(read(3), 'age', lineNumber)
  entry.quantity = parsers.number(read(6), 'quantity', lineNumber)
  entry.character = read(2)
  entry.authorization = read(13)
  entry.origin = read(3)
  patient.name = read(30)
  patient.birthDate = parsers.date(read(8), 'birth date', lineNumber)
  patient.race = read(2)
  patient.ethnicity = read(4)
  patient.nationality = read(3)
  entry.serviceCode = read(3)
  entry.classification = read(3)
  entry.sequenceCode = read(8)
  entry.areaCode = read(4)
  entry.maintainerCnpj = read(14)
  patient.cep = read(8)
  patient.placeCode = read(3)
  patient.address = read(30)
  patient.addressComplement = read(10)
  patient.addressNumber = read(5)
  patient.addressDistrict = read(30)
  patient.phone = read(11)
  patient.email = read(40)
  entry.nationalId = read(10)
  patient.cpf = read(11)
  patient.homeless = parsers.flag(read(1), 'homeless flag', lineNumber)
  patient.noCpf = parsers.flag(read(1), 'no CPF flag', lineNumber)
  entry.patient = patient

  return entry
}

const parseEntries = (text, parsers, allowExtraCharacters = false) => {
  if (typeof text !== 'string') {
    throw new TypeError('BPA export must be a string')
  }

  const entries = { consolidated: [], individual: [] }

  text.split(/\r\n|\n|\r/).forEach((rawLine, index) => {
    const line = rawLine.replace(/^\uFEFF/, '')
    if (!line.trim() || line.startsWith('01#BPA#')) return

    const type = line.slice(0, 2)
    const lineNumber = index + 1
    if (type === '02') {
      if (line.length < 48 || (!allowExtraCharacters && line.length !== 48)) {
        throw new Error('Invalid consolidated entry width at line ' + lineNumber)
      }
      entries.consolidated.push(parseConsolidatedEntry(line, lineNumber, parsers))
    } else if (type === '03') {
      if (line.length < 351 || (!allowExtraCharacters && line.length !== 351)) {
        throw new Error('Invalid individual entry width at line ' + lineNumber)
      }
      entries.individual.push(parseIndividualEntry(line, lineNumber, parsers))
    } else {
      throw new Error('Unknown BPA record type at line ' + lineNumber)
    }
  })

  return entries
}

export const parseBPA = (text) => parseEntries(text, nativeParsers)

export const parseBPARaw = (text, { allowExtraCharacters = false } = {}) =>
  parseEntries(text, rawParsers, allowExtraCharacters)

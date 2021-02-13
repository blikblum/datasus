import { normalizeNumberText, padStartNumber } from './utils.js'
import { differenceInYears, format } from 'date-fns'

const ENTRIES_PER_SHEET = 20
const THREE_BLANKS = '   '
const EIGHT_BLANKS = '        '
const TEN_BLANKS = '          '
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
    `${origin.name || ''}`.padEnd(30, ' ').slice(0, 30),
    `${origin.abbrev || ''}`.padEnd(6, ' ').slice(0, 6),
    normalizeNumberText(origin.cnpj || origin.cpf).padStart(14, '0').slice(0, 14),
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
    padStartNumber(origin.cnes, 7, '0').slice(0, 7),
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
    `${patient.name || ''}`.padEnd(30, ' ').slice(0, 30),
    birthDate,
    padStartNumber(patient.race || 99, 2, '0').slice(0, 2),
    `${patient.ethnicity || ''}`.padEnd(4, ' ').slice(0, 4),
    padStartNumber(patient.nationality || 10, 3, '0').slice(0, 3),
    THREE_BLANKS, // service code
    THREE_BLANKS, // classification code
    EIGHT_BLANKS, // sequence code
    ' '.repeat(4), // area code
    ' '.repeat(14), // maintainer cnpj
    `${patient.cep || EIGHT_BLANKS}`.padStart(8, '0').slice(0, 8),
    `${patient.placeCode || THREE_BLANKS}`.padStart(3, '0').slice(0, 3),
    `${patient.address || ''}`.padEnd(30, ' ').slice(0, 30),
    `${patient.addressComplement || ''}`.padEnd(10, ' ').slice(0, 10),
    `${patient.addressNumber || ''}`.padEnd(5, ' ').slice(0, 5),
    `${patient.addressDistrict || ''}`.padEnd(30, ' ').slice(0, 30),
    normalizeNumberText(patient.phone).padEnd(11, ' ').slice(0, 11),
    `${patient.email || ''}`.padEnd(40, ' ').slice(0, 40),
    padStartNumber(procedure.nationalId || TEN_BLANKS, 10, '0').slice(0, 10),
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

  return [
    header,
    consolidatedEntries.join(LINE_SEPARATOR),
    individualEntries.join(LINE_SEPARATOR),
  ].join(LINE_SEPARATOR)
}

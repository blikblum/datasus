import { normalizeNumberText, padStartNumber } from './utils.js'
import { differenceInYears, format } from 'date-fns'

const ENTRY_PER_SHEET = 20
const THREE_BLANKS = '   '
const EIGHT_BLANKS = '        '
const EMPTY_DATE = EIGHT_BLANKS

const getHeader = (competence, origin, destination, appInfo, { lineCount, pageCount }) => {
  const controlCode = 1111
  const header = [
    '01#BPA#',
    padStartNumber(competence.year, 4, '0'),
    padStartNumber(competence.month, 2, '0'),
    padStartNumber(lineCount, 6, '0'),
    padStartNumber(pageCount, 6, '0'),
    `${controlCode}`,
    origin.name.padEnd(30, ' '),
    origin.abbrev.padEnd(6, ' '),
    origin.cnpj.padStart(14, '0'),
    destination.name.padEnd(40, ' '),
    destination.indicator,
    appInfo.padEnd(10, ' '),
  ].join('')

  return header
}

const getConsolidatedEntry = (procedure, competence, origin, index) => {
  const { patient = {} } = procedure
  const sheetNumber = Math.trunc(index / ENTRY_PER_SHEET) + 1
  const sequentialNumber = (index % ENTRY_PER_SHEET) + 1
  const age = patient.birthDate ? differenceInYears(new Date(), patient.birthDate) : 0
  const entry = [
    '02',
    padStartNumber(origin.cnes, 7, '0'),
    padStartNumber(competence.year, 4, '0'),
    padStartNumber(competence.month, 2, '0'),
    `${procedure.cbo || ''}`.padStart(6, ' '),
    padStartNumber(sheetNumber, 3, '0'),
    padStartNumber(sequentialNumber, 2, '0'),
    normalizeNumberText(procedure.code).padStart(10, '0'),
    padStartNumber(age, 3, '0'),
    padStartNumber(procedure.quantity, 6, '0'),
    (procedure.origin || 'BPA').padStart(3, ' '),
  ].join('')

  return entry
}

const getIndividualEntry = (procedure, competence, origin, index) => {
  const { patient = {} } = procedure
  const sheetNumber = Math.trunc(index / ENTRY_PER_SHEET) + 1
  const sequentialNumber = (index % ENTRY_PER_SHEET) + 1
  const age = patient.birthDate ? differenceInYears(new Date(), patient.birthDate) : 0
  const birthDate = patient.birthDate ? format(patient.birthDate, 'yyyyMMdd') : EMPTY_DATE
  const date = procedure.date ? format(procedure.date, 'yyyyMMdd') : EMPTY_DATE
  const entry = [
    '03',
    padStartNumber(origin.cnes, 7, '0'),
    padStartNumber(competence.year, 4, '0'),
    padStartNumber(competence.month, 2, '0'),
    `${procedure.cns || ''}`.padStart(15, ' '),
    `${procedure.cbo || ''}`.padStart(6, ' '),
    date,
    padStartNumber(sheetNumber, 3, '0'),
    padStartNumber(sequentialNumber, 2, '0'),
    normalizeNumberText(procedure.code).padStart(10, '0'),
    `${patient.cns || ''}`.padStart(15, ' '),
    (patient.gender || ' ').slice(0, 1),
    `${patient.ibge || ''}`.padEnd(6, ' ').slice(0, 6),
    `${patient.cid || ''}`.padEnd(4, ' ').slice(0, 4),
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
  ].join('')

  return entry
}

export const generateBPA = ({
  procedures = [],
  origin = {},
  destination = {},
  competence = {},
  appInfo = '',
} = {}) => {
  const lineCount = 0
  const pageCount = 0

  const consolidatedEntries = procedures.map((procedure, index) => {
    return getConsolidatedEntry(procedure, competence, origin, index)
  })

  const inidividualEntries = procedures.map((procedure, index) => {
    return getIndividualEntry(procedure, competence, origin, index)
  })

  const header = getHeader(competence, origin, destination, appInfo, { lineCount, pageCount })

  return header + '\n' + consolidatedEntries.join('\n') + '\n' + inidividualEntries.join('\n')
}

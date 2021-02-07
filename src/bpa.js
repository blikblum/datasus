import { normalizeNumberText, padStartNumber } from './utils.js'
import { differenceInYears, format } from 'date-fns'

const ENTRY_PER_SHEET = 20

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
  const sheetNumber = Math.trunc(index / ENTRY_PER_SHEET) + 1
  const sequentialNumber = (index % ENTRY_PER_SHEET) + 1
  const age = procedure.birthDate ? differenceInYears(new Date(), procedure.birthDate) : 0
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
  const sheetNumber = Math.trunc(index / ENTRY_PER_SHEET) + 1
  const sequentialNumber = (index % ENTRY_PER_SHEET) + 1
  const age = procedure.birthDate ? differenceInYears(new Date(), procedure.birthDate) : 0
  const date = procedure.date ? format(procedure.date, 'yyyyMMdd') : '        '
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
    padStartNumber(age, 3, '0'),
    padStartNumber(procedure.quantity, 6, '0'),
    (procedure.origin || 'BPA').padStart(3, ' '),
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

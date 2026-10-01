import { indexBPAErrors } from './export-records.js'

const recordKey = ({ cnes, competence, sheetNumber, sequenceNumber, code, cbo, cns }) => {
  const sheet = Number(sheetNumber)
  const sequence = Number(sequenceNumber)
  if (
    !/^\d{7}$/.test(cnes) ||
    !/^\d{6}$/.test(competence) ||
    Number(competence.slice(0, 4)) === 0 ||
    Number(competence.slice(4)) < 1 ||
    Number(competence.slice(4)) > 12 ||
    !Number.isInteger(sheet) ||
    sheet < 1 ||
    sheet > 999 ||
    !Number.isInteger(sequence) ||
    sequence < 1 ||
    sequence > 99 ||
    !/^\d{10}$/.test(code) ||
    !/^\d{15}$/.test(cns) ||
    !cbo
  )
    return null
  return JSON.stringify([cnes, competence, sheet, sequence, code, cbo, cns])
}

export const matchBPAErrors = (
  occurrences,
  exportText,
  individualEntries,
  rawIndividualEntries,
  errors = []
) => {
  const errorsByLine = indexBPAErrors(errors)
  const sourceLines = exportText.split(/\r\n|\n|\r/)
  const individualLines = sourceLines.flatMap((rawLine, index) => {
    const line = rawLine.replace(/^\uFEFF/, '')
    return line.startsWith('03') ? [{ lineNumber: index + 1, rawLine: line }] : []
  })

  if (
    individualLines.length !== individualEntries.length ||
    (rawIndividualEntries && individualLines.length !== rawIndividualEntries.length)
  ) {
    throw new Error('Não foi possível associar os registros às linhas da exportação.')
  }

  const recordsByKey = new Map()
  individualEntries.forEach((entry, index) => {
    const key = recordKey(entry)
    if (key === null) return
    const records = recordsByKey.get(key) || []
    const record = {
      entry,
      ...individualLines[index],
      errors: errorsByLine.get(individualLines[index].lineNumber) || [],
    }
    if (rawIndividualEntries) record.rawEntry = rawIndividualEntries[index]
    records.push(record)
    recordsByKey.set(key, records)
  })

  return occurrences.map((occurrence) => {
    const matches =
      recordsByKey.get(
        recordKey({
          ...occurrence,
          code: occurrence.procedureCode,
          cns: occurrence.professionalCns,
        })
      ) || []

    return {
      occurrence,
      status: matches.length === 0 ? 'missing' : matches.length === 1 ? 'matched' : 'ambiguous',
      matches,
    }
  })
}

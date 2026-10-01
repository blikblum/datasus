const recordKey = ({ cnes, competence, sheetNumber, sequenceNumber, code, cbo, cns }) =>
  JSON.stringify([cnes, competence, Number(sheetNumber), Number(sequenceNumber), code, cbo, cns])

export const matchBPAErrors = (
  occurrences,
  exportText,
  individualEntries,
  rawIndividualEntries
) => {
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
    const records = recordsByKey.get(key) || []
    const record = { entry, ...individualLines[index] }
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

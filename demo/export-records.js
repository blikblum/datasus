import { parseBPA, parseBPARaw } from '../src/index.js'

const PAGE_SIZE = 50

export const parseBPAForInspection = (text) => {
  const result = parseBPA(text)
  const recognizedLines = text.split(/\r\n|\n|\r/).filter((rawLine) => {
    const line = rawLine.replace(/^\uFEFF/, '')
    return line.startsWith('02') || line.startsWith('03')
  })
  return { ...result, rawRecords: parseBPARaw(recognizedLines.join('\n')) }
}

export const indexBPAErrors = (errors) => {
  const byLine = new Map()
  errors.forEach((error) => {
    if (!byLine.has(error.lineNumber)) byLine.set(error.lineNumber, [])
    byLine.get(error.lineNumber).push(error)
  })
  return byLine
}

export const indexBPARecords = (text, parsed, rawParsed, errors = []) => {
  const records = { individual: [], consolidated: [] }
  const errorsByLine = indexBPAErrors(errors)

  text.split(/\r\n|\n|\r/).forEach((rawLine, index) => {
    const line = rawLine.replace(/^\uFEFF/, '')
    const group = line.startsWith('03')
      ? 'individual'
      : line.startsWith('02')
      ? 'consolidated'
      : null
    if (!group) return

    const entryIndex = records[group].length
    const entry = parsed[group][entryIndex]
    const rawEntry = rawParsed && rawParsed[group][entryIndex]
    if (!entry || (rawParsed && !rawEntry)) {
      throw new Error('Não foi possível associar os registros às linhas da exportação.')
    }
    const record = {
      entry,
      lineNumber: index + 1,
      rawLine: line,
      errors: errorsByLine.get(index + 1) || [],
    }
    if (rawParsed) record.rawEntry = rawEntry
    records[group].push(record)
  })

  if (
    records.individual.length !== parsed.individual.length ||
    records.consolidated.length !== parsed.consolidated.length ||
    (rawParsed &&
      (records.individual.length !== rawParsed.individual.length ||
        records.consolidated.length !== rawParsed.consolidated.length))
  ) {
    throw new Error('Não foi possível associar os registros às linhas da exportação.')
  }

  return records
}

export const paginateRecords = (records, page) => {
  const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const start = (currentPage - 1) * PAGE_SIZE

  return {
    records: records.slice(start, start + PAGE_SIZE),
    page: currentPage,
    pageCount,
    start,
  }
}

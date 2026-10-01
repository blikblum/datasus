import { parseBPA, parseBPARaw } from '../src/index.js'

const PAGE_SIZE = 50

export const parseBPAForInspection = (text) => {
  const rawParsed = parseBPARaw(text, { allowExtraCharacters: true })
  try {
    return { parsed: parseBPA(text), rawParsed, conversionError: null }
  } catch (conversionError) {
    return { parsed: rawParsed, rawParsed, conversionError }
  }
}

export const indexBPARecords = (text, parsed, rawParsed) => {
  const records = { individual: [], consolidated: [] }

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
    const record = { entry, lineNumber: index + 1, rawLine: line }
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

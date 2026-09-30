const PAGE_SIZE = 50

export const indexBPARecords = (text, parsed) => {
  const records = { individual: [], consolidated: [] }

  text.split(/\r\n|\n|\r/).forEach((rawLine, index) => {
    const line = rawLine.replace(/^\uFEFF/, '')
    const group = line.startsWith('03')
      ? 'individual'
      : line.startsWith('02')
      ? 'consolidated'
      : null
    if (!group) return

    const entry = parsed[group][records[group].length]
    if (!entry) {
      throw new Error('Não foi possível associar os registros às linhas da exportação.')
    }
    records[group].push({ entry, lineNumber: index + 1, rawLine: line })
  })

  if (
    records.individual.length !== parsed.individual.length ||
    records.consolidated.length !== parsed.consolidated.length
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

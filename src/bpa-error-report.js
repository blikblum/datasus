const CNES_LINE = /^\s*CNES\s*:\s*(\d{7})\b/i
const BPAI_LINE = /^\s*BPAI\s+(\d{2})\/(\d{4})\s+(\d{3})\/(\d{2})\s+(\d{10})\s+(\d{6})\s+(\d{15})\s+(.+?)\s*$/i
const RECORD_LINE = /^\s*(BPAI|BPAC)\b/i

export const parseBPAErrorReport = (text) => {
  if (typeof text !== 'string') {
    throw new TypeError('BPA error report must be a string')
  }

  const occurrences = []
  let cnes

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.replace(/\u00a0/g, ' ')
    const cnesMatch = line.match(CNES_LINE)

    if (cnesMatch) {
      cnes = cnesMatch[1]
      return
    }

    const recordMatch = line.match(RECORD_LINE)
    if (!recordMatch) return

    const lineNumber = index + 1
    if (recordMatch[1].toUpperCase() === 'BPAC') {
      throw new Error(`Unsupported BPAC row at line ${lineNumber}`)
    }

    const match = line.match(BPAI_LINE)
    if (!match) {
      throw new Error(`Malformed BPAI row at line ${lineNumber}`)
    }
    if (!cnes) {
      throw new Error(`BPAI row at line ${lineNumber} has no CNES section`)
    }

    const [
      ,
      month,
      year,
      sheetNumber,
      sequenceNumber,
      procedureCode,
      cbo,
      professionalCns,
      occurrence,
    ] = match
    occurrences.push({
      cnes,
      type: 'BPAI',
      competence: `${year}${month}`,
      sheetNumber,
      sequenceNumber,
      procedureCode,
      cbo,
      professionalCns,
      occurrence,
    })
  })

  return occurrences
}

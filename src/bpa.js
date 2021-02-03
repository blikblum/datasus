import { padStartNumber } from './utils.js'

export const generateBPA = ({
  procedures = [],
  origin = {},
  destination = {},
  competence = {},
  appInfo = '',
} = {}) => {
  const lineCount = 0
  const pageCount = 0
  const controlCode = 1111
  const header = `01#BPA#${padStartNumber(competence.year, 4, '0')}${padStartNumber(
    competence.month,
    2,
    '0'
  )}${padStartNumber(lineCount, 6, '0')}${padStartNumber(
    pageCount,
    6,
    '0'
  )}${controlCode}${origin.name.padEnd(30, ' ')}${origin.abbrev.padEnd(
    6,
    ' '
  )}${origin.cnpj.padStart(14, '0')}${destination.name.padEnd(40, ' ')}${
    destination.indicator
  }${appInfo.padEnd(10, ' ')}`
  return header
}

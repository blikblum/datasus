const punctuationRegex = /\D/g

export const padStartNumber = (number = '', maxLength, fillString) => {
  return number.toString().padStart(maxLength, fillString)
}

export const normalizeNumberText = (number = '') => {
  if (typeof number === 'string') {
    return number.replace(punctuationRegex, '')
  }
  return `${number}`
}

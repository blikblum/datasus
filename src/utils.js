export const padStartNumber = (number = '', maxLength, fillString) => {
  return number.toString().padStart(maxLength, fillString)
}

const punctuationRegex = /(\.|-| |\/)/g

export const normalizeNumberText = (number = '') => {
  if (typeof number === 'string') {
    return number.replace(punctuationRegex, '')
  }
  return `${number}`
}

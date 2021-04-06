const punctuationRegex = /\D/g
const diacriticsRegex = /[\u0300-\u036f]/g

export const padStartNumber = (number = '', maxLength, fillString) => {
  return number.toString().padStart(maxLength, fillString)
}

export const normalizeNumberText = (number = '') => {
  if (typeof number === 'string') {
    return number.replace(punctuationRegex, '')
  }
  return `${number}`
}

export const removeAccents = (text = '') => {
  return text.normalize('NFD').replace(diacriticsRegex, '')
}

export const padStartNumber = (number = '', maxLength, fillString) => {
  return number.toString().padStart(maxLength, fillString)
}

const punctuationRegex = /(\.|-)/g

export const normalizeNumberText = (numberText) => {
  if (numberText) {
    return numberText.replace(punctuationRegex, '')
  }
  return ''
}

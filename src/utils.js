const punctuationRegex = /\D/g
const diacriticsRegex = /\p{M}/gu
const windows1252ExtraCharacters = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')

const isWindows1252Character = (character) => {
  const codePoint = character.codePointAt(0)
  return (
    codePoint <= 0x7f ||
    (codePoint >= 0xa0 && codePoint <= 0xff) ||
    windows1252ExtraCharacters.has(character)
  )
}

export const padStartNumber = (number = '', maxLength, fillString) => {
  return number.toString().padStart(maxLength, fillString)
}

export const normalizeNumberText = (number = '') => {
  if (typeof number === 'string') {
    return number.replace(punctuationRegex, '')
  }
  return `${number}`
}

export const normalizeStringText = (text = '') => {
  const normalizedText = text.normalize('NFD').replace(diacriticsRegex, '')
  return Array.from(normalizedText, (character) =>
    isWindows1252Character(character) ? character : '?'
  ).join('')
}

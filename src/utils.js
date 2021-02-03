export const padStartNumber = (number, maxLength, fillString) => {
  return number.toString().padStart(maxLength, fillString)
}

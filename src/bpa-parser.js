// Field order and rules follow resources/Layout_Exportacao_BPA.pdf (July 2026).
const origins = ['BPA', 'PNI', 'SIE', 'SIB', 'MIN', 'PAC', 'SCL', 'EXT']
const numeric = (field, width, rules = {}) => ({ field, width, numeric: true, ...rules })
const text = (field, width, rules = {}) => ({ field, width, ...rules })
const number = (field, width, rules = {}) =>
  numeric(field, width, { native: 'number', required: true, zeroPadded: true, ...rules })
const date = (field) => numeric(field, 8, { native: 'date' })
const flag = (field) => text(field, 1, { native: 'flag', values: ['S', 'N'] })

const layouts = {
  '02': {
    group: 'consolidated',
    width: 48,
    fields: [
      text('type', 2),
      numeric('cnes', 7, { required: true, zeroPadded: true }),
      numeric('competence', 6, { required: true, competence: true }),
      text('cbo', 6),
      number('sheetNumber', 3, { range: [1, 999] }),
      number('sequenceNumber', 2, { range: [1, 20] }),
      numeric('code', 10, { required: true, zeroPadded: true }),
      number('age', 3, { range: [0, 130] }),
      number('quantity', 6),
      text('origin', 3, { values: origins }),
    ],
  },
  '03': {
    group: 'individual',
    width: 351,
    fields: [
      text('type', 2),
      numeric('cnes', 7, { required: true, zeroPadded: true }),
      numeric('competence', 6, { required: true, competence: true }),
      numeric('cns', 15, { required: true, fullWidth: true }),
      text('cbo', 6, { required: true }),
      date('date'),
      number('sheetNumber', 3, { range: [1, 999] }),
      number('sequenceNumber', 2, { range: [1, 99] }),
      numeric('code', 10, { required: true, zeroPadded: true }),
      numeric('patient.cns', 15, { fullWidth: true }),
      text('patient.gender', 1, { values: ['M', 'F'] }),
      numeric('patient.ibge', 6, { fullWidth: true }),
      text('cid', 4),
      number('age', 3, { range: [0, 130] }),
      number('quantity', 6),
      numeric('character', 2, { zeroPadded: true }),
      numeric('authorization', 13),
      text('origin', 3, { values: origins }),
      text('patient.name', 30, { padding: 'right', alphanumeric: true }),
      date('patient.birthDate'),
      numeric('patient.race', 2, { required: true, values: ['01', '02', '03', '04', '05', '99'] }),
      numeric('patient.ethnicity', 4, { fullWidth: true }),
      numeric('patient.nationality', 3, { fullWidth: true }),
      numeric('serviceCode', 3, { fullWidth: true }),
      numeric('classification', 3, { fullWidth: true }),
      numeric('sequenceCode', 8, { fullWidth: true }),
      numeric('areaCode', 4, { fullWidth: true }),
      numeric('maintainerCnpj', 14, { fullWidth: true }),
      numeric('patient.cep', 8, { fullWidth: true }),
      numeric('patient.placeCode', 3, { fullWidth: true }),
      text('patient.address', 30, { padding: 'right' }),
      text('patient.addressComplement', 10, { padding: 'right' }),
      text('patient.addressNumber', 5, { padding: 'right' }),
      text('patient.addressDistrict', 30, { padding: 'right' }),
      numeric('patient.phone', 11, { padding: 'right' }),
      text('patient.email', 40, { padding: 'right' }),
      numeric('nationalId', 10, { zeroPadded: true }),
      numeric('patient.cpf', 11, { fullWidth: true }),
      flag('patient.homeless'),
      flag('patient.noCpf'),
    ],
  },
}

const setField = (entry, field, value) => {
  const [parent, child] = field.split('.')
  if (child) {
    if (!entry[parent]) entry[parent] = {}
    entry[parent][child] = value
  } else {
    entry[parent] = value
  }
}

const extractFields = (line, layout) => {
  let position = 0
  const entry = {}
  const slices = layout.fields.map(({ field, width }) => {
    const slice = line.slice(position, position + width)
    position += width
    setField(entry, field, slice.trim())
    return slice
  })
  return { entry, slices }
}

const validCompetence = (value) =>
  /^\d{6}$/.test(value) &&
  Number(value.slice(0, 4)) > 0 &&
  Number(value.slice(4)) >= 1 &&
  Number(value.slice(4)) <= 12

const parseDate = (value) => {
  if (!/^\d{8}$/.test(value)) return null
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6))
  const day = Number(value.slice(6, 8))
  const result = new Date(0)
  result.setFullYear(year, month - 1, day)
  result.setHours(0, 0, 0, 0)
  return year > 0 &&
    result.getFullYear() === year &&
    result.getMonth() === month - 1 &&
    result.getDate() === day
    ? result
    : null
}

const validateEntry = (rawEntry, slices, layout, report) => {
  const entry = {}
  layout.fields.forEach((rule, index) => {
    const slice = slices[index]
    const value = slice.trim()
    let nativeValue = value
    const error = (message) => report(rule.field, value, message)
    const digits = /^\d+$/.test(value)

    if (rule.native === 'number') nativeValue = digits ? Number(value) : null
    if (rule.native === 'date') nativeValue = parseDate(value)
    if (rule.native === 'flag') nativeValue = value === 'S' ? true : value === 'N' ? false : null
    setField(entry, rule.field, nativeValue)

    if (!value) {
      if (rule.required) {
        error('Required field')
      }
      return
    }
    if (rule.native === 'date') {
      if (!nativeValue) error('Invalid date; expected YYYYMMDD')
    } else if (rule.numeric && !digits) {
      error('Must contain only digits')
    } else if (rule.zeroPadded && (value.length !== rule.width || slice !== value)) {
      error('Must contain ' + rule.width + ' digits, padded with zeros on the left')
    } else if (rule.fullWidth && value.length !== rule.width) {
      error('Must contain ' + rule.width + ' digits')
    }
    if (rule.competence && !validCompetence(value)) {
      error('Invalid competence; expected YYYYMM')
    }
    if (rule.padding === 'right' && slice !== value.padEnd(rule.width, ' ')) {
      error('Must be padded with spaces on the right')
    }
    if (rule.alphanumeric && !/^[\p{L}\p{M}0-9 ]+$/u.test(value)) {
      error('Must contain only letters, digits, and spaces')
    }
    if (rule.values && !rule.values.includes(value)) {
      error('Expected one of: ' + rule.values.join(', '))
    }
    if (rule.range && digits && (Number(value) < rule.range[0] || Number(value) > rule.range[1])) {
      error('Must be between ' + rule.range[0] + ' and ' + rule.range[1])
    }
    if (rule.field === 'patient.ethnicity' && rawEntry.patient.race !== '05') {
      error('Must be blank unless patient.race is 05')
    }
  })
  return entry
}

const visitRecords = (text, onRecord, onUnknown) => {
  if (typeof text !== 'string') throw new TypeError('BPA export must be a string')
  text.split(/\r\n|\n|\r/).forEach((rawLine, index) => {
    const line = rawLine.replace(/^\uFEFF/, '')
    if (!line.trim() || line.startsWith('01#BPA#')) return
    const recordType = line.slice(0, 2)
    const layout = layouts[recordType]
    if (layout) onRecord(line, index + 1, recordType, layout)
    else onUnknown(line, index + 1, recordType)
  })
}

export const parseBPARaw = (text) => {
  const records = { consolidated: [], individual: [] }
  visitRecords(
    text,
    (line, lineNumber, recordType, layout) => {
      records[layout.group].push(extractFields(line, layout).entry)
    },
    (line, lineNumber) => {
      throw new Error('Unknown BPA record type at line ' + lineNumber)
    }
  )
  return records
}

export const parseBPA = (text) => {
  const records = { consolidated: [], individual: [] }
  const errors = []
  visitRecords(
    text,
    (line, lineNumber, recordType, layout) => {
      const report = (field, value, message) =>
        errors.push({ lineNumber, recordType, field, value, message })
      if (line.length !== layout.width) {
        report(
          null,
          line,
          'Invalid ' +
            layout.group +
            ' entry width; expected ' +
            layout.width +
            ' characters, received ' +
            line.length
        )
      }
      const { entry, slices } = extractFields(line, layout)
      records[layout.group].push(validateEntry(entry, slices, layout, report))
    },
    (line, lineNumber, recordType) => {
      errors.push({
        lineNumber,
        recordType,
        field: 'type',
        value: recordType,
        message: 'Unknown BPA record type',
      })
    }
  )
  return { records, errors }
}

import { parseBPAErrorReport } from '../src/index.js'
import { matchBPAErrors } from './match-errors.js'
import { indexBPARecords, paginateRecords, parseBPAForInspection } from './export-records.js'

const form = document.getElementById('check-form')
const reportInput = document.getElementById('report-file')
const exportInput = document.getElementById('export-file')
const reportError = document.getElementById('report-error')
const exportError = document.getElementById('export-error')
const analysisError = document.getElementById('analysis-error')
const exportConversionWarning = document.getElementById('export-conversion-warning')
const checkButton = document.getElementById('check-button')
const resultsSection = document.getElementById('results')
const resultList = document.getElementById('result-list')

const statusLabels = {
  matched: 'Identificada',
  missing: 'Sem registro',
  ambiguous: 'Ambígua',
}

let selectionVersion = 0

const element = (tag, className, value) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (value !== undefined) node.textContent = value
  return node
}

const setError = (node, message = '') => {
  node.textContent = message
  node.hidden = !message
}

const clearResults = () => {
  resultsSection.hidden = true
  resultList.replaceChildren()
  setError(analysisError)
  setError(exportConversionWarning)
}

const setBusy = (busy) => {
  checkButton.disabled = busy
  checkButton.textContent = busy ? 'Analisando arquivos…' : 'Relacionar erros ↗'
}

const readText = async (file) => {
  const bytes = await file.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

const readExportText = async (file) =>
  new TextDecoder('windows-1252').decode(await file.arrayBuffer())

const appendDetail = (parent, label, value) => {
  const item = element('div', 'detail-item')
  item.append(element('dt', '', label), element('dd', '', value || 'Não informado'))
  parent.append(item)
}

const createRecordDisclosure = (label, content) => {
  const disclosure = element('details', 'record-details')
  const code = element('code', '', content)
  const pre = element('pre')
  pre.append(code)
  disclosure.append(element('summary', '', label), pre)
  return disclosure
}

const appendRecordDisclosures = (parent, { entry, rawEntry, rawLine }) => {
  if (entry !== rawEntry) {
    parent.append(createRecordDisclosure('Ver dados interpretados', JSON.stringify(entry, null, 2)))
  }
  if (rawEntry) {
    parent.append(createRecordDisclosure('Ver valores brutos', JSON.stringify(rawEntry, null, 2)))
  }
  parent.append(createRecordDisclosure('Ver linha original', rawLine))
}

const conversionWarning = (error) =>
  error
    ? 'Não foi possível interpretar os valores: ' +
      error.message +
      '. Exibindo os valores brutos de todo o arquivo.'
    : ''

const createPatientRecord = (sourceRecord) => {
  const { entry, lineNumber } = sourceRecord
  const record = element('div', 'patient-record')
  const heading = element('div', 'patient-heading')
  heading.append(
    element('span', 'patient-label', 'PACIENTE'),
    element('strong', 'patient-name', entry.patient.name || 'Nome não informado')
  )
  record.append(heading)

  const details = element('dl', 'patient-details')
  appendDetail(details, 'Linha na exportação', String(lineNumber))
  appendDetail(details, 'CNS do paciente', entry.patient.cns)
  appendDetail(details, 'CPF', entry.patient.cpf)
  record.append(details)

  appendRecordDisclosures(record, sourceRecord)
  return record
}

const createResultCard = ({ occurrence, status, matches }, index) => {
  const card = element('article', 'result-card result-card--' + status)
  const top = element('div', 'result-top')
  top.append(
    element('span', 'result-index', String(index + 1).padStart(2, '0')),
    element('span', 'result-status', statusLabels[status])
  )
  card.append(top)

  card.append(element('h3', 'result-message', occurrence.occurrence))

  const meta = element('div', 'result-meta')
  meta.append(
    element('span', '', 'CNES ' + occurrence.cnes),
    element('span', '', occurrence.competence.slice(4) + '/' + occurrence.competence.slice(0, 4)),
    element('span', '', 'Folha ' + occurrence.sheetNumber + ' / seq. ' + occurrence.sequenceNumber),
    element('span', '', 'Procedimento ' + occurrence.procedureCode)
  )
  card.append(meta)

  if (status === 'missing') {
    card.append(
      element(
        'p',
        'result-note',
        'Nenhum registro da exportação corresponde a todos os dados desta ocorrência.'
      )
    )
  } else if (status === 'ambiguous') {
    card.append(
      element(
        'p',
        'result-note',
        'Mais de uma linha tem a mesma identificação. Confira as linhas antes de escolher um paciente.'
      )
    )
  }

  matches.forEach((record) => card.append(createPatientRecord(record)))
  return card
}

const renderResults = (matches, reportName, exportName) => {
  const counts = {
    matched: matches.filter(({ status }) => status === 'matched').length,
    missing: matches.filter(({ status }) => status === 'missing').length,
    ambiguous: matches.filter(({ status }) => status === 'ambiguous').length,
  }
  document.getElementById('total-count').textContent = String(matches.length)
  document.getElementById('matched-count').textContent = String(counts.matched)
  document.getElementById('missing-count').textContent = String(counts.missing)
  document.getElementById('ambiguous-count').textContent = String(counts.ambiguous)
  document.getElementById('results-caption').textContent = reportName + ' · ' + exportName

  if (matches.length === 0) {
    resultList.append(
      element('p', 'empty-state', 'Nenhuma ocorrência BPAI foi encontrada no relatório.')
    )
  } else {
    const fragment = document.createDocumentFragment()
    matches.forEach((result, index) => fragment.append(createResultCard(result, index)))
    resultList.append(fragment)
  }

  resultsSection.hidden = false
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const resetSelection = () => {
  selectionVersion += 1
  setBusy(false)
  setError(reportError)
  setError(exportError)
  clearResults()
}

reportInput.addEventListener('change', resetSelection)
exportInput.addEventListener('change', resetSelection)

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  clearResults()
  setError(reportError)
  setError(exportError)

  const reportFile = reportInput.files[0]
  const exportFile = exportInput.files[0]
  if (!reportFile) setError(reportError, 'Selecione o relatório de erros.')
  if (!exportFile) setError(exportError, 'Selecione a exportação BPA.')
  if (!reportFile || !exportFile) return

  const runVersion = selectionVersion
  setBusy(true)

  try {
    let occurrences
    try {
      const reportText = await readText(reportFile)
      if (runVersion !== selectionVersion) return
      occurrences = parseBPAErrorReport(reportText)
    } catch (error) {
      setError(reportError, 'Não foi possível ler o relatório: ' + error.message)
      return
    }

    let exportText
    let inspection
    try {
      exportText = await readExportText(exportFile)
      if (runVersion !== selectionVersion) return
      inspection = parseBPAForInspection(exportText)
    } catch (error) {
      setError(exportError, 'Não foi possível ler a exportação: ' + error.message)
      return
    }

    try {
      const matches = matchBPAErrors(
        occurrences,
        exportText,
        inspection.parsed.individual,
        inspection.rawParsed.individual
      )
      setError(exportConversionWarning, conversionWarning(inspection.conversionError))
      renderResults(matches, reportFile.name, exportFile.name)
    } catch (error) {
      setError(analysisError, error.message)
    }
  } finally {
    if (runVersion === selectionVersion) setBusy(false)
  }
})

const demoTabs = [document.getElementById('tab-check'), document.getElementById('tab-export')]

const activateDemoTab = (activeTab, focus = false) => {
  demoTabs.forEach((tab) => {
    const selected = tab === activeTab
    tab.setAttribute('aria-selected', String(selected))
    tab.tabIndex = selected ? 0 : -1
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected
  })
  if (focus) activeTab.focus()
}

demoTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateDemoTab(tab))
  tab.addEventListener('keydown', (event) => {
    let nextIndex
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % demoTabs.length
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + demoTabs.length) % demoTabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = demoTabs.length - 1
    if (nextIndex === undefined) return
    event.preventDefault()
    activateDemoTab(demoTabs[nextIndex], true)
  })
})

const tableForm = document.getElementById('table-form')
const tableInput = document.getElementById('table-file')
const tableError = document.getElementById('table-file-error')
const tableConversionWarning = document.getElementById('table-conversion-warning')
const tableButton = document.getElementById('table-button')
const tableResults = document.getElementById('table-results')
const tableHead = document.querySelector('#export-table thead')
const tableBody = document.querySelector('#export-table tbody')
const groupButtons = {
  individual: document.getElementById('group-individual'),
  consolidated: document.getElementById('group-consolidated'),
}
const previousPage = document.getElementById('previous-page')
const nextPage = document.getElementById('next-page')
let tableVersion = 0
let tableRecords = { individual: [], consolidated: [] }
let selectedGroup = 'individual'
let tablePage = 1

const displayValue = (value) =>
  value === '' || value === null || value === undefined ? '—' : String(value)
const displayCompetence = (value) => (value ? value.slice(4, 6) + '/' + value.slice(0, 4) : '—')
const displayDate = (value) =>
  value instanceof Date ? new Intl.DateTimeFormat('pt-BR').format(value) : displayValue(value)

const commonColumns = [
  { label: 'Linha', value: (record) => record.lineNumber },
  { label: 'CNES', value: ({ entry }) => entry.cnes },
  { label: 'Competência', value: ({ entry }) => displayCompetence(entry.competence) },
  {
    label: 'Folha / seq.',
    value: ({ entry }) =>
      String(entry.sheetNumber).padStart(3, '0') +
      ' / ' +
      String(entry.sequenceNumber).padStart(2, '0'),
  },
  { label: 'Procedimento', value: ({ entry }) => entry.code },
  { label: 'CBO', value: ({ entry }) => entry.cbo },
  { label: 'Quantidade', value: ({ entry }) => entry.quantity },
]
const groupColumns = {
  individual: [
    ...commonColumns,
    { label: 'Paciente', value: ({ entry }) => entry.patient.name },
    { label: 'CNS do paciente', value: ({ entry }) => entry.patient.cns },
    { label: 'Data', value: ({ entry }) => displayDate(entry.date) },
  ],
  consolidated: [
    ...commonColumns,
    { label: 'Idade', value: ({ entry }) => entry.age },
    { label: 'Origem', value: ({ entry }) => entry.origin },
  ],
}

const setTableBusy = (busy) => {
  tableButton.disabled = busy
  tableButton.textContent = busy ? 'Lendo exportação…' : 'Visualizar registros ↗'
}

const createTableRows = (record, columns) => {
  const row = element('tr')
  columns.forEach((column) => row.append(element('td', '', displayValue(column.value(record)))))

  const detailId = 'entry-detail-' + selectedGroup + '-' + record.lineNumber
  const detailButton = element('button', 'row-detail-button', 'Ver detalhes')
  detailButton.type = 'button'
  detailButton.setAttribute('aria-expanded', 'false')
  detailButton.setAttribute('aria-controls', detailId)
  const actionCell = element('td')
  actionCell.append(detailButton)
  row.append(actionCell)

  const detailRow = element('tr', 'export-detail-row')
  detailRow.id = detailId
  detailRow.hidden = true
  const detailCell = element('td')
  detailCell.colSpan = columns.length + 1
  const content = element('div', 'export-detail-content')
  appendRecordDisclosures(content, record)
  detailCell.append(content)
  detailRow.append(detailCell)

  detailButton.addEventListener('click', () => {
    detailRow.hidden = !detailRow.hidden
    detailButton.setAttribute('aria-expanded', String(!detailRow.hidden))
    detailButton.textContent = detailRow.hidden ? 'Ver detalhes' : 'Ocultar detalhes'
  })

  return [row, detailRow]
}

const renderExportTable = () => {
  const allRecords = tableRecords[selectedGroup]
  const columns = groupColumns[selectedGroup]
  const page = paginateRecords(allRecords, tablePage)
  tablePage = page.page

  Object.entries(groupButtons).forEach(([group, button]) => {
    button.setAttribute('aria-pressed', String(group === selectedGroup))
  })
  document.getElementById('individual-count').textContent = String(tableRecords.individual.length)
  document.getElementById('consolidated-count').textContent = String(
    tableRecords.consolidated.length
  )

  const headerRow = element('tr')
  columns.forEach((column) => {
    const heading = element('th', '', column.label)
    heading.scope = 'col'
    headerRow.append(heading)
  })
  const actionHeading = element('th', '', 'Detalhes')
  actionHeading.scope = 'col'
  headerRow.append(actionHeading)
  tableHead.replaceChildren(headerRow)

  const fragment = document.createDocumentFragment()
  page.records.forEach((record) => fragment.append(...createTableRows(record, columns)))
  tableBody.replaceChildren(fragment)

  const empty = allRecords.length === 0
  document.getElementById('table-scroll').hidden = empty
  const emptyMessage = document.getElementById('table-empty')
  emptyMessage.textContent = empty
    ? 'Nenhum registro ' +
      (selectedGroup === 'individual' ? 'individual' : 'consolidado') +
      ' encontrado neste arquivo.'
    : ''
  emptyMessage.hidden = !empty
  document.getElementById('table-pagination').hidden = empty
  document.getElementById('page-status').textContent =
    String(page.start + 1) +
    '–' +
    String(page.start + page.records.length) +
    ' de ' +
    String(allRecords.length)
  previousPage.disabled = page.page === 1
  nextPage.disabled = page.page === page.pageCount
}

Object.entries(groupButtons).forEach(([group, button]) => {
  button.addEventListener('click', () => {
    selectedGroup = group
    tablePage = 1
    renderExportTable()
  })
})
previousPage.addEventListener('click', () => {
  tablePage -= 1
  renderExportTable()
})
nextPage.addEventListener('click', () => {
  tablePage += 1
  renderExportTable()
})

tableInput.addEventListener('change', () => {
  tableVersion += 1
  tableResults.hidden = true
  setTableBusy(false)
  setError(tableError)
  setError(tableConversionWarning)
})

tableForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  tableResults.hidden = true
  setError(tableError)
  setError(tableConversionWarning)

  const file = tableInput.files[0]
  if (!file) {
    setError(tableError, 'Selecione a exportação BPA.')
    return
  }

  const runVersion = tableVersion
  setTableBusy(true)
  try {
    const text = await readExportText(file)
    if (runVersion !== tableVersion) return
    const { parsed, rawParsed, conversionError } = parseBPAForInspection(text)
    tableRecords = indexBPARecords(text, parsed, rawParsed)
    setError(tableConversionWarning, conversionWarning(conversionError))
    selectedGroup = tableRecords.individual.length ? 'individual' : 'consolidated'
    tablePage = 1
    document.getElementById('table-caption').textContent = file.name
    renderExportTable()
    tableResults.hidden = false
    tableResults.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (error) {
    if (runVersion === tableVersion) {
      setError(tableError, 'Não foi possível ler a exportação: ' + error.message)
    }
  } finally {
    if (runVersion === tableVersion) setTableBusy(false)
  }
})

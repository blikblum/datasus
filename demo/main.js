import { parseBPA, parseBPAErrorReport } from '../src/index.js'
import { matchBPAErrors } from './match-errors.js'

const form = document.getElementById('check-form')
const reportInput = document.getElementById('report-file')
const exportInput = document.getElementById('export-file')
const reportError = document.getElementById('report-error')
const exportError = document.getElementById('export-error')
const analysisError = document.getElementById('analysis-error')
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

const createPatientRecord = ({ entry, lineNumber, rawLine }) => {
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

  record.append(
    createRecordDisclosure('Ver linha original', rawLine),
    createRecordDisclosure('Ver dados interpretados', JSON.stringify(entry, null, 2))
  )
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
    let individualEntries
    try {
      exportText = await readText(exportFile)
      if (runVersion !== selectionVersion) return
      individualEntries = parseBPA(exportText).individual
    } catch (error) {
      setError(exportError, 'Não foi possível ler a exportação: ' + error.message)
      return
    }

    try {
      const matches = matchBPAErrors(occurrences, exportText, individualEntries)
      renderResults(matches, reportFile.name, exportFile.name)
    } catch (error) {
      setError(analysisError, error.message)
    }
  } finally {
    if (runVersion === selectionVersion) setBusy(false)
  }
})

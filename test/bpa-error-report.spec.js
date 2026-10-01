import { expect } from 'chai'
import { readFileSync } from 'fs'
import { parseBPAErrorReport } from '../src/index.js'

const sampleReport = readFileSync('resources/relatorio-erro-bpa.txt', 'utf8')

const sampleRow = 'BPAI 08/2026 002/20 0302040030 223605 552083124090009 CEP DO USUARIO INVALIDO'

describe('parseBPAErrorReport', () => {
  it('parses every occurrence in the supplied report', () => {
    const occurrences = parseBPAErrorReport(sampleReport)

    expect(occurrences).to.have.lengthOf(18)
    expect(occurrences[0]).to.deep.equal({
      cnes: '0000000',
      type: 'BPAI',
      competence: '202608',
      sheetNumber: '002',
      sequenceNumber: '20',
      procedureCode: '0302040030',
      cbo: '223605',
      professionalCns: '552083124090009',
      occurrence: 'CEP DO USUARIO INVALIDO',
    })
    expect(occurrences[17].sheetNumber).to.equal('019')
    expect(occurrences[17].sequenceNumber).to.equal('09')
    expect(occurrences.map(({ occurrence }) => occurrence)).to.include(
      "PESSOA EM SITUACAO DE RUA DEVE SER 'S'SIM OU 'N'NAO"
    )
  })

  it('uses the latest CNES section and accepts repeated headings, CRLF, and nonbreaking spaces', () => {
    const report = [
      'CNES : 0001234 PRIMEIRA UNIDADE',
      'TIPO COMPET. FL/SEQ PROCED. CBO CNS PROFISS. OCORRENCIA',
      `\u00a0${sampleRow.replace(/ /g, '\u00a0')}\u00a0`,
      'BDSIA202608b************************************************************ 06.04',
      'CNES : 7654321 SEGUNDA UNIDADE',
      'TIPO COMPET. FL/SEQ PROCED. CBO CNS PROFISS. OCORRENCIA',
      'BPAI 09/2026 001/01 0000000001 000001 000000000000001 OUTRO ERRO',
    ].join('\r\n')

    const occurrences = parseBPAErrorReport(report)

    expect(occurrences).to.have.lengthOf(2)
    expect(occurrences[0].cnes).to.equal('0001234')
    expect(occurrences[1]).to.include({
      cnes: '7654321',
      competence: '202609',
      sheetNumber: '001',
      sequenceNumber: '01',
      procedureCode: '0000000001',
      cbo: '000001',
      professionalCns: '000000000000001',
    })
  })

  it('returns no occurrences for an empty report', () => {
    expect(parseBPAErrorReport('')).to.deep.equal([])
    expect(parseBPAErrorReport('RELATORIO DE OCORRENCIAS\nTIPO COMPET.')).to.deep.equal([])
  })

  it('parses CR-only printer reports with page breaks and repeated headings', () => {
    const pageHeader = [
      '\fBDSIA202608b************************************************************ 06.04',
      'RELATORIO DE OCORRENCIAS NA CONSISTENCIA',
      '******************************************************************************\u001b(s17,27H',
      ' CNES : 0001234 UNIDADE',
      ' TIPO COMPET. FL/SEQ PROCED. CBO CNS PROFISS. OCORRENCIA',
      ' ',
    ]
    const report = [
      ...pageHeader,
      ` ${sampleRow}    `,
      ` ${sampleRow.replace('CEP DO USUARIO INVALIDO', 'OUTRO ERRO')}    \f`,
      '',
      ' ',
      ...pageHeader,
      ` ${sampleRow.replace('002/20', '003/01')}    \f`,
    ].join('\r')

    const occurrences = parseBPAErrorReport(report)

    expect(occurrences).to.have.lengthOf(3)
    expect(occurrences.map(({ cnes }) => cnes)).to.deep.equal(['0001234', '0001234', '0001234'])
    expect(occurrences.map(({ occurrence }) => occurrence)).to.deep.equal([
      'CEP DO USUARIO INVALIDO',
      'OUTRO ERRO',
      'CEP DO USUARIO INVALIDO',
    ])
    expect(occurrences[2]).to.include({ sheetNumber: '003', sequenceNumber: '01' })
  })

  it('preserves line numbers with mixed CR, CRLF, and LF endings', () => {
    const report = `CNES : 0001234\r${sampleRow}\r\nTIPO COMPET.\nBPAI 08/2026 INVALID`

    expect(() => parseBPAErrorReport(report)).to.throw('Malformed BPAI row at line 4')
  })

  it('reports malformed BPAI rows with their line number', () => {
    expect(() => parseBPAErrorReport('CNES : 2804891\nBPAI 08/2026 INVALID')).to.throw(
      'Malformed BPAI row at line 2'
    )
  })

  it('reports BPAI rows without a CNES section', () => {
    expect(() => parseBPAErrorReport(sampleRow)).to.throw('BPAI row at line 1 has no CNES section')
  })

  it('rejects unsupported BPAC rows', () => {
    expect(() => parseBPAErrorReport('CNES : 2804891\nBPAC 08/2026 002/20')).to.throw(
      'Unsupported BPAC row at line 2'
    )
  })

  it('requires report text', () => {
    expect(() => parseBPAErrorReport()).to.throw(TypeError)
  })
})

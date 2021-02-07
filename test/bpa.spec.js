import { expect } from 'chai'
import { defaultsDeep } from 'lodash-es'
import { subYears } from 'date-fns'
import { generateBPA } from '../src/bpa.js'

const getDefaultBPAOptions = () => {
  return {
    origin: {
      name: 'Hospital XYZ',
      cnpj: '12345678901234',
      cnes: 97864,
      abbrev: 'HOSXYZ',
    },

    destination: {
      name: 'SEC ESTADUAL',
      indicator: 'E',
    },

    appInfo: 'MYAPP',

    competence: { year: 2020, month: 1 },

    procedures: [],
  }
}

const getHeader = (options) => {
  const mergedOptions = defaultsDeep({ ...options }, getDefaultBPAOptions())
  return generateBPA(mergedOptions).split('\n')[0]
}

const getConsolidatedEntries = (options) => {
  const mergedOptions = defaultsDeep({ ...options }, getDefaultBPAOptions())
  const lines = generateBPA(mergedOptions).split('\n')
  return lines.slice(1, mergedOptions.procedures.length + 1)
}

const getIndividualEntries = (options) => {
  const mergedOptions = defaultsDeep({ ...options }, getDefaultBPAOptions())
  const lines = generateBPA(mergedOptions).split('\n')
  return lines.slice(mergedOptions.procedures.length + 1, mergedOptions.procedures.length * 2 + 1)
}

describe('BPA', () => {
  describe('generateBPA', () => {
    it('should create a correct header', () => {
      const header = getHeader({})

      expect(header.substr(0, 2), 'Indicador de linha do Header').to.be.equal('01')

      expect(header.substr(2, 5), 'Indicador de início do cabeçalho').to.be.equal('#BPA#')

      expect(header.substr(7, 6), 'Ano e mês de Processamento da produção').to.be.equal('202001')

      expect(header.substr(13, 6), 'Número de linhas do BPA gravadas').to.be.equal('000000')

      expect(header.substr(19, 6), 'Quantidades de folhas de BPA gravadas').to.be.equal('000000')

      expect(header.substr(25, 4), 'Campo de controle').to.be.equal('1111')

      expect(
        header.substr(29, 30),
        'Nome do órgão de origem responsável pela informação'
      ).to.be.equal('Hospital XYZ                  ')

      expect(
        header.substr(59, 6),
        'Sigla do órgão de origem responsável pela digitação'
      ).to.be.equal('HOSXYZ')

      expect(header.substr(65, 14), 'CGC/CPF do prestador ou do órgão público').to.be.equal(
        '12345678901234'
      )

      expect(header.substr(79, 40), 'Nome do órgão de saúde destino do arquivo').to.be.equal(
        'SEC ESTADUAL                            '
      )

      expect(header.substr(119, 1), 'Indicador do órgão destino').to.be.equal('E')

      expect(header.substr(120, 10), 'Versão do sistema').to.be.equal('MYAPP     ')

      //expect(header.substr(130, 2), 'Fim do cabeçalho').to.be.equal('01')
    })

    describe('consolidated entries', () => {
      it('should have a identification code at 1-2', () => {
        const entry = getConsolidatedEntries({ procedures: [{}] })[0]
        expect(entry.substr(0, 2)).to.be.equal('02')
      })

      it('should have cnes at 3-9', () => {
        const entry = getConsolidatedEntries({
          procedures: [{}],
          origin: { cnes: 1234 },
        })[0]
        expect(entry.substr(2, 7)).to.be.equal('0001234')

        const entry2 = getConsolidatedEntries({
          procedures: [{}],
          origin: { cnes: 1234567 },
        })[0]
        expect(entry2.substr(2, 7)).to.be.equal('1234567')
      })

      it('should have competence at 10-15', () => {
        const entry = getConsolidatedEntries({
          procedures: [{}],
          competence: {
            year: 2021,
            month: 1,
          },
        })[0]
        expect(entry.substr(9, 6)).to.be.equal('202101')

        const entry2 = getConsolidatedEntries({
          procedures: [{}],
          competence: {
            year: 2019,
            month: 11,
          },
        })[0]
        expect(entry2.substr(9, 6)).to.be.equal('201911')
      })

      it('should have cbo at 16-21', () => {
        let entry = getConsolidatedEntries({
          procedures: [{}],
        })[0]
        // defaults to white space
        expect(entry.substr(15, 6)).to.be.equal('      ')

        entry = getConsolidatedEntries({
          procedures: [{ cbo: 223505 }],
        })[0]
        expect(entry.substr(15, 6)).to.be.equal('223505')

        entry = getConsolidatedEntries({
          procedures: [{ cbo: 223535 }],
        })[0]
        expect(entry.substr(15, 6)).to.be.equal('223535')
      })

      it('should have sheet number at 22-24', () => {
        const entries = getConsolidatedEntries({
          procedures: new Array(30).fill({}, 0),
        })

        expect(entries[0].substr(21, 3), '0').to.be.equal('001')
        expect(entries[10].substr(21, 3), '10').to.be.equal('001')
        expect(entries[19].substr(21, 3), '19').to.be.equal('001')
        expect(entries[20].substr(21, 3), '20').to.be.equal('002')
        expect(entries[29].substr(21, 3), '29').to.be.equal('002')
      })

      it('should have sequential number at 25-26', () => {
        const entries = getConsolidatedEntries({
          procedures: new Array(30).fill({}, 0),
        })

        expect(entries[0].substr(24, 2), '0').to.be.equal('01')
        expect(entries[10].substr(24, 2), '10').to.be.equal('11')
        expect(entries[19].substr(24, 2), '19').to.be.equal('20')
        expect(entries[20].substr(24, 2), '20').to.be.equal('01')
        expect(entries[29].substr(24, 2), '29').to.be.equal('10')
      })

      it('should have code at 27-36', () => {
        let entry = getConsolidatedEntries({
          procedures: [{}],
        })[0]
        // defaults to zeros
        expect(entry.substr(26, 10)).to.be.equal('0000000000')

        entry = getConsolidatedEntries({
          procedures: [{ code: '03.02.04.005-6' }],
        })[0]
        expect(entry.substr(26, 10)).to.be.equal('0302040056')

        entry = getConsolidatedEntries({
          procedures: [{ code: '03.02.06.002-2' }],
        })[0]
        expect(entry.substr(26, 10)).to.be.equal('0302060022')
      })

      it('should have age at 37-39', () => {
        let entry = getConsolidatedEntries({
          procedures: [{}],
        })[0]
        // defaults to zeros
        expect(entry.substr(36, 3)).to.be.equal('000')

        entry = getConsolidatedEntries({
          procedures: [{ birthDate: subYears(new Date(), 40) }],
        })[0]
        expect(entry.substr(36, 3)).to.be.equal('040')

        entry = getConsolidatedEntries({
          procedures: [{ birthDate: subYears(new Date(), 51) }],
        })[0]
        expect(entry.substr(36, 3)).to.be.equal('051')
      })

      it('should have quantity at 40-45', () => {
        let entry = getConsolidatedEntries({
          procedures: [{}],
        })[0]
        // defaults to zeros
        expect(entry.substr(39, 6)).to.be.equal('000000')

        entry = getConsolidatedEntries({
          procedures: [{ quantity: 1 }],
        })[0]
        expect(entry.substr(39, 6)).to.be.equal('000001')

        entry = getConsolidatedEntries({
          procedures: [{ quantity: 12 }],
        })[0]
        expect(entry.substr(39, 6)).to.be.equal('000012')
      })

      it('should have origin at 46-48', () => {
        let entry = getConsolidatedEntries({
          procedures: [{}],
        })[0]
        // default to BPA
        expect(entry.substr(45, 3)).to.be.equal('BPA')

        entry = getConsolidatedEntries({
          procedures: [{ origin: 'BPA' }],
        })[0]
        expect(entry.substr(45, 3)).to.be.equal('BPA')

        entry = getConsolidatedEntries({
          procedures: [{ origin: 'PNI' }],
        })[0]
        expect(entry.substr(45, 3)).to.be.equal('PNI')
      })
    })

    describe('individual entries', () => {
      it('should have a identification code at 1-2', () => {
        const entry = getIndividualEntries({ procedures: [{}] })[0]
        expect(entry.substr(0, 2)).to.be.equal('03')
      })

      it('should have cnes at 3-9', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
          origin: { cnes: 1234 },
        })[0]
        expect(entry.substr(2, 7)).to.be.equal('0001234')

        entry = getIndividualEntries({
          procedures: [{}],
          origin: { cnes: 1234567 },
        })[0]
        expect(entry.substr(2, 7)).to.be.equal('1234567')
      })

      it('should have competence at 10-15', () => {
        const entry = getIndividualEntries({
          procedures: [{}],
          competence: {
            year: 2021,
            month: 1,
          },
        })[0]
        expect(entry.substr(9, 6)).to.be.equal('202101')

        const entry2 = getIndividualEntries({
          procedures: [{}],
          competence: {
            year: 2019,
            month: 11,
          },
        })[0]
        expect(entry2.substr(9, 6)).to.be.equal('201911')
      })

      it('should have cns at 16-30', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // defaults to white space
        // todo: since is required: throw an error
        expect(entry.substr(15, 15)).to.be.equal('               ')

        entry = getIndividualEntries({
          procedures: [{ cns: 123456789012345 }],
        })[0]
        expect(entry.substr(15, 15)).to.be.equal('123456789012345')

        entry = getIndividualEntries({
          procedures: [{ cns: 123456789010009 }],
        })[0]
        expect(entry.substr(15, 15)).to.be.equal('123456789010009')
      })

      it('should have cbo at 31-36', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // defaults to white space
        expect(entry.substr(30, 6)).to.be.equal('      ')

        entry = getIndividualEntries({
          procedures: [{ cbo: 223505 }],
        })[0]
        expect(entry.substr(30, 6)).to.be.equal('223505')

        entry = getIndividualEntries({
          procedures: [{ cbo: 223535 }],
        })[0]
        expect(entry.substr(30, 6)).to.be.equal('223535')
      })

      it('should have date at 37-44', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // defaults to white space
        expect(entry.substr(36, 8)).to.be.equal('        ')

        entry = getIndividualEntries({
          procedures: [{ date: new Date(2012, 9, 1) }],
        })[0]
        expect(entry.substr(36, 8)).to.be.equal('20121001')

        entry = getIndividualEntries({
          procedures: [{ date: new Date(2020, 11, 30) }],
        })[0]
        expect(entry.substr(36, 8)).to.be.equal('20201230')
      })

      it('should have sheet number at 45-47', () => {
        const entries = getIndividualEntries({
          procedures: new Array(30).fill({}, 0),
        })

        expect(entries[0].substr(44, 3), '0').to.be.equal('001')
        expect(entries[10].substr(44, 3), '10').to.be.equal('001')
        expect(entries[19].substr(44, 3), '19').to.be.equal('001')
        expect(entries[20].substr(44, 3), '20').to.be.equal('002')
        expect(entries[29].substr(44, 3), '29').to.be.equal('002')
      })

      it('should have sequential number at 48-49', () => {
        const entries = getIndividualEntries({
          procedures: new Array(30).fill({}, 0),
        })

        expect(entries[0].substr(47, 2), '0').to.be.equal('01')
        expect(entries[10].substr(47, 2), '10').to.be.equal('11')
        expect(entries[19].substr(47, 2), '19').to.be.equal('20')
        expect(entries[20].substr(47, 2), '20').to.be.equal('01')
        expect(entries[29].substr(47, 2), '29').to.be.equal('10')
      })

      it('should have code at 50-59', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // defaults to zeros
        expect(entry.substr(49, 10)).to.be.equal('0000000000')

        entry = getIndividualEntries({
          procedures: [{ code: '03.02.04.005-6' }],
        })[0]
        expect(entry.substr(49, 10)).to.be.equal('0302040056')

        entry = getIndividualEntries({
          procedures: [{ code: '03.02.06.002-2' }],
        })[0]
        expect(entry.substr(49, 10)).to.be.equal('0302060022')
      })
    })
  })
})

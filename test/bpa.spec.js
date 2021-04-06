import { expect } from 'chai'
import { defaultsDeep } from 'lodash-es'
import { subYears } from 'date-fns'
import { generateBPA } from '../src/bpa.js'

const getDefaultBPAOptions = () => {
  return {
    origin: {
      cnes: 97864,
      abbrev: 'HOSXYZ',
    },

    destination: {
      name: 'SEC ESTADUAL',
      indicator: 'E',
    },

    appInfo: 'MYAPP',

    competence: { year: 2020, month: 0 },

    procedures: [],
  }
}

const getHeader = (data, options) => {
  const mergedData = defaultsDeep({ ...data }, getDefaultBPAOptions())
  return generateBPA(mergedData, options).split('\r\n')[0]
}

const getConsolidatedEntries = (data, options) => {
  const mergedData = defaultsDeep({ ...data }, getDefaultBPAOptions())
  const lines = generateBPA(mergedData, options).split('\r\n')
  return lines.slice(1, mergedData.procedures.length + 1)
}

const getIndividualEntries = (data, options) => {
  const mergedData = defaultsDeep({ ...data }, getDefaultBPAOptions())
  const lines = generateBPA(mergedData, options).split('\r\n')
  return lines.slice(mergedData.procedures.length + 1, mergedData.procedures.length * 2 + 1)
}

const getBpaLines = (data, options) => {
  const mergedData = defaultsDeep({ ...data }, getDefaultBPAOptions())
  return generateBPA(mergedData, options).split('\r\n')
}

describe('BPA', () => {
  describe('generateBPA', () => {
    it('should create a correct header', () => {
      const header = getHeader({})

      expect(header.substr(0, 2), 'Indicador de linha do Header').to.be.equal('01')

      expect(header.substr(2, 5), 'Indicador de início do cabeçalho').to.be.equal('#BPA#')

      expect(
        header.substr(59, 6),
        'Sigla do órgão de origem responsável pela digitação'
      ).to.be.equal('HOSXYZ')

      expect(header.substr(79, 40), 'Nome do órgão de saúde destino do arquivo').to.be.equal(
        'SEC ESTADUAL                            '
      )

      expect(header.substr(119, 1), 'Indicador do órgão destino').to.be.equal('E')

      expect(header.substr(120, 10), 'Versão do sistema').to.be.equal('MYAPP     ')

      //expect(header.substr(130, 2), 'Fim do cabeçalho').to.be.equal('01')
    })

    describe('header', () => {
      it('should have competence at 8-13', () => {
        let header = getHeader({
          competence: {
            year: 2021,
            month: 0,
          },
        })
        expect(header.substr(7, 6)).to.be.equal('202101')

        header = getHeader({
          competence: {
            year: 2019,
            month: 10,
          },
        })
        expect(header.substr(7, 6)).to.be.equal('201911')

        header = getHeader({
          competence: new Date(2021, 0),
        })
        expect(header.substr(7, 6)).to.be.equal('202101')

        header = getHeader({
          competence: new Date(2019, 10),
        })
        expect(header.substr(7, 6)).to.be.equal('201911')
      })

      it('should have line count at 14-19', () => {
        let header = getHeader({ procedures: [{}] })
        expect(header.substr(13, 6)).to.be.equal('000002')

        header = getHeader({ procedures: new Array(20).fill({}, 0) })
        expect(header.substr(13, 6)).to.be.equal('000040')

        header = getHeader({ procedures: new Array(21).fill({}, 0) })
        expect(header.substr(13, 6)).to.be.equal('000042')

        header = getHeader({ procedures: [{}] }, { consolidated: false })
        expect(header.substr(13, 6)).to.be.equal('000001')

        header = getHeader({ procedures: new Array(20).fill({}, 0) }, { consolidated: false })
        expect(header.substr(13, 6)).to.be.equal('000020')

        header = getHeader({ procedures: new Array(21).fill({}, 0) }, { consolidated: false })
        expect(header.substr(13, 6)).to.be.equal('000021')

        header = getHeader({ procedures: [{}] }, { individual: false })
        expect(header.substr(13, 6)).to.be.equal('000001')

        header = getHeader({ procedures: new Array(20).fill({}, 0) }, { individual: false })
        expect(header.substr(13, 6)).to.be.equal('000020')

        header = getHeader({ procedures: new Array(21).fill({}, 0) }, { individual: false })
        expect(header.substr(13, 6)).to.be.equal('000021')
      })

      it('should have sheet count at 20-25', () => {
        let header = getHeader({ procedures: [{}] })
        expect(header.substr(19, 6)).to.be.equal('000002')

        header = getHeader({ procedures: new Array(20).fill({}, 0) })
        expect(header.substr(19, 6)).to.be.equal('000002')

        header = getHeader({ procedures: new Array(21).fill({}, 0) })
        expect(header.substr(19, 6)).to.be.equal('000004')

        header = getHeader({ procedures: [{}] }, { consolidated: false })
        expect(header.substr(19, 6)).to.be.equal('000001')

        header = getHeader({ procedures: new Array(20).fill({}, 0) }, { consolidated: false })
        expect(header.substr(19, 6)).to.be.equal('000001')

        header = getHeader({ procedures: new Array(21).fill({}, 0) }, { consolidated: false })
        expect(header.substr(19, 6)).to.be.equal('000002')

        header = getHeader({ procedures: [{}] }, { individual: false })
        expect(header.substr(19, 6)).to.be.equal('000001')

        header = getHeader({ procedures: new Array(20).fill({}, 0) }, { individual: false })
        expect(header.substr(19, 6)).to.be.equal('000001')

        header = getHeader({ procedures: new Array(21).fill({}, 0) }, { individual: false })
        expect(header.substr(19, 6)).to.be.equal('000002')
      })

      it('should have control code at 26-29', () => {
        let header = getHeader({ procedures: [{ code: '03.02.04.005-6', quantity: 1 }] })
        // code 0302040056 + 1 % 1111
        expect(header.substr(25, 4)).to.be.equal(`${(302040056 + 1) % 1111}`.padStart(4, '0'))

        header = getHeader({ procedures: [{ code: '03.02.04.005-6', quantity: 2 }] })
        // code 0302040056 + 2 % 1111
        expect(header.substr(25, 4)).to.be.equal(`${(302040056 + 2) % 1111}`.padStart(4, '0'))

        // code 0302040056 + 0302060022 + 3 % 1111
        header = getHeader({
          procedures: [
            { code: '03.02.04.005-6', quantity: 2 },
            { code: '03.02.06.002-2', quantity: 1 },
          ],
        })
        expect(header.substr(25, 4)).to.be.equal(
          `${(302040056 + 302060022 + 3) % 1111}`.padStart(4, '0')
        )
      })

      it('should have origin name or cpf at 30-59', () => {
        let header = getHeader({})
        expect(header.substr(29, 30)).to.be.equal('                              ')

        header = getHeader({ origin: { name: 'Hospital XYZ' } })
        expect(header.substr(29, 30)).to.be.equal('Hospital XYZ                  ')

        header = getHeader({ origin: { name: 'Hospital Arão' } })
        expect(header.substr(29, 30)).to.be.equal('Hospital Arao                 ')

        header = getHeader({ origin: { name: 'Hospital XYZ KKKKKKKKKKKKKKKKKKKKAAAAAAA' } })
        expect(header.substr(29, 30)).to.be.equal('Hospital XYZ KKKKKKKKKKKKKKKKK')
      })

      it('should have origin cnpj or cpf at 66-79', () => {
        let header = getHeader({})
        expect(header.substr(65, 14)).to.be.equal('00000000000000')

        header = getHeader({ origin: { cnpj: '123' } })
        expect(header.substr(65, 14)).to.be.equal('00000000000123')

        header = getHeader({ origin: { cnpj: 123 } })
        expect(header.substr(65, 14)).to.be.equal('00000000000123')

        header = getHeader({ origin: { cpf: 123 } })
        expect(header.substr(65, 14)).to.be.equal('00000000000123')

        header = getHeader({ origin: { cpf: '123' } })
        expect(header.substr(65, 14)).to.be.equal('00000000000123')

        header = getHeader({ origin: { cnpj: '12.319.513/0001-25' } })
        expect(header.substr(65, 14)).to.be.equal('12319513000125')
      })
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
        let entry = getConsolidatedEntries({
          procedures: [{}],
          competence: {
            year: 2021,
            month: 0,
          },
        })[0]
        expect(entry.substr(9, 6)).to.be.equal('202101')

        entry = getConsolidatedEntries({
          procedures: [{}],
          competence: {
            year: 2019,
            month: 10,
          },
        })[0]
        expect(entry.substr(9, 6)).to.be.equal('201911')

        entry = getConsolidatedEntries({
          procedures: [{}],
          competence: new Date(2021, 0),
        })[0]
        expect(entry.substr(9, 6)).to.be.equal('202101')

        entry = getConsolidatedEntries({
          procedures: [{}],
          competence: new Date(2019, 10),
        })[0]
        expect(entry.substr(9, 6)).to.be.equal('201911')
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
          procedures: [{ patient: { birthDate: subYears(new Date(), 40) } }],
        })[0]
        expect(entry.substr(36, 3)).to.be.equal('040')

        entry = getConsolidatedEntries({
          procedures: [{ patient: { birthDate: subYears(new Date(), 51) } }],
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
      it('should have no empty lines when consolidated is false', () => {
        const lines = getBpaLines({ procedures: [{}] }, { consolidated: false })
        expect(lines.length).to.be.equal(2)
        expect(lines[0]).to.not.be.empty
        expect(lines[1]).to.not.be.empty
      })

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

        entry = getIndividualEntries({
          procedures: [{}],
          origin: { cnes: '1234' },
        })[0]
        expect(entry.substr(2, 7)).to.be.equal('0001234')

        entry = getIndividualEntries({
          procedures: [{}],
          origin: { cnes: '\t1234\t' },
        })[0]
        expect(entry.substr(2, 7)).to.be.equal('0001234')

        entry = getIndividualEntries({
          procedures: [{}],
          origin: { cnes: ' 1234 ' },
        })[0]
        expect(entry.substr(2, 7)).to.be.equal('0001234')

        entry = getIndividualEntries({
          procedures: [{}],
          origin: { cnes: '1234567' },
        })[0]
        expect(entry.substr(2, 7)).to.be.equal('1234567')
      })

      it('should have competence at 10-15', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
          competence: {
            year: 2021,
            month: 0,
          },
        })[0]
        expect(entry.substr(9, 6)).to.be.equal('202101')

        entry = getIndividualEntries({
          procedures: [{}],
          competence: {
            year: 2019,
            month: 10,
          },
        })[0]
        expect(entry.substr(9, 6)).to.be.equal('201911')

        entry = getIndividualEntries({
          procedures: [{}],
          competence: new Date(2021, 0),
        })[0]
        expect(entry.substr(9, 6)).to.be.equal('202101')

        entry = getIndividualEntries({
          procedures: [{}],
          competence: new Date(2019, 10),
        })[0]
        expect(entry.substr(9, 6)).to.be.equal('201911')
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

      it('should have patient cns at 60-74', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // defaults to white space
        // todo: since is required: throw an error
        expect(entry.substr(59, 15)).to.be.equal('               ')

        entry = getIndividualEntries({
          procedures: [{ patient: { cns: 123456789012345 } }],
        })[0]
        expect(entry.substr(59, 15)).to.be.equal('123456789012345')

        entry = getIndividualEntries({
          procedures: [{ patient: { cns: 123456789010009 } }],
        })[0]
        expect(entry.substr(59, 15)).to.be.equal('123456789010009')
      })

      it('should have patient gender at 75', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // defaults to white space
        // todo: throw an error?
        expect(entry.substr(74, 1)).to.be.equal(' ')

        entry = getIndividualEntries({
          procedures: [{ patient: { gender: 'M' } }],
        })[0]
        expect(entry.substr(74, 1)).to.be.equal('M')

        entry = getIndividualEntries({
          procedures: [{ patient: { gender: 'F' } }],
        })[0]
        expect(entry.substr(74, 1)).to.be.equal('F')

        entry = getIndividualEntries({
          procedures: [{ patient: { gender: 'FEMALE' } }],
        })[0]
        expect(entry.substr(74, 1)).to.be.equal('F')
      })

      it('should have patient ibge at 76-81', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // defaults to white space
        // todo: throw an error?
        expect(entry.substr(75, 6)).to.be.equal('      ')

        entry = getIndividualEntries({
          procedures: [{ patient: { ibge: 1234 } }],
        })[0]
        expect(entry.substr(75, 6)).to.be.equal('1234  ')

        entry = getIndividualEntries({
          procedures: [{ patient: { ibge: 123456 } }],
        })[0]
        expect(entry.substr(75, 6)).to.be.equal('123456')

        entry = getIndividualEntries({
          procedures: [{ patient: { gender: 'FEMALE', ibge: 123456 } }],
        })[0]
        expect(entry.substr(75, 6)).to.be.equal('123456')
      })

      it('should have cid at 82-85', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // defaults to white space
        // todo: throw an error?
        expect(entry.substr(81, 4)).to.be.equal('    ')

        entry = getIndividualEntries({
          procedures: [{ cid: 'E11' }],
        })[0]
        expect(entry.substr(81, 4)).to.be.equal('E11 ')

        entry = getIndividualEntries({
          procedures: [{ cid: 'E112' }],
        })[0]
        expect(entry.substr(81, 4)).to.be.equal('E112')

        entry = getIndividualEntries({
          procedures: [{ cid: 'E112', patient: { ibge: 1234567 } }],
        })[0]
        expect(entry.substr(81, 4)).to.be.equal('E112')
      })

      it('should have patient age at 86-88', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // // defaults to zeros
        expect(entry.substr(85, 3)).to.be.equal('000')

        entry = getIndividualEntries({
          procedures: [{ patient: { birthDate: subYears(new Date(), 40) } }],
        })[0]
        expect(entry.substr(85, 3)).to.be.equal('040')

        entry = getIndividualEntries({
          procedures: [{ patient: { birthDate: subYears(new Date(), 35) } }],
        })[0]
        expect(entry.substr(85, 3)).to.be.equal('035')

        entry = getIndividualEntries({
          procedures: [{ patient: { cid: 'E112x', birthDate: subYears(new Date(), 35) } }],
        })[0]
        expect(entry.substr(85, 3)).to.be.equal('035')
      })

      it('should have quantity at 89-94', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // // defaults to zeros
        expect(entry.substr(88, 6)).to.be.equal('000000')

        entry = getIndividualEntries({
          procedures: [{ quantity: 2 }],
        })[0]
        expect(entry.substr(88, 6)).to.be.equal('000002')

        entry = getIndividualEntries({
          procedures: [{ quantity: 25 }],
        })[0]
        expect(entry.substr(88, 6)).to.be.equal('000025')

        entry = getIndividualEntries({
          procedures: [{ patient: { birthDate: subYears(new Date(), 1000) }, quantity: 25 }],
        })[0]
        expect(entry.substr(88, 6)).to.be.equal('000025')
      })

      it('should have character at 95-96', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // // defaults to 01
        expect(entry.substr(94, 2)).to.be.equal('01')

        entry = getIndividualEntries({
          procedures: [{ character: 2 }],
        })[0]
        expect(entry.substr(94, 2)).to.be.equal('02')

        entry = getIndividualEntries({
          procedures: [{ character: 25 }],
        })[0]
        expect(entry.substr(94, 2)).to.be.equal('25')

        entry = getIndividualEntries({
          procedures: [{ quantity: 1234567, character: 25 }],
        })[0]
        expect(entry.substr(94, 2)).to.be.equal('25')
      })

      it('should have authorization at 97-109', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // defaults to white space
        // todo: throw an error?
        expect(entry.substr(96, 13)).to.be.equal('             ')

        entry = getIndividualEntries({
          procedures: [{ authorization: 1234567890123 }],
        })[0]
        expect(entry.substr(96, 13)).to.be.equal('1234567890123')

        entry = getIndividualEntries({
          procedures: [{ authorization: 123 }],
        })[0]
        expect(entry.substr(96, 13)).to.be.equal('123          ')

        entry = getIndividualEntries({
          procedures: [{ authorization: 1234567890123, character: 100 }],
        })[0]
        expect(entry.substr(96, 13)).to.be.equal('1234567890123')
      })

      it('should have origin at 110-112', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // // defaults to 'BPA'
        expect(entry.substr(109, 3)).to.be.equal('BPA')

        entry = getIndividualEntries({
          procedures: [{ origin: 'BPA' }],
        })[0]
        expect(entry.substr(109, 3)).to.be.equal('BPA')

        entry = getIndividualEntries({
          procedures: [{ origin: 'PNI' }],
        })[0]
        expect(entry.substr(109, 3)).to.be.equal('PNI')

        entry = getIndividualEntries({
          procedures: [{ authorization: 12345678901239, origin: 'BPA' }],
        })[0]
        expect(entry.substr(109, 3)).to.be.equal('BPA')
      })

      it('should have patient name at 113-142', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // // defaults to '   '
        expect(entry.substr(112, 30)).to.be.equal('                              ')

        entry = getIndividualEntries({
          procedures: [{ patient: { name: 'Luiz Américo' } }],
        })[0]
        expect(entry.substr(112, 30)).to.be.equal('Luiz Americo                  ')

        entry = getIndividualEntries({
          procedures: [{ patient: { name: 'Luiz Américo Pereira Camara da Silva Sauro' } }],
        })[0]
        expect(entry.substr(112, 30)).to.be.equal('Luiz Americo Pereira Camara da')

        entry = getIndividualEntries({
          procedures: [{ origin: 'BPAX', patient: { name: 'LUIZ AMÉRICO' } }],
        })[0]
        expect(entry.substr(112, 30)).to.be.equal('LUIZ AMERICO                  ')
      })

      it('should have patient birthDate at 143-150', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // // defaults to '   '
        expect(entry.substr(142, 8)).to.be.equal('        ')

        entry = getIndividualEntries({
          procedures: [{ patient: { birthDate: new Date(1978, 5, 18) } }],
        })[0]
        expect(entry.substr(142, 8)).to.be.equal('19780618')

        entry = getIndividualEntries({
          procedures: [{ patient: { birthDate: new Date(1950, 10, 1) } }],
        })[0]
        expect(entry.substr(142, 8)).to.be.equal('19501101')

        entry = getIndividualEntries({
          procedures: [
            {
              patient: {
                name: 'Luiz Américo Pereira Camara da Silva Sauro',
                birthDate: new Date(1950, 10, 1),
              },
            },
          ],
        })[0]
        expect(entry.substr(142, 8)).to.be.equal('19501101')
      })

      it('should have patient race at 151-152', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // // defaults to '99'
        expect(entry.substr(150, 2)).to.be.equal('99')

        entry = getIndividualEntries({
          procedures: [{ patient: { race: 1 } }],
        })[0]
        expect(entry.substr(150, 2)).to.be.equal('01')

        entry = getIndividualEntries({
          procedures: [{ patient: { race: 2 } }],
        })[0]
        expect(entry.substr(150, 2)).to.be.equal('02')
      })

      it('should have patient ethnicity at 153-156', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // // defaults to ' '
        expect(entry.substr(152, 4)).to.be.equal('    ')

        entry = getIndividualEntries({
          procedures: [{ patient: { ethnicity: 1 } }],
        })[0]
        expect(entry.substr(152, 4)).to.be.equal('1   ')

        entry = getIndividualEntries({
          procedures: [{ patient: { ethnicity: 2 } }],
        })[0]
        expect(entry.substr(152, 4)).to.be.equal('2   ')
      })

      it('should have patient nationality at 157-159', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // // defaults to '010'
        expect(entry.substr(156, 3)).to.be.equal('010')

        entry = getIndividualEntries({
          procedures: [{ patient: { nationality: 1 } }],
        })[0]
        expect(entry.substr(156, 3)).to.be.equal('001')

        entry = getIndividualEntries({
          procedures: [{ patient: { nationality: 21 } }],
        })[0]
        expect(entry.substr(156, 3)).to.be.equal('021')
      })

      it('should have service code at 160-162', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // defaults to '   '
        // todo implement
        expect(entry.substr(159, 3)).to.be.equal('   ')
      })

      it('should have classification code at 163-165', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // defaults to '   '
        // todo implement
        expect(entry.substr(162, 3)).to.be.equal('   ')
      })

      it('should have sequence code at 166-173', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // defaults to '   '
        // todo implement
        expect(entry.substr(165, 8)).to.be.equal('        ')
      })

      it('should have area code at 174-177', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // defaults to '   '
        // todo implement
        expect(entry.substr(173, 4)).to.be.equal('    ')
      })

      it('should have maintainer cnpj at 178-191', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // defaults to '   '
        // todo implement
        expect(entry.substr(177, 14)).to.be.equal('              ')
      })

      it('should have patient cep at 192-199', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // // defaults to ' '
        expect(entry.substr(191, 8)).to.be.equal('        ')

        entry = getIndividualEntries({
          procedures: [{ patient: { cep: 40221225 } }],
        })[0]
        expect(entry.substr(191, 8)).to.be.equal('40221225')

        entry = getIndividualEntries({
          procedures: [{ patient: { cep: 123 } }],
        })[0]
        expect(entry.substr(191, 8)).to.be.equal('00000123')
      })

      it('should have patient place code at 200-202', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // // defaults to ' '
        expect(entry.substr(199, 3)).to.be.equal('   ')

        entry = getIndividualEntries({
          procedures: [{ patient: { placeCode: 5 } }],
        })[0]
        expect(entry.substr(199, 3)).to.be.equal('005')

        entry = getIndividualEntries({
          procedures: [{ patient: { placeCode: 12 } }],
        })[0]
        expect(entry.substr(199, 3)).to.be.equal('012')
      })

      it('should have patient address at 203-232', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // // defaults to ' '
        expect(entry.substr(202, 30)).to.be.equal('                              ')

        entry = getIndividualEntries({
          procedures: [{ patient: { address: 'Rua bartolómeu 15' } }],
        })[0]
        expect(entry.substr(202, 30)).to.be.equal('Rua bartolomeu 15             ')

        entry = getIndividualEntries({
          procedures: [{ patient: { address: 'Rua bartolomeu 15 ÃXXXCXCXCXCXAAAAAA' } }],
        })[0]
        expect(entry.substr(202, 30)).to.be.equal('Rua bartolomeu 15 AXXXCXCXCXCX')
      })

      it('should have patient address complement at 233-242', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // // defaults to ' '
        expect(entry.substr(232, 10)).to.be.equal('          ')

        entry = getIndividualEntries({
          procedures: [{ patient: { addressComplement: 'Áp 15' } }],
        })[0]
        expect(entry.substr(232, 10)).to.be.equal('Ap 15     ')

        entry = getIndividualEntries({
          procedures: [{ patient: { addressComplement: 'Áp 15 perto de supermercado' } }],
        })[0]
        expect(entry.substr(232, 10)).to.be.equal('Ap 15 pert')
      })

      it('should have patient address number at 243-247', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // // defaults to ' '
        expect(entry.substr(242, 5)).to.be.equal('     ')

        entry = getIndividualEntries({
          procedures: [{ patient: { addressNumber: '10' } }],
        })[0]
        expect(entry.substr(242, 5)).to.be.equal('10   ')

        entry = getIndividualEntries({
          procedures: [{ patient: { addressNumber: '12345678' } }],
        })[0]
        expect(entry.substr(242, 5)).to.be.equal('12345')
      })

      it('should have patient address district at 248-277', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // // defaults to ' '
        expect(entry.substr(247, 30)).to.be.equal('                              ')

        entry = getIndividualEntries({
          procedures: [{ patient: { addressDistrict: 'Rio vérmelho' } }],
        })[0]
        expect(entry.substr(247, 30)).to.be.equal('Rio vermelho                  ')

        entry = getIndividualEntries({
          procedures: [{ patient: { addressDistrict: 'Rio vérmelho engenho velho da federação' } }],
        })[0]
        expect(entry.substr(247, 30)).to.be.equal('Rio vermelho engenho velho da ')
      })

      it('should have patient phone at 278-288', () => {
        let entry = getIndividualEntries({
          procedures: [{}],
        })[0]
        // // defaults to ' '
        expect(entry.substr(277, 11)).to.be.equal('           ')

        entry = getIndividualEntries({
          procedures: [{ patient: { phone: '1234567' } }],
        })[0]
        expect(entry.substr(277, 11)).to.be.equal('1234567    ')

        entry = getIndividualEntries({
          procedures: [{ patient: { phone: '123-45 67' } }],
        })[0]
        expect(entry.substr(277, 11)).to.be.equal('1234567    ')

        entry = getIndividualEntries({
          procedures: [{ patient: { phone: '12345678901234' } }],
        })[0]
        expect(entry.substr(277, 11)).to.be.equal('12345678901')
      })
    })

    it('should have patient email at 289-328', () => {
      let entry = getIndividualEntries({
        procedures: [{}],
      })[0]
      // // defaults to ' '
      expect(entry.substr(288, 40)).to.be.equal('                                        ')

      entry = getIndividualEntries({
        procedures: [{ patient: { email: 'xxxxxxxxxx@gmail.com' } }],
      })[0]
      expect(entry.substr(288, 40)).to.be.equal('xxxxxxxxxx@gmail.com                    ')

      entry = getIndividualEntries({
        procedures: [
          { patient: { email: 'xxxxxxxxxxxxxxxx@gmailaaaaaaaaaaaaaaaaaaaaaaaaaaaa.com' } },
        ],
      })[0]
      expect(entry.substr(288, 40)).to.be.equal('xxxxxxxxxxxxxxxx@gmailaaaaaaaaaaaaaaaaaa')
    })

    it('should have national id at 329-338', () => {
      let entry = getIndividualEntries({
        procedures: [{}],
      })[0]
      // defaults to ' '
      expect(entry.substr(328, 10)).to.be.equal('          ')

      entry = getIndividualEntries({
        procedures: [{ nationalId: 5 }],
      })[0]
      expect(entry.substr(328, 10)).to.be.equal('0000000005')

      entry = getIndividualEntries({
        procedures: [{ nationalId: 12345678901 }],
      })[0]
      expect(entry.substr(328, 10)).to.be.equal('1234567890')
    })
  })
})

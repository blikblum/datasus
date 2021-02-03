import { generateBPA } from '../src/bpa.js'

const getDefaultBPAOptions = () => {
  return {
    origin: {
      name: 'Hospital XYZ',
      cnpj: '12345678901234',
      abbrev: 'HOSXYZ',
    },

    destination: {
      name: 'SEC ESTADUAL',
      indicator: 'E',
    },

    appInfo: 'MYAPP',

    competence: { year: 2020, month: 1 },
  }
}

describe('BPA', () => {
  describe('generateBPA', () => {
    it('should create a correct header', () => {
      const options = getDefaultBPAOptions()
      const lines = generateBPA(options).split('\n')
      const header = lines[0]

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
  })
})

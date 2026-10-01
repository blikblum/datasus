import { generateBPA } from '../../src/index.js'

export const validProcedure = {
  cns: '000000000000001',
  cbo: '223605',
  code: '0302040030',
  quantity: 1,
  date: new Date(2026, 7, 1),
  nationalId: 7,
  patient: {
    name: 'Paciente Teste',
    birthDate: new Date(1990, 0, 2),
    cpf: '12345678901',
    gender: 'F',
    race: 3,
  },
}

export const getValidBPAExport = (procedures = [validProcedure], options) =>
  generateBPA(
    {
      competence: { year: 2026, month: 7 },
      origin: { cnes: '0001234', name: 'Unidade de teste' },
      procedures,
    },
    options
  )

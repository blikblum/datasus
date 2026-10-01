import { TextDecoder, TextEncoder } from 'node:util'
import { generateBPA } from '../../src/index.js'

export const getShiftedBPAExport = () => {
  const lines = generateBPA({
    competence: { year: 2026, month: 7 },
    origin: { cnes: '0001234', name: 'Unidade de teste' },
    procedures: [
      {
        cns: '000000000000001',
        cbo: '223605',
        code: '0302040030',
        quantity: 1,
        date: new Date(2026, 7, 1),
        patient: {
          name: 'Paciente Teste',
          birthDate: new Date(1969, 0, 2),
          cpf: '12345670553',
        },
      },
    ],
  }).split('\r\n')
  // Insert after generation so normalization cannot replace the corrupted glyphs.
  lines[2] =
    lines[2].slice(0, 112) + 'PACIENTE \uFFFD\uFFFD TESTE'.padEnd(30, ' ') + lines[2].slice(142)
  const utf8Text = lines.join('\r\n')
  const bytes = new TextEncoder().encode(utf8Text)

  return { utf8Text, windows1252Text: new TextDecoder('windows-1252').decode(bytes) }
}

# datasus

[![NPM version](http://img.shields.io/npm/v/datasus.svg?style=flat-square)](https://www.npmjs.com/package/datasus)
[![NPM downloads](http://img.shields.io/npm/dm/datasus.svg?style=flat-square)](https://www.npmjs.com/package/datasus)

`datasus` is a JavaScript library for working with DATASUS BPA (outpatient
production bulletin) fixed-width exports. It generates consolidated (BPAC) and
individual (BPAI) records, parses exports, and reads BPAI occurrences from
consistency reports.

## Installation

```sh
npm install datasus
```

The package uses ES modules. Import its public functions from `datasus`:

```js
import { generateBPA, parseBPA, parseBPARaw, parseBPAErrorReport } from 'datasus'
```

## Generate a BPA export

```js
const exportText = generateBPA(
  {
    competence: { year: 2026, month: 7 }, // August; month is zero-based
    origin: {
      cnes: '0001234',
      name: 'Health Unit',
      abbrev: 'UNIT',
      cnpj: '12.345.678/0001-90',
    },
    destination: { name: 'Health Department', indicator: 'E' },
    appInfo: 'MYAPP',
    procedures: [
      {
        code: '03.02.04.005-6',
        cbo: '223605',
        cns: '552083124090009', // professional CNS
        date: new Date(2026, 7, 12),
        quantity: 1,
        patient: {
          cns: '123456789012345',
          name: 'Ana Lima',
          birthDate: new Date(1990, 4, 10),
          gender: 'F',
        },
      },
    ],
  },
  { consolidated: false } // emit only BPAI records
)
```

`generateBPA(data, options)` returns a string with a header and CRLF-separated
fixed-width records. By default, **each procedure produces both** a consolidated
(`02`) and an individual (`03`) record. Set `consolidated: false` or
`individual: false` to generate only one kind. Records are numbered in sheets of
20 entries per kind. `competence` can also be a `Date`; in the object form,
`month` follows JavaScript's zero-based month numbering. Procedure and patient
dates must be `Date` objects. The generator formats fields to their fixed widths
but does not validate whether their values satisfy DATASUS business rules.

For individual records, supply either `patient.cpf` or `patient.cns`. If both are
provided, the generator emits the CPF and leaves the patient CNS field blank.

## Parse a BPA export

```js
const { records, errors } = parseBPA(exportText)
console.log(records.individual[0].patient.name) // 'Ana Lima'
console.log(records.individual[0].sheetNumber) // 1
console.log(errors) // all layout validation errors, or []
```

`parseBPA(text)` returns `{ records, errors }`. `records` contains
`{ consolidated, individual }` arrays in file order, including records with
validation errors. This is a breaking change from the previous return shape:
access `result.records.individual` instead of `result.individual`.

The parser skips headers and blank lines, accepts CRLF, LF, and CR line endings,
and checks BPAC/BPAI fields against the production-record rules in
[the export layout](resources/Layout_Exportacao_BPA.pdf). Validation covers widths,
required fields, numeric formats and padding, dates and competence, sheet/sequence
and age ranges, declared choices, and ethnicity/race rules. Patient CPF and CNS
must not be supplied together; supplying both reports a `patient.cpf` error while
preserving both identifiers in the parsed record. Both fields are optional.
INE (`nationalId`) is optional; when supplied,
it must contain ten digits, padded with zeros on the left. Field requirements
and availability do not depend on competence. The current layout widths
(48 and 351 characters, excluding line endings) apply to all competences.
Header rules, check-digit algorithms, external code-table membership, and
procedure-dependent requirements are not checked. The generator may produce
records with validation errors.

Parsed dates are `Date` objects, numeric fields such as quantity and sheet number
are numbers, and most identifiers remain strings to preserve leading zeros.
Unparseable native fields become `null`; blank optional dates and flags also
become `null` without errors. Values that convert successfully remain available
even if a range or cross-field rule rejects them. Original identifier strings
remain available even when invalid.

Validation continues through every field and line. Each error contains
`lineNumber` (one-based physical line), `recordType`, `field`, `value`, and
`message`. Field paths use names such as `patient.homeless`; `field` is `null`
for a record-width error. `value` is the trimmed field string, or the full line
for a width error. Errors follow physical-line and field-layout order. Unknown
record types are reported and skipped; short and overlong recognized records
remain in the result. Non-string input still throws a `TypeError`.

```js
// Example field error:
// { lineNumber: 26, recordType: '03', field: 'patient.homeless',
//   value: '0', message: 'Expected one of: S, N' }
```

To inspect fields without converting or validating their values, use
`parseBPARaw(text)`:

```js
const raw = parseBPARaw(exportText)
console.log(raw.individual[0].sheetNumber) // '001'
console.log(raw.individual[0].date) // '20260812'
console.log(raw.individual[0].patient.homeless) // 'N'
```

It returns `{ consolidated, individual }`, with every field represented as a
trimmed string. Leading zeros are preserved and blank or missing fields become
`''`. No line-length checks are performed: extraction uses fixed positions in
short and overlong records, ignoring characters beyond the layout. It does not
realign shifted fields or move trailing flags into their intended positions.
Unknown record types and non-string input still throw errors.

Both parsers operate on already decoded text; neither converts file encoding,
normalizes Unicode, nor repairs fields shifted by incorrect decoding.

## Parse a BPA consistency report

```js
const report = `CNES : 0001234 Health Unit
BPAI 08/2026 001/01 0302040056 223605 552083124090009 INVALID PATIENT POSTAL CODE`

const occurrences = parseBPAErrorReport(report)
console.log(occurrences[0].occurrence) // 'INVALID PATIENT POSTAL CODE'
```

`parseBPAErrorReport(text)` returns one object per BPAI occurrence, with `cnes`,
`type`, `competence` (`YYYYMM`), `sheetNumber`, `sequenceNumber`, `procedureCode`,
`cbo`, `professionalCns`, and `occurrence`. These values are strings, including
sheet and sequence numbers. The report must contain a `CNES` section before its
BPAI rows. It accepts CRLF, LF, or CR line endings, including printer reports with
page breaks and repeated headings. BPAC report rows are currently unsupported.

## Demo

The [browser demo](https://blikblum.github.io/datasus/) has two tabs. **Check errors** links
BPAI occurrences in a consistency report to patients and physical lines in a BPA export.
**View export** shows individual and consolidated records in separate, paginated tables,
with native data, raw field strings, and the original line available for each row.
Matched patients also expose these representations. Both tabs decode export files
exclusively as Windows-1252 to reproduce the positions read by the BPA program,
even when the uploaded bytes were written as UTF-8. Error reports use UTF-8 with
a Windows-1252 fallback. Both tabs display an error count and the complete
validation error list while preserving partial native records, raw field strings,
and complete decoded original lines. Record details and matched-patient cards
include their own validation errors. Unknown types do not prevent later records
from loading; short and overlong recognized records remain inspectable. Records
with malformed matching keys cannot produce accidental report matches. Files
are processed entirely in the browser and are not sent to a server.

To run the demo locally:

```sh
yarn install
yarn dev
```

Open the URL shown by Vite. To test the production build, run `yarn build:demo`
and `yarn preview:demo`. The build output is in `dist/`.

GitHub Pages deployment runs automatically on every push to `gh-pages`. You can also
start it manually from **Actions → Deploy BPA demo to GitHub Pages**. Before the
first deployment, select **Settings → Pages → Build and deployment → Source:
GitHub Actions** in the repository. The page uses the `/datasus/` path and is
available at `https://blikblum.github.io/datasus/`.

### License

Copyright © 2018-2026 Luiz Américo Pereira Câmara. This source code is licensed under the MIT license found in
the [LICENSE.txt](https://github.com/blikblum/datasus/blob/master/LICENSE.txt) file.
The documentation to the project is licensed under the [CC BY-SA 4.0](http://creativecommons.org/licenses/by-sa/4.0/)
license.

---

Made with ♥ by Luiz Américo Pereira Câmara and [contributors](https://github.com/blikblum/datasus/graphs/contributors)

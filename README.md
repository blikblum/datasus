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

## Parse a BPA export

```js
const { consolidated, individual } = parseBPA(exportText)
console.log(individual[0].patient.name) // 'Ana Lima'
console.log(individual[0].sheetNumber) // 1
```

`parseBPA(text)` returns `{ consolidated, individual }` arrays in file order. It
skips the header and blank lines. Parsed dates are `Date` objects (or `null` for
blank dates), numeric fields such as quantity and sheet number are numbers, and
most identifiers remain strings to preserve leading zeros. It accepts CRLF, LF,
or CR line endings and reports malformed record widths or fields with line numbers.

To inspect fields without converting their values, use `parseBPARaw(text)`:

```js
const raw = parseBPARaw(exportText)
console.log(raw.individual[0].sheetNumber) // '001'
console.log(raw.individual[0].date) // '20260812'
console.log(raw.individual[0].patient.homeless) // 'N'
```

It returns the same structure as `parseBPA`, with every field represented as a
trimmed string. Leading zeros are preserved and blank fields become `''`.
Invalid dates, numeric values, and flags remain available for inspection instead
of causing conversion errors. Record types and exact widths are still validated
by default. To inspect overlong records at their original fixed positions, use:

```js
const raw = parseBPARaw(decodedText, { allowExtraCharacters: true })
```

This option accepts records longer than 48 (consolidated) or 351 (individual)
characters, ignoring characters beyond the layout when extracting fields.
Short records and unknown record types are still rejected. It does not realign
shifted fields or move trailing flags into their intended positions. `parseBPA`
always requires exact record widths.

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
a Windows-1252 fallback. The demo enables raw inspection of overlong records and
preserves each complete decoded original line. If native parsing fails, both tabs
show the error and use raw values for the entire file; short records and unknown
types still prevent loading. Files are processed
entirely in the browser and are not sent to a server.

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

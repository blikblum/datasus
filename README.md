# datasus

[![NPM version](http://img.shields.io/npm/v/datasus.svg?style=flat-square)](https://www.npmjs.com/package/datasus)
[![NPM downloads](http://img.shields.io/npm/dm/datasus.svg?style=flat-square)](https://www.npmjs.com/package/datasus)
[![Build Status](http://img.shields.io/travis/blikblum/datasus/master.svg?style=flat-square)](https://travis-ci.org/blikblum/datasus)
[![Coverage Status](https://img.shields.io/coveralls/blikblum/datasus.svg?style=flat-square)](https://coveralls.io/github/blikblum/datasus)
[![Dependency Status](http://img.shields.io/david/dev/blikblum/datasus.svg?style=flat-square)](https://david-dm.org/blikblum/datasus#info=devDependencies)

> datasus is a JavaScript library


### Features

&nbsp; &nbsp; ✓ Great<br>


### Documentation

* [Getting Started](docs/getting-started.md)

## Demonstração

A página [Verificar erros](https://blikblum.github.io/datasus/) relaciona cada ocorrência
BPAI de um relatório de consistência ao paciente e à linha física correspondente em uma
exportação BPA. Os arquivos são processados somente no navegador e não são enviados a um servidor.

Para rodar localmente:

```sh
yarn install
yarn dev
```

Abra o endereço indicado pelo Vite. Para testar a versão pronta para publicação,
execute `yarn build:demo` e `yarn preview:demo`. O build fica em `dist/`.

A publicação no GitHub Pages é automática em cada push para `master` e também pode
ser iniciada manualmente em **Actions → Deploy BPA demo to GitHub Pages**. Antes da
primeira publicação, selecione **Settings → Pages → Build and deployment → Source:
GitHub Actions** no repositório. A página usa o caminho `/datasus/`, correspondente
a `https://blikblum.github.io/datasus/`.

### Get in Touch

* [#datasus](https://gitter.im/blikblum/datasus) on Gitter

### License

Copyright © 2018 Luiz Américo Pereira Câmara. This source code is licensed under the MIT license found in
the [LICENSE.txt](https://github.com/blikblum/datasus/blob/master/LICENSE.txt) file.
The documentation to the project is licensed under the [CC BY-SA 4.0](http://creativecommons.org/licenses/by-sa/4.0/)
license.

---
Made with ♥ by Luiz Américo Pereira Câmara and [contributors](https://github.com/blikblum/datasus/graphs/contributors)

# sc4-plugin-manager

SC4 Plugin Manager interface using Electron.

Produces a portable `.exe` file (no installation / dependencies).

_Currently supports Windows only._

## Project Setup

### Install

```bash
$ yarn
```

### Develop (with hot reloading)

Powered by [electron-vite](https://electron-vite.org/).

```bash
$ yarn dev
```

### Preview

Powered by [electron-vite](https://electron-vite.org/).

```bash
$ yarn preview
```

### Production build

Transpiled by [electron-vite](https://electron-vite.org/) and packaged with [electron-build](https://www.electron.build/).

```bash
$ yarn make
```

This is equivalent to running both steps in succession:

```bash
$ yarn build
$ yarn package
```

### Tooling (TypeScript, ESLint, Prettier)

Using [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/).

```bash
$ yarn format
$ yarn lint
$ yarn typecheck
```

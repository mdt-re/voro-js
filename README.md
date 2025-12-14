# voro-js

An [Emscripten](https://emscripten.org/) implementation of [voro++](https://github.com/chr1shr/voro) for Javascript & WebAssembly. This exposes the main functions of the voro++ library to Javascript to allow for the dynamic generation of 3D Voronoi tessellations. See the docs for more information.

## Usage with npm

Clone this repository and add a copy of [voro++](https://github.com/chr1shr/voro) to the voro-js/voro++ directory. For local use then run:
```bash
npm run build
npm link
```

inside the repository directory and then link in the project directory with
```bash
npm link @mdt-re/voro-js
```

## Documentation

Full API documentation, advanced usage, and a guide on memory management can be found in the docs.

## Examples

## Tests
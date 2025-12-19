# voro-js

An [Emscripten](https://emscripten.org/) implementation of [voro++](https://github.com/chr1shr/voro) for TypeScript & WebAssembly. This exposes the main functions of the voro++ library to TypeScript to allow for the dynamic generation of 3D Voronoi tessellations. Have a look at the examples and the docs for more information.

## Examples

<table>
  <tr>
    <td align="center">
      <a href="https://mdt-re.github.io/voro-js/examples/moving_cell.html">
        <img src="examples/assets/moving_cell.png" width="250px" alt="Moving Cell" /><br />
        <b>Moving Cell</b>
      </a>
    </td>
    <td align="center">
      <a href="https://mdt-re.github.io/voro-js/examples/single_cell.html">
        <img src="examples/assets/single_cell.png" width="250px" alt="Single Cell" /><br />
        <b>Single Cell</b>
      </a>
    </td>
    <td align="center">
      <a href="https://mdt-re.github.io/voro-js/examples/voronoi_relaxation.html">
        <img src="examples/assets/voronoi_relaxation.png" width="250px" alt="Voronoi Relaxation" /><br />
        <b>Voronoi Relaxation</b>
      </a>
    </td>
  </tr>
</table>
See the examples [README](examples/README.md) for detailed instructions on how to run or deploy them.

## Documentation

Full API documentation, advanced usage, and a guide on memory management can be found in the docs.

## Installation

Clone this repository and add a copy of [voro++](https://github.com/chr1shr/voro) to the voro-js/voro++ directory. For local use then run:
```bash
npm run build
npm link
```

inside the repository directory and then link in the project directory with
```bash
npm link @mdt-re/voro-js
```

## Development

Testing is done using Mocha and Chai to verify the functionality of the Voro++ WebAssembly wrapper, in particular the elements `VoronoiContext3D` and `VoronoiCell3D`. To run the tests, execute the following command in the project directory:
```bash
npm test
```

Bugs and pull requests can be posted in the issues [tracker](https://github.com/mdt-re/voro-js/issues).
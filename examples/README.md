# voro-js Examples

Click on the image to view the example. Each example corresponds to the respective source code in this folder.

<table>
  <tr>
    <td align="center">
      <a href="https://mdt-re.github.io/voro-js/examples/moving_cell.html">
        <img src="assets/moving_cell.png" width="250px" alt="Moving Cell" /><br />
        <b>Moving Cell</b>
      </a>
    </td>
    <td align="center">
      <a href="https://mdt-re.github.io/voro-js/examples/single_cell.html">
        <img src="assets/single_cell.png" width="250px" alt="Single Cell" /><br />
        <b>Single Cell</b>
      </a>
    </td>
    <td align="center">
      <a href="https://mdt-re.github.io/voro-js/examples/voronoi_relaxation.html">
        <img src="assets/voronoi_relaxation.png" width="250px" alt="Voronoi Relaxation" /><br />
        <b>Voronoi Relaxation</b>
      </a>
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="https://mdt-re.github.io/voro-js/examples/curve_game.html">
        <img src="assets/curve_game.png" width="250px" alt="Curve Game" /><br />
        <b>Curve Game</b>
      </a>
    </td>
    <td align="center">
      <a href="https://mdt-re.github.io/voro-js/examples/custom_geometry.html">
        <img src="assets/custom_geometry.png" width="250px" alt="Custom Geometry" /><br />
        <b>Custom Geometry</b>
      </a>
    </td>
    <td align="center">
      <a href="https://mdt-re.github.io/voro-js/examples/performance_demo.html">
        <img src="assets/voro_performance.png" width="250px" alt="Performance Demo" /><br />
        <b>Performance Demo</b>
      </a>
    </td>
  </tr>
</table>

## Running Locally

Due to browser security restrictions regarding WebAssembly and ES modules (CORS), you cannot simply open the HTML files directly from your file system, you must serve them over HTTP. Ensure you have built the project to generate the `dist/` folder containing the WebAssembly and JS bindings. Then start static file server (for example `http-server` via `npx`):
```bash
npm install
npm run build
npm run serve
```
Open your browser and navigate to the respective example: `http://localhost:8080/examples/<example>.html`.

## Deploying to GitHub Pages

These examples are designed to work on GitHub Pages. An `index.html` file is included in this directory to serve as a landing page for the examples. To deploy, you need to activate the `.github/workflows/deploy.yml` by:

*   Go to the repository on GitHub.
*   Navigate to **Settings** > **Pages**.
*   Under **Build and deployment** > **Source**, select **GitHub Actions**.
    
Once deployed, your examples will be available at `https://<username>.github.io/<repo-name>/examples/`.

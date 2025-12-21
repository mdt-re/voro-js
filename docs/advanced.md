# Advanced Usage

This section covers advanced techniques and patterns for using `voro-js`.

## Voronoi Relaxation (Lloyd's Algorithm)

Voronoi relaxation is a technique used to distribute points evenly across a domain. It is often used to generate blue noise or regular meshes.

### The Process

1.  **Generate**: Create a Voronoi diagram from a set of seed points.
2.  **Compute Centroids**: Calculate the centroid (center of mass) for each cell using `VoronoiCell3D.centroid()`.
3.  **Move**: Move each seed point to the centroid of its cell.
4.  **Repeat**: Repeat steps 1-3 for a number of iterations or until convergence.

See the Voronoi Relaxation Example for a live demonstration.

## Performance Considerations

### Batch Processing
When dealing with thousands of particles, minimizing the overhead of crossing the JavaScript-WebAssembly boundary is key.

*   **Reuse Objects**: If possible, reuse `VoronoiCell3D` objects or containers rather than constantly creating and destroying them.
*   **Grid Size**: When initializing `VoronoiContext3D`, the grid dimensions (nx, ny, nz) significantly affect performance. A grid that is too fine adds overhead, while a grid that is too coarse makes neighbor searching slower. A rule of thumb is to set the number of blocks so that there are roughly 5-10 particles per block.

```
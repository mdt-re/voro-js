# API Reference

`voro-js` exposes the core functionality of Voro++ through a TypeScript wrapper around the compiled WebAssembly module. The two primary classes you will interact with are `VoronoiContext3D` and `VoronoiCell3D`.

> **Note**: Please refer to the TypeScript definition files (`.d.ts`) included in the package for the exact method signatures and property types.

## VoronoiContext3D

The `VoronoiContext3D` class acts as the container (or simulation box) for the Voronoi tessellation. It manages the particles and computes the cells.

### Responsibilities

*   **Initialization**: Defining the bounds of the 3D simulation box (x, y, z limits).
*   **Particle Management**: Adding particles (seeds) to the container.
*   **Computation**: Triggering the calculation of Voronoi cells for the added particles.
*   **Iteration**: providing methods to loop through all computed cells in the container.

### Common Methods

*   `constructor(...)`: Initializes the container size and grid divisions.
*   `put(id, x, y, z)`: Inserts a particle with a specific ID and coordinates.
*   `compute_all_cells()`: Calculates the Voronoi cells for all particles.

---

## VoronoiCell3D

The `VoronoiCell3D` class represents a single Voronoi cell, which is a convex polyhedron containing all points closer to its seed than to any other seed.

### Responsibilities

*   **Geometry Data**: Storing vertices, edges, and faces of the polyhedron.
*   **Volume & Centroid**: Calculating the volume of the cell and its centroid (center of mass).
*   **Neighbor Information**: Identifying adjacent cells/particles.

### Common Methods

*   `volume()`: Returns the volume of the cell.
*   `centroid()`: Returns the coordinates of the cell's centroid.
*   `face_areas()`: Returns the areas of the faces of the polyhedron.
*   `vertices()`: Returns the list of vertices defining the cell.
# Getting Started

This guide provides a simple example to help you get up and running with `voro-js`.

## Your First Simulation

In this example, we will create a 3D container, add some random points, and ensure memory is properly managed.

```typescript
import { VoronoiContext3D } from 'voro-js';

function main() {
  // 1. Define the simulation box
  // The box ranges from -10 to 10 in X, Y, and Z dimensions.
  // We divide the box into a 5x5x5 grid for internal spatial hashing.
  const xMin = -10, xMax = 10;
  const yMin = -10, yMax = 10;
  const zMin = -10, zMax = 10;
  const nx = 5, ny = 5, nz = 5;

  const container = new VoronoiContext3D(xMin, xMax, yMin, yMax, zMin, zMax, nx, ny, nz);

  try {
    // 2. Add particles (seeds)
    // We add 10 random particles to the container.
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * (xMax - xMin) + xMin;
      const y = Math.random() * (yMax - yMin) + yMin;
      const z = Math.random() * (zMax - zMin) + zMin;
      
      // put(id, x, y, z)
      container.put(i, x, y, z);
    }

    console.log("Particles added successfully.");

    // 3. Perform computations
    container.compute_all_cells();
    
    console.log("Voronoi cells computed.");

  } finally {
    // 4. Clean up memory
    // Essential for WebAssembly resources
    container.delete();
  }
}

main();
```

## Next Steps

*   Read the API Reference for detailed method signatures.
*   Check Memory Management to understand why `container.delete()` is necessary.
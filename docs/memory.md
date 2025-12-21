# Memory Management

`voro-js` is built using Emscripten, which compiles C++ code to WebAssembly. Unlike standard JavaScript objects, C++ objects created in the WebAssembly heap are **not** automatically garbage collected by the JavaScript engine.

## The Rule of Thumb

**If you create it, you must delete it.**

Any instance of a class exposed by the library (e.g., `VoronoiContext3D`, `VoronoiCell3D`) occupies memory in the WASM heap. If you do not manually free this memory, your application will suffer from memory leaks, eventually crashing the browser tab or Node.js process.

## How to Free Memory

All exposed C++ classes have a `.delete()` method. You should call this method when you are finished using the object.

### Example: Using `try...finally`

The safest way to ensure memory is freed, even if errors occur, is to use a `try...finally` block.

```typescript
import { VoronoiContext3D } from 'voro-js';

function runSimulation() {
  // 1. Allocate
  const context = new VoronoiContext3D(0, 10, 0, 10, 0, 10, 5, 5, 5);

  try {
    // 2. Use
    context.put(0, 5, 5, 5);
    // ... perform calculations ...

  } finally {
    // 3. Deallocate
    if (!context.isDeleted()) {
      context.delete();
    }
  }
}
```
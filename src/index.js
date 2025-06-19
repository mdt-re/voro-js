// Import the factory function created by Emscripten
import createVoroModule from './REPLACE_ME.js';

// Store the module instance
let voroModule = null;

/**
 * Initializes the Voro++ WebAssembly module.
 * This function must be called and awaited before using any other functionality.
 * @returns {Promise<{VoronoiContext3D: any}>} A promise that resolves with the Voro++ API.
 */
export async function initializeVoro()
{
	// The API is already loaded.
	if (voroModule)
		return voroModule;
	
	// Create the module instance.
	const Module = await createVoroModule();
	
	// The API is now ready to be used.
	voroModule = {
		// This is where classes/functions are exposed.
		VoronoiContext3D: Module.VoronoiContext3D,
		VoronoiCell3D: Module.VoronoiCell3D,
        VectorInt: Module.VectorInt,
        VectorDouble: Module.VectorDouble,
	};
	return voroModule;
}

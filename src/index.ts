// Import the factory function created by Emscripten.
// @ts-ignore: This file is generated during the build process.
import createVoroModule from './REPLACE_ME.js';

// Define the shape of the Voro++ API.
export interface VoroAPI {
	VoronoiContext3D: any;
	VoronoiCell3D: any;
	VectorInt: any;
	VectorDouble: any;
}

// Store the module instance.
let voroModule: VoroAPI | null = null;

/**
 * Initializes the Voro++ WebAssembly module.
 * This function must be called and awaited before using any other functionality.
 * @returns {Promise<VoroAPI>} A promise that resolves with the Voro++ API.
 */
export async function initializeVoro(): Promise<VoroAPI>
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

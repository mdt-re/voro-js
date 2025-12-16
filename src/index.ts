// Import the factory function created by Emscripten.
// @ts-ignore: This file is generated during the build process.
import createVoroModule from './REPLACE_ME.js';

export interface EmscriptenObject {
	delete(): void;
}

export interface VectorInt extends EmscriptenObject {
	push_back(value: number): void;
	size(): number;
	get(index: number): number;
	set(index: number, value: number): void;
}

export interface VectorDouble extends EmscriptenObject {
	push_back(value: number): void;
	size(): number;
	get(index: number): number;
	set(index: number, value: number): void;
}

export interface VoronoiCell3D extends EmscriptenObject {
	initBox(xmin: number, xmax: number, ymin: number, ymax: number, zmin: number, zmax: number): void;
	cutPlane(x: number, y: number, z: number): boolean;
	cutPlaneR(x: number, y: number, z: number, rsq: number): boolean;
	getCell(): any;
}

export interface VoronoiContext3D extends EmscriptenObject {
	addPoint(id: number, x: number, y: number, z: number): void;
	addPoints(ids: VectorInt, x: VectorDouble, y: VectorDouble, z: VectorDouble): void;
	addWallPlane(x: number, y: number, z: number, d: number, id?: number): void;
	addWallSphere(x: number, y: number, z: number, r: number, id?: number): void;
	addWallCylinder(ax: number, ay: number, az: number, vx: number, vy: number, vz: number, r: number, id?: number): void;
	addWallCone(ax: number, ay: number, az: number, vx: number, vy: number, vz: number, a: number, id?: number): void;
	addWallJS(wall: any): void;
	getAllCells(): any;
	getCellById(id: number): VoronoiCell3D;
	relaxVoronoi(): any;
	clear(): void;
}

// Define the shape of the Voro++ API.
export interface VoroAPI {
	VoronoiContext3D: new (...args: any[]) => VoronoiContext3D;
	VoronoiCell3D: new (...args: any[]) => VoronoiCell3D;
	VectorInt: new () => VectorInt;
	VectorDouble: new () => VectorDouble;
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

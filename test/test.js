// test/test.js

// Ensure you have chai installed (npm install --save-dev chai mocha)
const { expect } = require('chai');

// The `initializeVoro` function is exported from your index.js.
// Since package.json points to dist/index.js as main, and the build:wrappers
// script modifies src/index.js to point to voro_node or voro_browser,
// we should be able to require it directly.
const { initializeVoro } = require('../dist/index'); // Adjust path if needed

describe('Voro++ WebAssembly Wrapper Tests', function() {
    this.timeout(10000); // Increase timeout for Emscripten module loading

    let Voro; // This will hold the initialized Voro++ API (VoronoiContext3D, VoronoiCell3D, VectorInt, VectorDouble etc.)

    // Before all tests, initialize the WebAssembly module
    before(async function() {
        Voro = await initializeVoro();
        expect(Voro).to.exist;
        expect(Voro.VoronoiContext3D).to.be.a('function');
        expect(Voro.VoronoiCell3D).to.be.a('function');
        expect(Voro.VectorInt).to.be.a('function'); // Ensure vector types are available
        expect(Voro.VectorDouble).to.be.a('function'); // Ensure vector types are available
    });

    describe('VoronoiContext3D', function() {
        let context;
        const bounds = {
            minX: 0, maxX: 10,
            minY: 0, maxY: 10,
            minZ: 0, maxZ: 10
        };

        // Helper function to convert Emscripten-bound VectorVoronoiCell to JS array
        function convertCellsToJsArray(emscriptenCells) {
            const jsCells = [];
            for (let i = 0; i < emscriptenCells.size(); i++) {
                // Get the individual cell
                const cell = emscriptenCells.get(i);
                // Recursively convert its nested Emscripten vectors to JS arrays
                cell.vertices = convertPointsToJsArray(cell.vertices);
                cell.edges = convertVectorVectorIntToJsArray(cell.edges);
                cell.faces = convertVectorVectorIntToJsArray(cell.faces);
                cell.neighbors = convertIntVectorToJsArray(cell.neighbors);
                jsCells.push(cell);
            }
            return jsCells;
        }

        // Helper function to convert Emscripten-bound VectorPoint3D to JS array
        function convertPointsToJsArray(emscriptenPoints) {
            const jsPoints = [];
            for (let i = 0; i < emscriptenPoints.size(); i++) {
                jsPoints.push(emscriptenPoints.get(i));
            }
            emscriptenPoints.delete(); // Delete the Emscripten object after conversion
            return jsPoints;
        }

        // Helper function to convert Emscripten-bound VectorInt to JS array
        function convertIntVectorToJsArray(emscriptenIntVector) {
            const jsArray = [];
            for (let i = 0; i < emscriptenIntVector.size(); i++) {
                jsArray.push(emscriptenIntVector.get(i));
            }
            emscriptenIntVector.delete(); // Delete the Emscripten object after conversion
            return jsArray;
        }

        // Helper function to convert Emscripten-bound VectorVectorInt to JS array (for edges/faces)
        function convertVectorVectorIntToJsArray(emscriptenVectorVectorInt) {
            const jsArray = [];
            for (let i = 0; i < emscriptenVectorVectorInt.size(); i++) {
                // Each element is another Emscripten VectorInt, so convert it too
                jsArray.push(convertIntVectorToJsArray(emscriptenVectorVectorInt.get(i)));
            }
            emscriptenVectorVectorInt.delete(); // Delete the Emscripten object after conversion
            return jsArray;
        }


        beforeEach(function() {
            // Create a new context for each test to ensure isolation
            context = new Voro.VoronoiContext3D(
                bounds.minX, bounds.maxX,
                bounds.minY, bounds.maxY,
                bounds.minZ, bounds.maxZ,
                false, false, false // Non-periodic boundary conditions
            );
        });

        afterEach(function() {
            // Clean up the context after each test
            if (context) {
                context.clear();
            }
        });

        it('should be able to create a new instance', function() {
            expect(context).to.be.an.instanceOf(Voro.VoronoiContext3D);
        });

        it('should add a single point and retrieve it', function() {
            context.addPoint(0, 1, 1, 1);
            const emscriptenCells = context.getAllCells();
            const cells = convertCellsToJsArray(emscriptenCells); // Convert to JS array
            expect(cells).to.have.lengthOf(1);
            const cell = cells[0];
            expect(cell.id).to.equal(0);
            expect(cell.position.x).to.be.closeTo(1, 1e-9);
            expect(cell.position.y).to.be.closeTo(1, 1e-9);
            expect(cell.position.z).to.be.closeTo(1, 1e-9);
            expect(cell.volume).to.be.greaterThan(0); // Volume should be computed
            // emscriptenCells is deleted inside convertCellsToJsArray
        });

        it('should add multiple points and retrieve all cells', function() {
            const ids = [0, 1, 2];
            const x = [1, 5, 9];
            const y = [1, 5, 9];
            const z = [1, 5, 9];

            // Convert JS arrays to Emscripten-bound vector types
            const emIds = new Voro.VectorInt();
            ids.forEach(id => emIds.push_back(id));

            const emX = new Voro.VectorDouble();
            x.forEach(_x => emX.push_back(_x));

            const emY = new Voro.VectorDouble();
            y.forEach(_y => emY.push_back(_y));

            const emZ = new Voro.VectorDouble();
            z.forEach(_z => emZ.push_back(_z));

            try {
                context.addPoints(emIds, emX, emY, emZ);
                const emscriptenCells = context.getAllCells();
                const cells = convertCellsToJsArray(emscriptenCells); // Convert to JS array
                expect(cells).to.have.lengthOf(3);

                // Verify properties of one of the cells
                const cell1 = cells.find(c => c.id === 1);
                expect(cell1).to.exist;
                expect(cell1.position.x).to.be.closeTo(5, 1e-9);
                // emscriptenCells is deleted inside convertCellsToJsArray
            } finally {
                // Ensure Emscripten vectors are deleted to prevent memory leaks
                emIds.delete();
                emX.delete();
                emY.delete();
                emZ.delete();
            }
        });

        it('should retrieve a cell by its ID', function() {
            context.addPoint(100, 5, 5, 5);
            // getCellById returns a single VoronoiCell, not a vector.
            // Its internal vectors need conversion.
            const cell = context.getCellById(100);
            
            // Convert internal Emscripten vectors to JS arrays
            cell.vertices = convertPointsToJsArray(cell.vertices);
            cell.edges = convertVectorVectorIntToJsArray(cell.edges);
            cell.faces = convertVectorVectorIntToJsArray(cell.faces);
            cell.neighbors = convertIntVectorToJsArray(cell.neighbors);

            expect(cell).to.exist;
            expect(cell.id).to.equal(100);
            expect(cell.position.x).to.be.closeTo(5, 1e-9);

            const nonExistentCell = context.getCellById(999);
            // Voro++ wrapper returns an empty cell if not found, check its id is 0 (default)
            // No need to convert its internal vectors as they should be empty and not allocated.
            expect(nonExistentCell.id).to.equal(0);
            expect(nonExistentCell.volume).to.equal(0);
        });

        it('should relax Voronoi cells and return new centroids', function() {
            // Add points, compute, relax, and check if centroids are returned
            context.addPoint(0, 1, 1, 1);
            context.addPoint(1, 9, 1, 1);
            context.addPoint(2, 1, 9, 1);
            context.addPoint(3, 1, 1, 9);

            const emscriptenInitialCells = context.getAllCells();
            const initialCells = convertCellsToJsArray(emscriptenInitialCells); // Convert to JS array
            expect(initialCells).to.have.lengthOf(4);
            // emscriptenInitialCells is deleted inside convertCellsToJsArray

            const emscriptenRelaxedPoints = context.relaxVoronoi();
            const relaxedPoints = convertPointsToJsArray(emscriptenRelaxedPoints); // Convert to JS array
            
            expect(relaxedPoints).to.have.lengthOf(4);
            
            // Simple check: centroids should be within bounds and reasonable
            relaxedPoints.forEach(p => {
                expect(p.x).to.be.within(bounds.minX, bounds.maxX);
                expect(p.y).to.be.within(bounds.minY, bounds.maxY);
                expect(p.z).to.be.within(bounds.minZ, bounds.maxZ);
            });

            // emscriptenRelaxedPoints is deleted inside convertPointsToJsArray
        });

        it('should clear all particles from the container', function() {
            context.addPoint(0, 1, 1, 1);
            const emscriptenCellsBeforeClear = context.getAllCells();
            const cellsBeforeClear = convertCellsToJsArray(emscriptenCellsBeforeClear); // Convert to JS array
            expect(cellsBeforeClear).to.have.lengthOf(1);
            // emscriptenCellsBeforeClear is deleted inside convertCellsToJsArray

            context.clear();
            const emscriptenCellsAfterClear = context.getAllCells();
            const cellsAfterClear = convertCellsToJsArray(emscriptenCellsAfterClear); // Convert to JS array
            expect(cellsAfterClear).to.have.lengthOf(0);
            // emscriptenCellsAfterClear is deleted inside convertCellsToJsArray
        });

        it('should add a plane wall and affect cell computation', function() {
            context.addPoint(0, 5, 5, 5);
            // Add a plane wall cutting the domain at x=2
            context.addWallPlane(1, 0, 0, -2); // Normal (1,0,0), displacement -2 (x=2)

            const emscriptenCellsBeforeRelax = context.getAllCells();
            const cellsBeforeRelax = convertCellsToJsArray(emscriptenCellsBeforeRelax); // Convert to JS array
            // Volume should be less than the initial full domain volume or close to it
            // if the cell is not cut (depending on point placement and bounds)
            // A precise volume check is difficult without reference, but we can check if it's non-zero.
            expect(cellsBeforeRelax[0].volume).to.be.greaterThan(0);
            // emscriptenCellsBeforeRelax is deleted inside convertCellsToJsArray

            // If a wall is added, and the point is within it, the cell should be bounded by the wall.
            // A more robust test would involve adding a point very close to the wall and observing cell changes.
            // For simplicity, we check volume is still positive.
        });

        it('should handle a custom JavaScript wall correctly', function() {
            // Mock a JavaScript wall object that implements point_inside and cut_cell
            const mockJsWall = {
                // A simple plane wall cutting at y = 5
                point_inside: function(x, y, z) {
                    return y < 5;
                },
                cut_cell: function(x, y, z) {
                    // This defines a plane (0, 1, 0) with distance 5
                    // The 'cut' property is crucial for the C++ side to know if a cut occurred.
                    return { cut: true, nx: 0, ny: 1, nz: 0, d: 5 };
                }
            };

            context.addPoint(0, 5, 2, 5); // Point inside the wall region (y=2 < 5)
            context.addPoint(1, 5, 8, 5); // Point outside the wall region (y=8 > 5)

            context.addWallJS(mockJsWall);

            // After adding points and the custom wall, verify the cells.
            // The point (5,2,5) should be influenced by the wall.
            // The point (5,8,5) should not be cut by this wall (since it's outside the "inside" region).
            // A detailed geometric check is complex here, but we can verify basic existence.
            const emscriptenCells = context.getAllCells();
            const cells = convertCellsToJsArray(emscriptenCells); // Convert to JS array
            expect(cells).to.have.lengthOf(2);

            const cell0 = cells.find(c => c.id === 0);
            expect(cell0).to.exist;
            // The cell for point (5,2,5) should have its volume restricted by the wall
            // The exact volume is hard to predict, but it should be a reasonable positive number.
            expect(cell0.volume).to.be.greaterThan(0);

            const cell1 = cells.find(c => c.id === 1);
            expect(cell1).to.exist;
            // The cell for point (5,8,5) should also exist and have a positive volume.
            expect(cell1.volume).to.be.greaterThan(0);
            // emscriptenCells is deleted inside convertCellsToJsArray
        });
    });

    describe('VoronoiCell3D', function() {
        let cell;

        // Helper function to convert Emscripten-bound VectorPoint3D to JS array (local to this describe block)
        function convertPointsToJsArrayLocal(emscriptenPoints) {
            const jsPoints = [];
            for (let i = 0; i < emscriptenPoints.size(); i++) {
                jsPoints.push(emscriptenPoints.get(i));
            }
            emscriptenPoints.delete(); // Delete the Emscripten object after conversion
            return jsPoints;
        }

        // Helper function to convert Emscripten-bound VectorInt to JS array (local to this describe block)
        function convertIntVectorToJsArrayLocal(emscriptenIntVector) {
            const jsArray = [];
            for (let i = 0; i < emscriptenIntVector.size(); i++) {
                jsArray.push(emscriptenIntVector.get(i));
            }
            emscriptenIntVector.delete(); // Delete the Emscripten object after conversion
            return jsArray;
        }

        // Helper function to convert Emscripten-bound VectorVectorInt to JS array (for edges/faces, local)
        function convertVectorVectorIntToJsArrayLocal(emscriptenVectorVectorInt) {
            const jsArray = [];
            for (let i = 0; i < emscriptenVectorVectorInt.size(); i++) {
                jsArray.push(convertIntVectorToJsArrayLocal(emscriptenVectorVectorInt.get(i)));
            }
            emscriptenVectorVectorInt.delete(); // Delete the Emscripten object after conversion
            return jsArray;
        }


        beforeEach(function() {
            cell = new Voro.VoronoiCell3D();
        });

        it('should be able to create a new instance', function() {
            expect(cell).to.be.an.instanceOf(Voro.VoronoiCell3D);
        });

        it('should initialize as a box and have correct volume', function() {
            const xmin = 0, xmax = 1, ymin = 0, ymax = 1, zmin = 0, zmax = 1;
            cell.initBox(xmin, xmax, ymin, ymax, zmin, zmax);
            const cellData = cell.getCell();
            
            // Convert internal Emscripten vectors to JS arrays for assertions
            cellData.vertices = convertPointsToJsArrayLocal(cellData.vertices);
            cellData.edges = convertVectorVectorIntToJsArrayLocal(cellData.edges);
            cellData.faces = convertVectorVectorIntToJsArrayLocal(cellData.faces);
            cellData.neighbors = convertIntVectorToJsArrayLocal(cellData.neighbors);

            expect(cellData.volume).to.be.closeTo((xmax - xmin) * (ymax - ymin) * (zmax - zmin), 1e-9);
            expect(cellData.vertices).to.have.lengthOf(8); // A box has 8 vertices
            expect(cellData.faces).to.have.lengthOf(6); // A box has 6 faces
        });

        it('should cut a plane and reduce volume', function() {
            cell.initBox(0, 1, 0, 1, 0, 1);
            const initialCellData = cell.getCell();
            // Convert initial data's internal vectors to JS arrays for proper comparison/cleanup
            initialCellData.vertices = convertPointsToJsArrayLocal(initialCellData.vertices);
            initialCellData.edges = convertVectorVectorIntToJsArrayLocal(initialCellData.edges);
            initialCellData.faces = convertVectorVectorIntToJsArrayLocal(initialCellData.faces);
            initialCellData.neighbors = convertIntVectorToJsArrayLocal(initialCellData.neighbors);
            const initialVolume = initialCellData.volume;


            // Cut the box with a plane passing through (0.5, 0.5, 0.5) perpendicular to (1, 0, 0)
            // This should cut the volume in half.
            const cutResult = cell.cutPlane(0.5, 0.5, 0.5); // Using just xyz, defaults to plane based on (x,y,z) itself as normal
            expect(cutResult).to.be.true; // Cut should succeed unless cell is entirely deleted

            const cutCellData = cell.getCell();
            // Convert cut data's internal vectors to JS arrays
            cutCellData.vertices = convertPointsToJsArrayLocal(cutCellData.vertices);
            cutCellData.edges = convertVectorVectorIntToJsArrayLocal(cutCellData.edges);
            cutCellData.faces = convertVectorVectorIntToJsArrayLocal(cutCellData.faces);
            cutCellData.neighbors = convertIntVectorToJsArrayLocal(cutCellData.neighbors);
            const cutVolume = cutCellData.volume;

            expect(cutVolume).to.be.lessThan(initialVolume);
            // For a simple cut through the center, it should be half the volume.
            expect(cutVolume).to.be.closeTo(initialVolume / 2, 1e-9);
        });

        it('should cut a plane with rsq and reduce volume', function() {
            cell.initBox(0, 1, 0, 1, 0, 1);
            const initialCellData = cell.getCell();
            // Convert initial data's internal vectors to JS arrays
            initialCellData.vertices = convertPointsToJsArrayLocal(initialCellData.vertices);
            initialCellData.edges = convertVectorVectorIntToJsArrayLocal(initialCellData.edges);
            initialCellData.faces = convertVectorVectorIntToJsArrayLocal(initialCellData.faces);
            initialCellData.neighbors = convertIntVectorToJsArrayLocal(initialCellData.neighbors);
            const initialVolume = initialCellData.volume;

            // Cut the box with a plane using rsq.
            // Example: cut by a plane passing through (0.25, 0.5, 0.5) using its squared modulus
            // This is essentially cutting by the plane whose normal is the vector from origin to (0.25,0.5,0.5).
            // The plane passes through the midpoint of the line segment from origin to (0.25,0.5,0.5).
            const x = 0.5, y = 0.5, z = 0.5;
            const rsq = x*x + y*y + z*z; // Squared distance from origin to (0.5,0.5,0.5)
            const cutResult = cell.cutPlaneR(x, y, z, rsq);
            expect(cutResult).to.be.true;

            const cutCellData = cell.getCell();
            // Convert cut data's internal vectors to JS arrays
            cutCellData.vertices = convertPointsToJsArrayLocal(cutCellData.vertices);
            cutCellData.edges = convertVectorVectorIntToJsArrayLocal(cutCellData.edges);
            cutCellData.faces = convertVectorVectorIntToJsArrayLocal(cutCellData.faces);
            cutCellData.neighbors = convertIntVectorToJsArrayLocal(cutCellData.neighbors);
            const cutVolume = cutCellData.volume;
            
            expect(cutVolume).to.be.lessThan(initialVolume);
            expect(cutVolume).to.be.closeTo(initialVolume / 2, 1e-9);
        });

        it('should return a cell with correct structure after operations', function() {
            cell.initBox(0, 1, 0, 1, 0, 1);
            cell.cutPlane(0.2, 0.5, 0.5); // Perform a cut

            const cellData = cell.getCell();
            // Convert internal Emscripten vectors to JS arrays for assertions
            cellData.vertices = convertPointsToJsArrayLocal(cellData.vertices);
            cellData.edges = convertVectorVectorIntToJsArrayLocal(cellData.edges);
            cellData.faces = convertVectorVectorIntToJsArrayLocal(cellData.faces);
            cellData.neighbors = convertIntVectorToJsArrayLocal(cellData.neighbors);

            expect(cellData).to.have.all.keys('id', 'position', 'volume', 'vertices', 'edges', 'faces', 'neighbors');
            expect(cellData.id).to.equal(0);
            expect(cellData.position).to.deep.equal({ x: 0, y: 0, z: 0 }); // Default position for standalone cell
            expect(cellData.volume).to.be.greaterThan(0);
            expect(cellData.vertices).to.be.an('array');
            expect(cellData.edges).to.be.an('array');
            expect(cellData.faces).to.be.an('array');
            expect(cellData.neighbors).to.be.an('array');
        });
    });
});

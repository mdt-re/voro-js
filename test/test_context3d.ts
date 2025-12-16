import { expect } from 'chai';
import { initializeVoro, VoroAPI, VoronoiContext3D, VoronoiCell3D } from '@mdt-re/voro-js';

describe('Voro++ WebAssembly Wrapper Tests', function() {
    this.timeout(10000); // Increase timeout for Emscripten module loading

    let Voro: VoroAPI; // This will hold the initialized Voro++ API

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
        let context: VoronoiContext3D;
        const bounds = {
            minX: 0, maxX: 10,
            minY: 0, maxY: 10,
            minZ: 0, maxZ: 10
        };

        // Helper function to convert Emscripten-bound VectorPoint3D to JS array
        function convertPointsToJsArray(emscriptenPoints: any) {
            const jsPoints = [];
            if (emscriptenPoints) {
                for (let i = 0; i < emscriptenPoints.size(); i++) {
                    jsPoints.push(emscriptenPoints.get(i));
                }
                emscriptenPoints.delete();
            }
            return jsPoints;
        }

        // Helper function to convert Emscripten-bound VectorInt to JS array
        function convertIntVectorToJsArray(emscriptenIntVector: any) {
            const jsArray = [];
            if (emscriptenIntVector) {
                for (let i = 0; i < emscriptenIntVector.size(); i++) {
                    jsArray.push(emscriptenIntVector.get(i));
                }
                emscriptenIntVector.delete();
            }
            return jsArray;
        }

        // Helper function to convert Emscripten-bound VectorVectorInt to JS array (for edges/faces)
        function convertVectorVectorIntToJsArray(emscriptenVectorVectorInt: any) {
            const jsArray = [];
            if (emscriptenVectorVectorInt) {
                for (let i = 0; i < emscriptenVectorVectorInt.size(); i++) {
                    const nestedEmscriptenIntVector = emscriptenVectorVectorInt.get(i);
                    jsArray.push(convertIntVectorToJsArray(nestedEmscriptenIntVector)); 
                }
                emscriptenVectorVectorInt.delete();
            }
            return jsArray;
        }
        
        // Helper function to convert Emscripten-bound VectorVoronoiCell to JS array
        function convertCellsToJsArray(emscriptenCells: any) {
            const jsCells = [];
            if (emscriptenCells) {
                for (let i = 0; i < emscriptenCells.size(); i++) {
                    const cell = emscriptenCells.get(i);
                    cell.vertices = convertPointsToJsArray(cell.vertices);
                    cell.edges = convertVectorVectorIntToJsArray(cell.edges);
                    cell.faces = convertVectorVectorIntToJsArray(cell.faces);
                    cell.neighbors = convertIntVectorToJsArray(cell.neighbors);
                    jsCells.push(cell);
                }
                emscriptenCells.delete();
            }
            return jsCells;
        }


        beforeEach(function() {
            // Create a new context for each test to ensure isolation
            context = new Voro.VoronoiContext3D(
                bounds.minX, bounds.maxX,
                bounds.minY, bounds.maxY,
                bounds.minZ, bounds.maxZ,
                10, 10, 10, // nx, ny, nz
            );
        });

        afterEach(function() {
            // Clean up the context after each test
            if (context) {
                context.delete();
            }
        });

        it('should be able to create a new instance', function() {
            expect(context).to.be.an.instanceOf(Voro.VoronoiContext3D);
        });

        it('should add a single point and retrieve it', function() {
            context.addPoint(0, 1, 1, 1);
            const emscriptenCells = context.getAllCells();
            const cells = convertCellsToJsArray(emscriptenCells);
            expect(cells).to.have.lengthOf(1);
            const cell = cells[0];
            expect(cell.id).to.equal(0);
            expect(cell.position.x).to.be.closeTo(1, 1e-9);
            expect(cell.position.y).to.be.closeTo(1, 1e-9);
            expect(cell.position.z).to.be.closeTo(1, 1e-9);
            expect(cell.volume).to.be.greaterThan(0);
        });

        it('should add multiple points and retrieve all cells', function() {
            const ids = [0, 1, 2];
            const x = [1, 5, 9];
            const y = [1, 5, 9];
            const z = [1, 5, 9];

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
                const cells = convertCellsToJsArray(emscriptenCells);
                expect(cells).to.have.lengthOf(3);

                const cell1 = cells.find(c => c.id === 1);
                expect(cell1).to.exist;
                expect(cell1!.position.x).to.be.closeTo(5, 1e-9);
            } finally {
                emIds.delete();
                emX.delete();
                emY.delete();
                emZ.delete();
            }
        });

        it('should retrieve a cell by its ID', function() {
            context.addPoint(100, 5, 5, 5);

            const cell = context.getCellById(100);
            
            // @ts-ignore: cell is an Emscripten object with properties that need conversion
            cell.vertices = convertPointsToJsArray(cell.vertices);
            // @ts-ignore
            cell.edges = convertVectorVectorIntToJsArray(cell.edges);
            // @ts-ignore
            cell.faces = convertVectorVectorIntToJsArray(cell.faces);
            // @ts-ignore
            cell.neighbors = convertIntVectorToJsArray(cell.neighbors);

            expect(cell).to.exist;
            // @ts-ignore
            expect(cell.id).to.equal(100);
            // @ts-ignore
            expect(cell.position.x).to.be.closeTo(5, 1e-9);

            const nonExistentCell = context.getCellById(999);
            // @ts-ignore
            expect(nonExistentCell.id).to.equal(0);
            // @ts-ignore
            expect(nonExistentCell.volume).to.equal(0);
        });

        it('should relax Voronoi cells and return new centroids', function() {
            context.addPoint(0, 1, 1, 1);
            context.addPoint(1, 9, 1, 1);
            context.addPoint(2, 1, 9, 1);
            context.addPoint(3, 1, 1, 9);

            const emscriptenInitialCells = context.getAllCells();
            const initialCells = convertCellsToJsArray(emscriptenInitialCells);
            expect(initialCells).to.have.lengthOf(4);

            const emscriptenRelaxedPoints = context.relaxVoronoi();
            const relaxedPoints = convertPointsToJsArray(emscriptenRelaxedPoints);
            
            expect(relaxedPoints).to.have.lengthOf(4);
            
            relaxedPoints.forEach(p => {
                expect(p.x).to.be.within(bounds.minX, bounds.maxX);
                expect(p.y).to.be.within(bounds.minY, bounds.maxY);
                expect(p.z).to.be.within(bounds.minZ, bounds.maxZ);
            });
        });

        it('should clear all particles from the container', function() {
            context.addPoint(0, 1, 1, 1);
            const emscriptenCellsBeforeClear = context.getAllCells();
            const cellsBeforeClear = convertCellsToJsArray(emscriptenCellsBeforeClear);
            expect(cellsBeforeClear).to.have.lengthOf(1);

            context.clear();
            const emscriptenCellsAfterClear = context.getAllCells();
            const cellsAfterClear = convertCellsToJsArray(emscriptenCellsAfterClear);
            expect(cellsAfterClear).to.have.lengthOf(0);
        });

        it('should add a plane wall and affect cell computation', function() {
            context.addPoint(0, 5, 5, 5);
            context.addWallPlane(1, 0, 0, -2);

            const emscriptenCellsBeforeRelax = context.getAllCells();
            const cellsBeforeRelax = convertCellsToJsArray(emscriptenCellsBeforeRelax);
            expect(cellsBeforeRelax[0].volume).to.be.greaterThan(0);
        });

        it('should handle a custom JavaScript wall correctly', function() {
            const mockJsWall = {
                point_inside: function(x: number, y: number, z: number) {
                    return y < 5;
                },
                cut_cell: function(x: number, y: number, z: number) {
                    return { cut: true, nx: 0, ny: 1, nz: 0, d: 5 };
                }
            };

            context.addPoint(0, 5, 2, 5);
            context.addPoint(1, 5, 8, 5);

            context.addWallJS(mockJsWall);

            const emscriptenCells = context.getAllCells();
            const cells = convertCellsToJsArray(emscriptenCells);
            expect(cells).to.have.lengthOf(2);

            const cell0 = cells.find(c => c.id === 0);
            expect(cell0).to.exist;
            expect(cell0!.volume).to.be.greaterThan(0);

            const cell1 = cells.find(c => c.id === 1);
            expect(cell1).to.exist;
            expect(cell1!.volume).to.be.greaterThan(0);
        });
    });
});

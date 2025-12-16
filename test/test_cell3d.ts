import { expect } from 'chai';
import { initializeVoro, VoroAPI, VoronoiCell3D } from '../dist/index.js';

describe('Voro++ WebAssembly Wrapper Tests', function() {
    this.timeout(10000);

    let Voro: VoroAPI;

    before(async function() {
        Voro = await initializeVoro();
        expect(Voro).to.exist;
        expect(Voro.VoronoiCell3D).to.be.a('function');
    });

    describe('VoronoiCell3D', function() {
        let cell: VoronoiCell3D;

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


        beforeEach(function() {
            cell = new Voro.VoronoiCell3D();
        });

        afterEach(function() {
            if (cell) {
                cell.delete(); 
            }
        });

        it('should be able to create a new instance', function() {
            expect(cell).to.be.an.instanceOf(Voro.VoronoiCell3D);
        });

        it('should initialize as a box and have correct volume and structure', function() {
            const xmin = 0, xmax = 1, ymin = 0, ymax = 1, zmin = 0, zmax = 1;
            if (!cell) throw new Error("Cell not initialized");
            
            cell.initBox(xmin, xmax, ymin, ymax, zmin, zmax);
            const cellData = cell.getCell();
            
            cellData.vertices = convertPointsToJsArray(cellData.vertices);
            cellData.edges = convertVectorVectorIntToJsArray(cellData.edges);
            cellData.faces = convertVectorVectorIntToJsArray(cellData.faces);
            cellData.neighbors = convertIntVectorToJsArray(cellData.neighbors);
            
            expect(cellData).to.have.all.keys('id', 'position', 'volume', 'vertices', 'edges', 'faces', 'neighbors');
            expect(cellData.id).to.equal(0);
            expect(cellData.position).to.deep.equal({ x: 0, y: 0, z: 0 });
            expect(cellData.volume).to.be.closeTo((xmax - xmin) * (ymax - ymin) * (zmax - zmin), 1e-9);
            expect(cellData.vertices).to.have.lengthOf(8);
            expect(cellData.faces).to.have.lengthOf(6);
            expect(cellData.edges).to.be.an('array');
            expect(cellData.neighbors).to.be.an('array');
        });

        it('should cut a plane and reduce volume', function() {
            cell.initBox(0, 1, 0, 1, 0, 1);
            const initialCellData = cell.getCell();
            initialCellData.vertices = convertPointsToJsArray(initialCellData.vertices);
            initialCellData.edges = convertVectorVectorIntToJsArray(initialCellData.edges);
            initialCellData.faces = convertVectorVectorIntToJsArray(initialCellData.faces);
            initialCellData.neighbors = convertIntVectorToJsArray(initialCellData.neighbors);
            const initialVolume = initialCellData.volume;

            const cutResult = cell.cutPlane(0.5, 0.5, 0.5);
            expect(cutResult).to.be.true;

            const cutCellData = cell.getCell();
            cutCellData.vertices = convertPointsToJsArray(cutCellData.vertices);
            cutCellData.edges = convertVectorVectorIntToJsArray(cutCellData.edges);
            cutCellData.faces = convertVectorVectorIntToJsArray(cutCellData.faces);
            cutCellData.neighbors = convertIntVectorToJsArray(cutCellData.neighbors);
            const cutVolume = cutCellData.volume;

            expect(cutVolume).to.be.lessThan(initialVolume);
            expect(cutVolume).to.be.closeTo(initialVolume / 2, 1e-9);
        });

        it('should cut a plane with rsq and reduce volume', function() {
            cell.initBox(0, 1, 0, 1, 0, 1);
            const initialCellData = cell.getCell();
            initialCellData.vertices = convertPointsToJsArray(initialCellData.vertices);
            initialCellData.edges = convertVectorVectorIntToJsArray(initialCellData.edges);
            initialCellData.faces = convertVectorVectorIntToJsArray(initialCellData.faces);
            initialCellData.neighbors = convertIntVectorToJsArray(initialCellData.neighbors);
            const initialVolume = initialCellData.volume;

            const x = 0.5, y = 0.5, z = 0.5;
            const rsq = x*x + y*y + z*z;
            const cutResult = cell.cutPlaneR(x, y, z, rsq);
            expect(cutResult).to.be.true;

            const cutCellData = cell.getCell();
            cutCellData.vertices = convertPointsToJsArray(cutCellData.vertices);
            cutCellData.edges = convertVectorVectorIntToJsArray(cutCellData.edges);
            cutCellData.faces = convertVectorVectorIntToJsArray(cutCellData.faces);
            cutCellData.neighbors = convertIntVectorToJsArray(cutCellData.neighbors);
            const cutVolume = cutCellData.volume;
            
            expect(cutVolume).to.be.lessThan(initialVolume);
            expect(cutVolume).to.be.closeTo(initialVolume / 2, 1e-9);
        });

        it('should return a cell with correct structure after operations', function() {
            cell.initBox(0, 1, 0, 1, 0, 1);
            cell.cutPlane(0.2, 0.5, 0.5);

            const cellData = cell.getCell();
            cellData.vertices = convertPointsToJsArray(cellData.vertices);
            cellData.edges = convertVectorVectorIntToJsArray(cellData.edges);
            cellData.faces = convertVectorVectorIntToJsArray(cellData.faces);
            cellData.neighbors = convertIntVectorToJsArray(cellData.neighbors);

            expect(cellData).to.have.all.keys('id', 'position', 'volume', 'vertices', 'edges', 'faces', 'neighbors');
            expect(cellData.id).to.equal(0);
            expect(cellData.position).to.deep.equal({ x: 0, y: 0, z: 0 });
            expect(cellData.volume).to.be.greaterThan(0);
            expect(cellData.vertices).to.be.an('array');
            expect(cellData.edges).to.be.an('array');
            expect(cellData.faces).to.be.an('array');
            expect(cellData.neighbors).to.be.an('array');
        });
    });
});

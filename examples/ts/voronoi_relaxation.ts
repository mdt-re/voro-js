import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import Stats from 'three/addons/libs/stats.module.js';

// --- Centroid Calculation ---
function computeCellCentroid(cell: any) {
    if (!cell.vertices || cell.vertices.length === 0) return null;

    let totalVolume = 0;
    let weightedCentroid = { x: 0, y: 0, z: 0 };

    // Compute geometric center of vertices to use as reference for tetrahedrons
    // This improves numerical stability compared to using (0,0,0)
    let cx = 0, cy = 0, cz = 0;
    for(let v of cell.vertices) { cx += v.x; cy += v.y; cz += v.z; }
    cx /= cell.vertices.length;
    cy /= cell.vertices.length;
    cz /= cell.vertices.length;

    for (const face of cell.faces) {
        // face is array of vertex indices. Triangulate face: (v0, vi, vi+1)
        if (face.length < 3) continue;
        const v0 = cell.vertices[face[0]];
        for (let i = 1; i < face.length - 1; i++) {
            const v1 = cell.vertices[face[i]];
            const v2 = cell.vertices[face[i+1]];

            // Tetrahedron (center, v0, v1, v2)
            // Vectors from center
            const x1 = v0.x - cx, y1 = v0.y - cy, z1 = v0.z - cz;
            const x2 = v1.x - cx, y2 = v1.y - cy, z2 = v1.z - cz;
            const x3 = v2.x - cx, y3 = v2.y - cy, z3 = v2.z - cz;

            // Scalar triple product for volume * 6: (v1 . (v2 x v3))
            const det = x1 * (y2 * z3 - z2 * y3) +
                        y1 * (z2 * x3 - x2 * z3) +
                        z1 * (x2 * y3 - y2 * x3);
            
            const vol = Math.abs(det) / 6.0;
            
            // Centroid of tetrahedron
            const tx = (cx + v0.x + v1.x + v2.x) / 4.0;
            const ty = (cy + v0.y + v1.y + v2.y) / 4.0;
            const tz = (cz + v0.z + v1.z + v2.z) / 4.0;

            totalVolume += vol;
            weightedCentroid.x += vol * tx;
            weightedCentroid.y += vol * ty;
            weightedCentroid.z += vol * tz;
        }
    }

    if (totalVolume <= 1e-9) return { x: cx, y: cy, z: cz };

    return {
        x: weightedCentroid.x / totalVolume,
        y: weightedCentroid.y / totalVolume,
        z: weightedCentroid.z / totalVolume
    };
}

// --- Main Application ---
import('../../dist/voro_browser.js').then((voroModule: any) => {
    return voroModule.default();
}).then((Voro: any) => {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';
    initApp(Voro);
}).catch((err: any) => {
    console.error("Failed to initialize Voro++ module:", err);
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.innerText = 'Error loading Voro++ module. See console for details.';
});

function initApp(Voro: any) {
    // Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(10, 10, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight2.position.set(-10, -10, -5);
    scene.add(dirLight2);

    // Bounds
    const bounds = { minX: -5, maxX: 5, minY: -5, maxY: 5, minZ: -5, maxZ: 5 };
    
    // Visual Box
    const boxGeo = new THREE.BoxGeometry(
        bounds.maxX - bounds.minX, 
        bounds.maxY - bounds.minY, 
        bounds.maxZ - bounds.minZ
    );
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxLines = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: 0x888888 }));

    const pivot = new THREE.Group();
    pivot.position.set(0, 0, 0);
    scene.add(pivot);
    pivot.add(boxLines);

    // State
    const params = {
        pointCount: 40,
        stepInterval: 0.25,
        autoRun: true,
        regenerate: () => resetSimulation()
    };

    let points: {id: number, x: number, y: number, z: number}[] = [];
    let lastStepTime = 0;
    let cellMesh: THREE.Mesh | null = null;

    // GUI
    const gui = new GUI();
    gui.add(params, 'pointCount', 8, 1600, 1).name('Point Count').onFinishChange(resetSimulation);
    gui.add(params, 'stepInterval', 0.05, 2.0, 0.05).name('Step Interval (s)');
    gui.add(params, 'autoRun').name('Auto Run');
    gui.add(params, 'regenerate').name('Regenerate');

    // Stats
    const stats = new Stats();
    stats.dom.style.cssText = 'position:relative;top:auto;left:auto;display:block;margin:10px auto;';
    const statsFolder = gui.addFolder('Stats');
    statsFolder.domElement.querySelector('.children')?.appendChild(stats.dom);

    function generatePoints() {
        points = [];
        for (let i = 0; i < params.pointCount; i++) {
            points.push({
                id: i,
                x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
                y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
                z: bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)
            });
        }
    }

    function performRelaxationStep() {
        // 1. Create Context
        // Heuristic for block size: roughly cube root of N
        const n = Math.ceil(Math.pow(params.pointCount, 1/3));
        const context = new Voro.VoronoiContext3D(
            bounds.minX, bounds.maxX,
            bounds.minY, bounds.maxY,
            bounds.minZ, bounds.maxZ,
            n, n, n
        );

        // 2. Add Points
        points.forEach((p, i) => {
            context.addPoint(i, p.x, p.y, p.z);
        });

        // 3. Compute Cells
        const cells = context.getCells();

        // 4. Compute Centroids & Update Points
        const newPoints: typeof points = [];
        const geometryData = {
            positions: [] as number[],
            colors: [] as number[],
            normals: [] as number[]
        };

        const color = new THREE.Color();

        cells.forEach((cell: any, i: number) => {
            // Compute centroid
            const centroid = computeCellCentroid(cell);
            if (centroid) {
                newPoints.push({ id: i, x: centroid.x, y: centroid.y, z: centroid.z });
            } else {
                // Keep original if cell is degenerate (shouldn't happen in box)
                newPoints.push(points[i]);
            }

            // Build Geometry
            // Color based on position (stable visualization)
            const cx = centroid ? centroid.x : points[i].x;
            const cy = centroid ? centroid.y : points[i].y;
            const cz = centroid ? centroid.z : points[i].z;
            
            // HSL color based on position in box
            color.setHSL((cx / 10 + cy / 10 + cz / 10) / 3, 0.8, 0.5);

            if (cell.vertices && cell.faces) {
                cell.faces.forEach((face: number[]) => {
                    if (face.length < 3) return;
                    // Fan triangulation
                    const v0 = cell.vertices[face[0]];
                    for (let j = 1; j < face.length - 1; j++) {
                        const v1 = cell.vertices[face[j]];
                        const v2 = cell.vertices[face[j+1]];

                        geometryData.positions.push(v0.x, v0.y, v0.z);
                        geometryData.positions.push(v1.x, v1.y, v1.z);
                        geometryData.positions.push(v2.x, v2.y, v2.z);

                        geometryData.colors.push(color.r, color.g, color.b);
                        geometryData.colors.push(color.r, color.g, color.b);
                        geometryData.colors.push(color.r, color.g, color.b);
                    }
                });
            }
        });

        // Update points for next step
        points = newPoints;

        // 5. Update Visualization
        if (cellMesh) {
            pivot.remove(cellMesh);
            cellMesh.geometry.dispose();
            if (Array.isArray(cellMesh.material)) {
                cellMesh.material.forEach(m => m.dispose());
            } else {
                cellMesh.material.dispose();
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(geometryData.positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(geometryData.colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.5,
            metalness: 0.1,
            polygonOffset: true,
            polygonOffsetFactor: 1, // Reduce z-fighting with edges if we added them
            transparent: true,
            opacity: 0.9
        });

        cellMesh = new THREE.Mesh(geometry, material);
        cellMesh.position.set(0, 0, 0);
        pivot.add(cellMesh);

        // Cleanup
        context.clear();
        context.delete();
    }

    function resetSimulation() {
        generatePoints();
        performRelaxationStep(); // Initial render
        lastStepTime = Date.now();
    }

    // Initialize
    resetSimulation();

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        stats.update();
        
        pivot.rotation.y += 0.005;

        if (params.autoRun) {
            const now = Date.now();
            if (now - lastStepTime > params.stepInterval * 1000) {
                performRelaxationStep();
                lastStepTime = now;
            }
        }

        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Handle screenshot
    window.addEventListener('keydown', (event) => {
        if (event.key === 'p') {
            renderer.render(scene, camera);
            const link = document.createElement('a');
            link.download = 'voronoi_relaxation.png';
            link.href = renderer.domElement.toDataURL('image/png');
            link.click();
        }
    });
}
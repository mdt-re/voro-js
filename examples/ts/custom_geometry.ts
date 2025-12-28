import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import GUI from 'lil-gui';

import { VoronoiWallTorus, VoronoiWallLemniscate, VoronoiWallCylinder } from './voronoi_walls';

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

    // Stats
    const stats = new Stats();

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
        shape: 'Torus',
        regenerate: () => resetSimulation()
    };

    let points: {x: number, y: number, z: number}[] = [];
    let staticMesh: THREE.Mesh | null = null;
    let context: any = null;

    // GUI
    const gui = new GUI();
    gui.add(params, 'pointCount', 8, 200, 1).name('Point Count').onFinishChange(resetSimulation);
    gui.add(params, 'shape', ['Torus', 'Lemniscate', 'Cylinder']).name('Shape').onChange(resetSimulation);
    gui.add(params, 'regenerate').name('Regenerate');

    // Integrate Stats into GUI
    stats.dom.style.cssText = 'position:relative;top:auto;left:auto;display:block;margin:10px auto;';
    const statsFolder = gui.addFolder('Stats');
    statsFolder.domElement.querySelector('.children')?.appendChild(stats.dom);

    function generatePoints() {
        points = [];
        // Generate static points
        for (let i = 0; i < params.pointCount; i++) {
            points.push({
                x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
                y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
                z: bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)
            });
        }
    }

    function initContext() {
        if (context) context.delete();
        context = new Voro.VoronoiContext3D(
            bounds.minX, bounds.maxX,
            bounds.minY, bounds.maxY,
            bounds.minZ, bounds.maxZ,
            1, 1, 1
        );

        // Add Selected Wall
        let wall;
        switch (params.shape) {
            case 'Torus':
                wall = new VoronoiWallTorus(3, 1);
                break;
            case 'Lemniscate':
                wall = new VoronoiWallLemniscate(3, 1, 128);
                break;
            case 'Cylinder':
                wall = new VoronoiWallCylinder(3, 4);
                break;
        }
        if (wall) {
            context.addWallJS(wall);
        }

        // Add static points once
        points.forEach((p, i) => {
            context.addPoint(i, p.x, p.y, p.z);
        });
    }

    function updateVoronoi() {
        // 1. Clear and Re-populate
        context.clear();
        
        points.forEach((p, i) => {
            context.addPoint(i, p.x, p.y, p.z);
        });

        // 3. Compute Cells
        const cells = context.getCells();

        // 4. Build Geometry
        const staticPositions: number[] = [];

        cells.forEach((cell: any) => {
            if (cell.vertices && cell.faces) {
                cell.faces.forEach((face: number[]) => {
                    if (face.length < 3) return;
                    const v0 = cell.vertices[face[0]];
                    for (let j = 1; j < face.length - 1; j++) {
                        const v1 = cell.vertices[face[j]];
                        const v2 = cell.vertices[face[j+1]];

                        staticPositions.push(v0.x, v0.y, v0.z);
                        staticPositions.push(v1.x, v1.y, v1.z);
                        staticPositions.push(v2.x, v2.y, v2.z);
                    }
                });
            }
        });

        // 5. Update Visualization
        if (staticMesh) {
            pivot.remove(staticMesh);
            staticMesh.geometry.dispose();
        }

        // Static Mesh (Transparent White)
        const staticGeo = new THREE.BufferGeometry();
        staticGeo.setAttribute('position', new THREE.Float32BufferAttribute(staticPositions, 3));
        staticGeo.computeVertexNormals();

        const staticMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.1,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide,
            depthWrite: false // Helps with transparency
        });

        staticMesh = new THREE.Mesh(staticGeo, staticMat);
        pivot.add(staticMesh);
        // Context is reused
    }

    function resetSimulation() {
        generatePoints();
        initContext();
        updateVoronoi();
    }

    // Initialize
    resetSimulation();

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        stats.update();
        
        pivot.rotation.y += 0.002;

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
            link.download = 'moving_cell.png';
            link.href = renderer.domElement.toDataURL('image/png');
            link.click();
        }
    });
}

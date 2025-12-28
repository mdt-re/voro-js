import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import GUI from 'lil-gui';

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
        velocity: 0.1,
        autoRun: true,
        showPoints: true,
        regenerate: () => resetSimulation()
    };

    let points: {x: number, y: number, z: number}[] = [];
    let mover = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
    let staticMesh: THREE.Mesh | null = null;
    let moverMesh: THREE.Mesh | null = null;
    let staticPointsMesh: THREE.InstancedMesh | null = null;
    let moverPointMesh: THREE.Mesh | null = null;
    const pointGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const pointMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    const moverPointMat = new THREE.MeshStandardMaterial({ color: 0x00ffff });
    let context: any = null;

    // GUI
    const gui = new GUI();
    gui.add(params, 'pointCount', 8, 200, 1).name('Point Count').onFinishChange(resetSimulation);
    gui.add(params, 'velocity', 0.01, 0.5).name('Velocity');
    gui.add(params, 'autoRun').name('Auto Run');
    gui.add(params, 'showPoints').name('Show Points');
    gui.add(params, 'regenerate').name('Regenerate');

    // Integrate Stats into GUI
    stats.dom.style.cssText = 'position:relative;top:auto;left:auto;display:block;margin:10px auto;';
    const statsFolder = gui.addFolder('Stats');
    statsFolder.domElement.querySelector('.children')?.appendChild(stats.dom);

    function generatePoints() {
        points = [];
        // Generate static points
        for (let i = 0; i < params.pointCount - 1; i++) {
            points.push({
                x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
                y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
                z: bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)
            });
        }

        // Initialize mover
        mover.x = 0; mover.y = 0; mover.z = 0;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        mover.vx = Math.sin(phi) * Math.cos(theta);
        mover.vy = Math.sin(phi) * Math.sin(theta);
        mover.vz = Math.cos(phi);

        // Update Static Points Mesh
        if (staticPointsMesh) {
            pivot.remove(staticPointsMesh);
        }
        staticPointsMesh = new THREE.InstancedMesh(pointGeo, pointMat, points.length);
        const dummy = new THREE.Object3D();
        points.forEach((p, i) => {
            dummy.position.set(p.x, p.y, p.z);
            dummy.updateMatrix();
            staticPointsMesh!.setMatrixAt(i, dummy.matrix);
        });
        staticPointsMesh.instanceMatrix.needsUpdate = true;
        pivot.add(staticPointsMesh);

        // Update Mover Point Mesh
        if (moverPointMesh) pivot.remove(moverPointMesh);
        moverPointMesh = new THREE.Mesh(pointGeo, moverPointMat);
        pivot.add(moverPointMesh);
    }

    function initContext() {
        if (context) context.delete();
        context = new Voro.VoronoiContext3D(
            bounds.minX, bounds.maxX,
            bounds.minY, bounds.maxY,
            bounds.minZ, bounds.maxZ,
            1, 1, 1
        );

        // Add static points once
        points.forEach((p, i) => {
            context.addPoint(i + 1, p.x, p.y, p.z);
        });
        
        // Add mover initially
        context.addPoint(0, mover.x, mover.y, mover.z);
    }

    function updateVoronoi() {
        // 1. Clear and Re-populate
        context.clear();
        
        points.forEach((p, i) => {
            context.addPoint(i + 1, p.x, p.y, p.z);
        });
        context.addPoint(0, mover.x, mover.y, mover.z);

        // 3. Compute Cells
        const cells = context.getCells();

        // 4. Build Geometry
        const staticPositions: number[] = [];
        const moverPositions: number[] = [];

        cells.forEach((cell: any) => {
            const isMover = (cell.id === 0);
            const targetArray = isMover ? moverPositions : staticPositions;

            if (cell.vertices && cell.faces) {
                cell.faces.forEach((face: number[]) => {
                    if (face.length < 3) return;
                    const v0 = cell.vertices[face[0]];
                    for (let j = 1; j < face.length - 1; j++) {
                        const v1 = cell.vertices[face[j]];
                        const v2 = cell.vertices[face[j+1]];

                        targetArray.push(v0.x, v0.y, v0.z);
                        targetArray.push(v1.x, v1.y, v1.z);
                        targetArray.push(v2.x, v2.y, v2.z);
                    }
                });
            }
        });

        // 5. Update Visualization
        if (staticMesh) {
            pivot.remove(staticMesh);
            staticMesh.geometry.dispose();
        }
        if (moverMesh) {
            pivot.remove(moverMesh);
            moverMesh.geometry.dispose();
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
        staticMesh.position.set(0, 0, 0);
        pivot.add(staticMesh);

        // Mover Mesh (Colored, e.g., Red)
        const moverGeo = new THREE.BufferGeometry();
        moverGeo.setAttribute('position', new THREE.Float32BufferAttribute(moverPositions, 3));
        moverGeo.computeVertexNormals();

        const moverMat = new THREE.MeshStandardMaterial({
            color: 0xff3333,
            roughness: 0.2,
            metalness: 0.5,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });

        moverMesh = new THREE.Mesh(moverGeo, moverMat);
        moverMesh.position.set(0, 0, 0);
        pivot.add(moverMesh);

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

        if (params.autoRun) {
            // Update Mover Position
            mover.x += mover.vx * params.velocity;
            mover.y += mover.vy * params.velocity;
            mover.z += mover.vz * params.velocity;

            // Bounce
            if (mover.x < bounds.minX || mover.x > bounds.maxX) mover.vx *= -1;
            if (mover.y < bounds.minY || mover.y > bounds.maxY) mover.vy *= -1;
            if (mover.z < bounds.minZ || mover.z > bounds.maxZ) mover.vz *= -1;

            // Clamp to be safe
            mover.x = Math.max(bounds.minX, Math.min(bounds.maxX, mover.x));
            mover.y = Math.max(bounds.minY, Math.min(bounds.maxY, mover.y));
            mover.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, mover.z));

            updateVoronoi();
        }

        // Update visualization visibility and mover position
        if (moverPointMesh) {
            moverPointMesh.position.set(mover.x, mover.y, mover.z);
            moverPointMesh.visible = params.showPoints;
        }
        if (staticPointsMesh) {
            staticPointsMesh.visible = params.showPoints;
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
            link.download = 'moving_cell.png';
            link.href = renderer.domElement.toDataURL('image/png');
            link.click();
        }
    });
}
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import Stats from 'three/addons/libs/stats.module.js';

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
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(0x050505, 0.1);
    
    // Camera setup - will be updated to follow the cell
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 100);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Controls - allow looking around from the center
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false; // Stay inside
    controls.rotateSpeed = 0.5;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1, 20);
    scene.add(pointLight); // Light moves with camera/cell

    // Bounds
    const bounds = { min: -10, max: 10 };
    
    // Static Points (The "Stars")
    const staticPoints: {x: number, y: number, z: number}[] = [];
    const numStatic = 200;
    
    for(let i=0; i<numStatic; i++) {
        const x = (Math.random() - 0.5) * 20;
        const y = (Math.random() - 0.5) * 20;
        const z = (Math.random() - 0.5) * 20;
        staticPoints.push({x, y, z});
    }

    // Voronoi Context
    const context = new Voro.VoronoiContext3D(
        bounds.min, bounds.max,
        bounds.min, bounds.max,
        bounds.min, bounds.max,
        1, 1, 1
    );

    // Cell Mesh
    let cellMesh: THREE.LineSegments | null = null;
    const edgeMaterial = new THREE.LineBasicMaterial({
        color: 0x00ff88,
        linewidth: 2
    });

    // Curve Logic
    const curveTypes = ['lemniscate', 'circle', 'trefoil', 'torus_coil'];
    //const selectedCurve = curveTypes[Math.floor(Math.random() * curveTypes.length)];
    const selectedCurve = 'torus_coil';
    const curveParams = {
        a: 8,
        speed: 0.5,
        reveal: false,
        type: selectedCurve
    };
    let time = 0;

    function getCurvePoint(t: number, type: string, scale: number) {
        let x = 0, y = 0, z = 0;
        if (type === 'circle') {
            x = scale * Math.cos(t);
            z = scale * Math.sin(t);
        } else if (type === 'trefoil') {
            // 3D trefoil knot
            const s = scale * 0.4; 
            x = s * (Math.sin(t) + 2 * Math.sin(2 * t));
            z = s * (Math.cos(t) - 2 * Math.cos(2 * t));
            y = s * -Math.sin(3 * t);
        } else if (type === 'torus_coil') {
            const R = scale * 0.6; // Major radius
            const r = scale * 0.2; // Minor radius
            const coils = 12;
            x = (R + r * Math.cos(coils * t)) * Math.cos(t);
            z = (R + r * Math.cos(coils * t)) * Math.sin(t);
            y = r * Math.sin(coils * t);
        } else {
            // Lemniscate of Bernoulli
            const den = 1 + Math.sin(t)**2;
            x = (scale * Math.cos(t)) / den;
            z = (scale * Math.sin(t) * Math.cos(t)) / den;
        }
        return { x, y, z };
    }

    // Curve Visualization
    const curvePoints: THREE.Vector3[] = [];
    for(let t=0; t<=Math.PI*2; t+=0.05) {
        const p = getCurvePoint(t, curveParams.type, curveParams.a);
        curvePoints.push(new THREE.Vector3(p.x, p.y, p.z));
    }
    const curveGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const curveMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const curveLine = new THREE.Line(curveGeo, curveMat);
    curveLine.visible = false;
    scene.add(curveLine);

    // GUI
    const gui = new GUI();
    gui.add(curveParams, 'speed', 0.1, 2.0).name('Speed');
    gui.add(curveParams, 'reveal').name('Reveal Curve').onChange((v: boolean) => curveLine.visible = v);

    // Stats
    const stats = new Stats();
    stats.dom.style.cssText = 'position:relative;top:auto;left:auto;display:block;margin:10px auto;';
    const statsFolder = gui.addFolder('Stats');
    statsFolder.domElement.querySelector('.children')?.appendChild(stats.dom);

    function update() {
        // 1. Calculate Mover Position
        time += 0.01 * curveParams.speed;
        
        const pos = getCurvePoint(time, curveParams.type, curveParams.a);

        // Calculate look-ahead position for camera orientation
        const tNext = time + 0.5;
        const look = getCurvePoint(tNext, curveParams.type, curveParams.a);

        // 2. Update Camera/Light
        camera.position.set(pos.x, pos.y, pos.z);
        pointLight.position.set(pos.x, pos.y, pos.z);
        controls.target.set(look.x, look.y, look.z);

        // 3. Update Voronoi
        context.clear();
        
        // Add static points (ID 1+)
        staticPoints.forEach((p, i) => {
            context.addPoint(i + 1, p.x, p.y, p.z);
        });

        // Add mover (ID 0)
        context.addPoint(0, pos.x, pos.y, pos.z);

        // 4. Get All Cells to render full structure
        const cells = context.getCells();
        
        if (cellMesh) {
            scene.remove(cellMesh);
            cellMesh.geometry.dispose();
        }

        const geometry = new THREE.BufferGeometry();
        const positions: number[] = [];

        cells.forEach((cell: any) => {
            cell.edges.forEach((edge: number[]) => {
                const v1 = cell.vertices[edge[0]];
                const v2 = cell.vertices[edge[1]];
                positions.push(v1.x, v1.y, v1.z);
                positions.push(v2.x, v2.y, v2.z);
            });
        });

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        cellMesh = new THREE.LineSegments(geometry, edgeMaterial);
        scene.add(cellMesh);
    }

    function animate() {
        requestAnimationFrame(animate);
        stats.update();
        update();
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('keydown', (e) => { 
        if(e.key === 'p') { 
            renderer.render(scene, camera); 
            const l = document.createElement('a'); 
            l.download='curve_game.png'; 
            l.href=renderer.domElement.toDataURL(); 
            l.click(); 
        }
    });
}
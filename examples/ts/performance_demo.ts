import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import Stats from 'three/addons/libs/stats.module.js';

import('../../dist/voro_browser.js').then((voroModule: any) => {
    return voroModule.default();
}).then((Voro: any) => {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';
    initApp(Voro);
}).catch((err: any) => {
    console.error("Failed to initialize Voro++ module:", err);
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.innerText = 'Error loading Voro++ module.';
});

function initApp(Voro: any) {
    // --- Three.js Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 60;

    const persCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 500);
    persCamera.position.set(28, 21, 28);

    const orthoCamera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2, frustumSize * aspect / 2,
        frustumSize / 2, frustumSize / -2,
        0.1, 1000
    );
    orthoCamera.position.set(28, 21, 28);

    let activeCamera: THREE.Camera = persCamera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    const container = document.getElementById('container');
    if (container) container.appendChild(renderer.domElement);

    const controls = new OrbitControls(activeCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Visualization Group
    const visGroup = new THREE.Group();
    scene.add(visGroup);

    // --- Benchmark Logic ---
    const params = {
        cameraType: 'Perspective',
        count: 1000,
        boxSize: 20,
        n: 10,
        render: true,
        run: () => runBenchmark(),
        download: () => downloadResults()
    };

    let lastResults: any = null;

    const gui = new GUI();
    gui.add(params, 'cameraType', ['Perspective', 'Orthographic']).name('Camera').onChange((val: string) => {
        const prevCamera = activeCamera;
        if (val === 'Perspective') {
            activeCamera = persCamera;
        } else {
            activeCamera = orthoCamera;
        }
        activeCamera.position.copy(prevCamera.position);
        activeCamera.rotation.copy(prevCamera.rotation);
        controls.object = activeCamera;
    });
    gui.add(params, 'count', 100, 50000, 100).name('Particle Count');
    gui.add(params, 'boxSize', 10, 100).name('Box Size');
    gui.add(params, 'n', 1, 50, 1).name('Grid Size (n)');
    gui.add(params, 'render').name('Render Result');
    gui.add(params, 'run').name('Run Benchmark');
    gui.add(params, 'download').name('Download CSV');

    // Stats
    const stats = new Stats();
    stats.dom.style.cssText = 'position:relative;top:auto;left:auto;display:block;margin:10px auto;';
    const statsFolder = gui.addFolder('Stats');
    statsFolder.domElement.querySelector('.children')?.appendChild(stats.dom);

    function runBenchmark() {
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) {
            resultsDiv.style.display = 'block';
            resultsDiv.innerText = 'Running...';
        }

        // Use setTimeout to allow UI to update before heavy processing
        setTimeout(() => {
            try {
                // 1. Data Generation (JS Side)
                const t0 = performance.now();
                const ids = new Int32Array(params.count);
                const x = new Float64Array(params.count);
                const y = new Float64Array(params.count);
                const z = new Float64Array(params.count);

                for(let i=0; i<params.count; i++) {
                    ids[i] = i;
                    x[i] = (Math.random() - 0.5) * params.boxSize;
                    y[i] = (Math.random() - 0.5) * params.boxSize;
                    z[i] = (Math.random() - 0.5) * params.boxSize;
                }
                const tGen = performance.now() - t0;

                // 2. Data Marshalling (JS -> C++)
                const t1 = performance.now();
                const emIds = new Voro.VectorInt();
                const emX = new Voro.VectorDouble();
                const emY = new Voro.VectorDouble();
                const emZ = new Voro.VectorDouble();

                // Resize vectors first to avoid reallocations (if resize is exposed, otherwise push_back)
                // The bindings use push_back in the test, let's stick to that or resize if available.
                // Standard vector bindings usually expose push_back.
                for(let i=0; i<params.count; i++) {
                    emIds.push_back(ids[i]);
                    emX.push_back(x[i]);
                    emY.push_back(y[i]);
                    emZ.push_back(z[i]);
                }
                const tMarshal = performance.now() - t1;

                // 3. Context Initialization & Insertion
                const t2 = performance.now();
                const half = params.boxSize / 2;
                const n = params.n;
                
                const context = new Voro.VoronoiContext3D(
                    -half, half, -half, half, -half, half,
                    n, n, n
                );
                context.addPoints(emIds, emX, emY, emZ);
                const tInsert = performance.now() - t2;

                // 4. Computation & Extraction
                const t3 = performance.now();
                const cells = context.getCells(); // This returns JS array of objects
                const tCompute = performance.now() - t3;

                // Cleanup C++ objects
                context.delete();
                emIds.delete();
                emX.delete();
                emY.delete();
                emZ.delete();

                // 5. Visualization (Optional)
                visGroup.clear();
                if (params.render) {
                    if (params.count > 50000) {
                        // Render points only for performance
                        const geo = new THREE.BufferGeometry();
                        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(params.count * 3), 3));
                        const pos = geo.attributes.position.array;
                        for(let i=0; i<params.count; i++) {
                            pos[i*3] = x[i];
                            pos[i*3+1] = y[i];
                            pos[i*3+2] = z[i];
                        }
                        const mat = new THREE.PointsMaterial({ color: 0x00ff88, size: 0.2 });
                        visGroup.add(new THREE.Points(geo, mat));
                    } else {
                        // Render wireframe cells
                        const vertices: number[] = [];
                        cells.forEach((cell: any) => {
                            if(cell.vertices && cell.faces) {
                                cell.faces.forEach((face: number[]) => {
                                    for(let j=0; j<face.length; j++) {
                                        const v1 = cell.vertices[face[j]];
                                        const v2 = cell.vertices[face[(j+1)%face.length]];
                                        vertices.push(v1.x, v1.y, v1.z);
                                        vertices.push(v2.x, v2.y, v2.z);
                                    }
                                });
                            }
                        });
                        const geo = new THREE.BufferGeometry();
                        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                        const mat = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.3 });
                        visGroup.add(new THREE.LineSegments(geo, mat));
                    }
                }

                // Report
                const total = tGen + tMarshal + tInsert + tCompute;
                const particlesPerBox = params.count / (n * n * n);

                lastResults = {
                    count: params.count,
                    boxSize: params.boxSize,
                    n: n,
                    particlesPerBox: particlesPerBox,
                    gen: tGen,
                    marshal: tMarshal,
                    insert: tInsert,
                    compute: tCompute,
                    total: total
                };

                if (resultsDiv) {
                    resultsDiv.innerText = 
                        `Particles:    ${params.count}\n` +
                        `Box Size:     ${params.boxSize}\n` +
                        `Grid (nxnxn): ${n}x${n}x${n}\n` +
                        `Part/Box:     ${particlesPerBox.toFixed(2)}\n` +
                        `------------------------\n` +
                        `JS Gen:       ${tGen.toFixed(2)} ms\n` +
                        `Marshalling:  ${tMarshal.toFixed(2)} ms\n` +
                        `Insertion:    ${tInsert.toFixed(2)} ms\n` +
                        `Compute+Extr: ${tCompute.toFixed(2)} ms\n` +
                        `------------------------\n` +
                        `Total:        ${total.toFixed(2)} ms\n` +
                        `FPS (equiv):  ${(1000/total).toFixed(1)}`;
                }

            } catch (e: any) {
                console.error(e);
                if (resultsDiv) resultsDiv.innerText = "Error: " + e.message;
            }
        }, 10);
    }

    function downloadResults() {
        if (!lastResults) {
            alert("No results to download. Run the benchmark first.");
            return;
        }

        const headers = "Particles,Box Size,Grid N,Part/Box,JS Gen (ms),Marshalling (ms),Insertion (ms),Compute (ms),Total (ms)\n";
        const row = `${lastResults.count},${lastResults.boxSize},${lastResults.n},${lastResults.particlesPerBox.toFixed(2)},${lastResults.gen.toFixed(2)},${lastResults.marshal.toFixed(2)},${lastResults.insert.toFixed(2)},${lastResults.compute.toFixed(2)},${lastResults.total.toFixed(2)}`;

        const blob = new Blob([headers + row], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "voro_benchmark_results.csv";
        link.click();
    }

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        stats.update();
        controls.update();
        renderer.render(scene, activeCamera);
    }
    animate();

    // Resize
    window.addEventListener('resize', () => {
        const aspect = window.innerWidth / window.innerHeight;
        
        persCamera.aspect = aspect;
        persCamera.updateProjectionMatrix();

        orthoCamera.left = -frustumSize * aspect / 2;
        orthoCamera.right = frustumSize * aspect / 2;
        orthoCamera.top = frustumSize / 2;
        orthoCamera.bottom = -frustumSize / 2;
        orthoCamera.updateProjectionMatrix();

        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Handle screenshot
    window.addEventListener('keydown', (event) => {
        if (event.key === 'p') {
            renderer.render(scene, activeCamera);
            const link = document.createElement('a');
            link.download = 'voro_performance.png';
            link.href = renderer.domElement.toDataURL('image/png');
            link.click();
        }
    });

    // Auto-run once
    runBenchmark();
}
import * as THREE from "three";
import OrbitControls from "three-orbitcontrols";
const vertexShader = require('webpack-glsl-loader!./shader/vertexShader.vert');
const fragmentShader = require('webpack-glsl-loader!./shader/fragmentShader.frag');

const clock = new THREE.Clock();
const scene = new THREE.Scene();
const bgColor = new THREE.Color(0.8, 0.8, 0.688);
scene.background = new THREE.Color(0.1, 0.1, 0.1);

const FACE_NUM = 1;
const PADDING = 0;
const SHORT_RATIO = 0.219;
const LONG_RATIO = 0.281;
let geometry, mesh;

let index = [];
let vertices = [];
let uvs = [];
let indices = [];
let paddings = [];
let colors = [];
let size = [];
let directions = [];
let ratios = [];
let weights = [];

let baseTile;
let tiles = [];
let totalRenderCount = 0;

// For dev
let currentTime = [0];
let isImageGenerationMode = false;
let showGenerateImageButton = false;

const uniforms = {
    time: { type: "f", value: 1.0 },
    resolution: { type: "v2", value: new THREE.Vector2() },
    texture: { type: 't', value: null },
    textureResolution: { type: "v2", value: new THREE.Vector2() },
    textureBlockSize: { type: "f", value: 1.0 },
    bgColor: { type: "v3", value: new THREE.Vector3(bgColor.r, bgColor.g, bgColor.b) },
};

const map = (value, beforeMin, beforeMax, afterMin, afterMax) => {
    return afterMin + (afterMax - afterMin) * ((value - beforeMin) / (beforeMax - beforeMin));
}

// Camera
const fov = 45;
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(fov, aspect, 1, 10000);
const stageHeight = window.innerHeight;
// Make camera distance same as actual pixel value.
const z = stageHeight / Math.tan(fov * Math.PI / 360) / 2;
camera.position.z = z;

const renderer = new THREE.WebGLRenderer();
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

const render = () => {
    const delta = clock.getDelta();
    const time = clock.elapsedTime;
    if (!isImageGenerationMode) {
        currentTime[0] = time;
    }

    uniforms.time.value = currentTime[0];

    // if (baseTile) {
    //     baseTile.update();
    // //
    // //     const sec = Math.floor(currentTime[0]);
    // //     if (sec === 0 || sec !== lastUpdatedTime && sec % 8 === 0) {
    // //         baseTile.updateTarget(0.5);
    // //         lastUpdatedTime = sec;
    // //     }
    // }

    tiles.forEach(tile => {
        tile.update();
    });

    renderer.render(scene, camera);

    if (!isImageGenerationMode && !showGenerateImageButton) {
        requestAnimationFrame(render);
    }
};

const onResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    setSize(width, height);
};

const setSize = (width, height) => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    uniforms.resolution.value = new THREE.Vector2(width, height);

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
};

const addTilesToScene = () => {
    geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('index', new THREE.Uint16BufferAttribute(index, 1));
    geometry.setAttribute('totalIndex', new THREE.Float32BufferAttribute([...Array(index.length)].map(
        (_, index) => totalRenderCount
    ), 1));
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Uint16BufferAttribute(uvs, 2));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(size, 2));
    geometry.setAttribute('padding', new THREE.Float32BufferAttribute(paddings, 2));
    // geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('direction', new THREE.Float32BufferAttribute(directions, 1));
    geometry.setAttribute('ratio', new THREE.Float32BufferAttribute(ratios, 1));
    geometry.setAttribute('weight', new THREE.Float32BufferAttribute(weights, 2));

    const material = new THREE.RawShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        blending: THREE.NormalBlending,
        depthTest: true,
        wireframe: false,
        side: THREE.DoubleSide,
        glslVersion: THREE.GLSL1
    });

    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
};

const createTiles = () => {
    totalRenderCount = 0;
    scene.clear();

    index = [];
    vertices = [];
    uvs = [];
    indices = [];
    paddings = [];
    colors = [];
    size = [];
    directions = [];
    ratios = [];
    weights = [];

    const getStepW = (i) => {
        const stepW = (i % 2 === 0) ? SHORT_RATIO : LONG_RATIO;
        return stepW * window.innerWidth;
    };

    const getLength = (index) => {
        let length = 0;
        for (let i = index - 1; i >= 0; i--) {
            length += getStepW(i);
        }
        return length;
    };

    for (let i = 0; i < 4; i++) {
        tiles.push(new Tile(
          -window.innerWidth / 2 + getLength(i),
          -stageHeight / 2,
          getStepW(i),
          stageHeight
        ));
    }

    addTilesToScene();
}

const initTiles = () => {
    createTiles();
};

class Tile {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        // this.z = Math.random() * 300;
        this.z = 0;
        this.w = w;
        this.h = h;
        this.ratio = 0.5 + (Math.random() * 2.0 - 1.0) * 0.1;
        this.id = -1;
        this.impulse = 0;

        this.draw(false);
    }
    update(arg = null) {
        if (!!arg) {
            this.x = arg.x;
            this.y = arg.y;
            this.w = arg.w;
            this.h = arg.h;
            this.impulse = arg.impulse;
        }
        this.draw(true);
    }
    getPositionAndSize(faceIndex, vertexIndex) {
        let x, y, z;
        let w, h;
        switch (faceIndex) {
            case 0: {
                // front
                x = (vertexIndex === 0 || vertexIndex === 3) ? this.x + PADDING : this.x + this.w - PADDING;
                y = (vertexIndex === 0 || vertexIndex === 1) ? this.y + PADDING : this.y + this.h - PADDING;
                z = this.z;
                w = this.w - PADDING * 2;
                h = this.h - PADDING * 2;
                break;
            }
            case 1: {
                // right
                x = this.x + this.w - PADDING;
                y = (vertexIndex === 0 || vertexIndex === 1) ? this.y + PADDING : this.y + this.h - PADDING;
                z = (vertexIndex === 0 || vertexIndex === 3) ? this.z : 0;
                w = this.z;
                h = this.h - PADDING * 2;
                break;
            }
            case 2: {
                // back
                x = (vertexIndex === 0 || vertexIndex === 3) ? this.x + PADDING : this.x + this.w - PADDING;
                y = (vertexIndex === 0 || vertexIndex === 1) ? this.y + PADDING : this.y + this.h - PADDING;
                z = 0;
                w = this.w - PADDING * 2;
                h = this.h - PADDING * 2;
                break;
            }
            case 3: {
                // left
                x = this.x + PADDING;
                y = (vertexIndex === 0 || vertexIndex === 1) ? this.y + PADDING : this.y + this.h - PADDING;
                z = (vertexIndex === 0 || vertexIndex === 3) ? 0 : this.z;
                w = this.z;
                h = this.h - PADDING * 2;
                break;
            }
            case 4: {
                // top
                x = (vertexIndex === 0 || vertexIndex === 3) ? this.x + PADDING : this.x + this.w - PADDING;
                y = this.y + this.h - PADDING;
                z = (vertexIndex === 0 || vertexIndex === 1) ? this.z : 0;
                w = this.w - PADDING * 2;
                h = this.z;
                break;
            }
            case 5: {
                // bottom
                x = (vertexIndex === 0 || vertexIndex === 3) ? this.x + PADDING : this.x + this.w - PADDING;
                y = this.y + PADDING;
                z = (vertexIndex === 0 || vertexIndex === 1) ? this.z : 0;
                w = this.w - PADDING * 2;
                h = this.z;
                break;
            }
        }
        return {
            x,
            y,
            z,
            w,
            h
        }
    }
    draw(shouldUpdate = false) {
        if (shouldUpdate) {
            // Update
            const screenPos = this.getScreenPosition();

            for (let k = 0; k < FACE_NUM; k++) {
                for (let j = 0; j < 4; j++) {
                    const targetIndex = this.id * FACE_NUM * 4 + k * 4 + j;

                    const position = geometry.attributes.position;
                    const {  x, y, z, w, h } = this.getPositionAndSize(k, j);
                    position.setXYZ(targetIndex, x, y, z);
                    position.needsUpdate = true;

                    const size = geometry.attributes.size;
                    size.setXY(targetIndex, w, h);
                    size.needsUpdate = true;

                    const ratio = geometry.attributes.ratio;
                    ratio.setX(targetIndex, this.impulse);
                    ratio.needsUpdate = true;

                    const direction = geometry.attributes.direction;
                    direction.setX(targetIndex, this.getDirection());
                    direction.needsUpdate = true;

                    const weight = geometry.attributes.weight;
                    weight.setXY(targetIndex, screenPos.x, screenPos.y);
                    weight.needsUpdate = true;
                }
            }
        } else {
            // Initial
            this.id = totalRenderCount;
            const screenPos = this.getScreenPosition();

            for (let k = 0; k < FACE_NUM; k++) {
                for (let j = 0; j < 4; j++) {
                    const {  x, y, z, w, h } = this.getPositionAndSize(k, j);
                    vertices.push(x, y, z);
                    size.push(w, h);
                    directions.push(this.getDirection());
                    ratios.push(this.ratio);
                    weights.push(screenPos.x, screenPos.y);
                }

                for (let j = 0; j < 4; j++) {
                    index.push(this.id);
                    paddings.push(PADDING, PADDING);
                }

                uvs.push(
                  0, 0,
                  1, 0,
                  1, 1,
                  0, 1
                );

                // polygon order
                // 3 -- 2
                // |    |
                // 0 -- 1
                const vertexIndex = this.id * FACE_NUM * 4 + k * 4;
                indices.push(
                  vertexIndex + 0, vertexIndex + 1, vertexIndex + 2,
                  vertexIndex + 2, vertexIndex + 3, vertexIndex + 0
                );
            }

            totalRenderCount++;
        }
    }
    getDirection() {
        if (Math.abs(this.w - this.h) < 100.0) {
            return -1.0;
        } else if (this.w > this.h) {
            return 1.0;
        } else {
            return 0.0;
        }
    }
    getCenter() {
        return {
            x: this.x + this.w / 2,
            y: this.y + this.h / 2
        }
    }
    getScreenPosition() {
        const centerOfTile = this.getCenter();
        const w = window.innerWidth;
        const h = stageHeight;
        return {
            x: (centerOfTile.x + w / 2) / w,
            y: (centerOfTile.y + h / 2) / h
        };
    }
}

const easeOutExpo = (x) => {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

window.addEventListener("resize", onResize);

initTiles();
onResize();
render();
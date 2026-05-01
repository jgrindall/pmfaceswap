import * as THREE from 'three';

let _renderer, _scene, _camera;
let _w, _h;

/* ---- mesh pools ---- */
const _fillMeshes  = [];
let   _fillCount   = 0;
const _borderLines = [];
let   _borderCount = 0;

/* ---- dedicated meshes ---- */
let _bgMesh, _bgMat;
let _previewMesh, _previewMat;

/* ---- dots (Points) ---- */
const MAX_DOTS = 600;
let _dotsPoints, _dotsGeo, _dotsMat;


export function initScene2D (canvas, gl, w, h)
{
    _w = w;
    _h = h;

    _renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true });
    _renderer.setSize(w, h, false);
    _renderer.autoClear = false;
    _renderer.setClearColor(new THREE.Color(0.7, 0.7, 0.7), 1.0);

    _scene  = new THREE.Scene();
    /* OrthographicCamera(left, right, top, bottom, near, far)
     * top=0, bottom=h  →  y=0 at screen top, y=h at screen bottom  (y-down) */
    _camera = new THREE.OrthographicCamera(0, w, 0, h, -1, 1);

    /* background quad — DoubleSide so negative-x-scale (H-flip) still renders */
    _bgMat  = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, side: THREE.DoubleSide });
    _bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), _bgMat);
    _bgMesh.visible = false;
    _scene.add(_bgMesh);

    /* mask preview quad */
    _previewMat  = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false });
    _previewMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), _previewMat);
    _previewMesh.visible = false;
    _scene.add(_previewMesh);

    /* landmark dots */
    _dotsGeo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(new Float32Array(MAX_DOTS * 3), 3);
    _dotsGeo.setAttribute('position', posAttr);
    _dotsMat   = new THREE.PointsMaterial({ sizeAttenuation: false, transparent: true, depthTest: false });
    _dotsPoints = new THREE.Points(_dotsGeo, _dotsMat);
    _dotsPoints.visible = false;
    _scene.add(_dotsPoints);
}

export function resizeScene2D (w, h)
{
    _w = w;
    _h = h;
    _renderer.setSize(w, h, false);
    _camera.right  = w;
    _camera.bottom = h;
    _camera.updateProjectionMatrix();
}

export function clearFrame ()
{
    _renderer.clear(true, true, false);
}


/* ---- texture helpers ---- */

function makeTexture ()
{
    const tex = new THREE.Texture();
    tex.flipY = false; /* keep UV(0,0)=top, matching image pixel coords */
    return tex;
}

export function createImageTexture (url)
{
    const obj = { ready: false, image: new Image() };
    const loader = new THREE.TextureLoader();
    obj.texture = loader.load(url, (tex) => {
        tex.flipY = false;
        tex.needsUpdate = true;
        obj.image = tex.image;
        obj.ready = true;
    });
    obj.texture.flipY = false;
    return obj;
}

export function createImageTextureFromFile (file)
{
    const obj   = { ready: false, image: new Image() };
    const tex   = makeTexture();
    obj.texture = tex;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = obj.image;
        img.onload = () => {
            tex.image      = img;
            tex.needsUpdate = true;
            obj.ready = true;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    return obj;
}

export function createCameraTexture ()
{
    const obj   = { ready: false };
    const video = document.createElement('video');
    video.autoplay    = true;
    video.muted       = true;
    video.loop        = true;
    video.playsInline = true;

    const tex  = new THREE.VideoTexture(video);
    tex.flipY  = false;
    obj.texture = tex;
    obj.video   = video;

    if (!navigator.mediaDevices) {
        alert('not supported navigator.mediaDevices');
        return obj;
    }

    navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 640 }, height: { ideal: 480 } }
    }).then(stream => {
        video.onloadedmetadata = () => { obj.ready = true; };
        video.srcObject = stream;
        video.play();
    }).catch(() => {
        alert('failed to initialize a camera');
    });

    return obj;
}

/* force GPU upload so getRawTexture works before the first render pass */
export function uploadTexture (texObj)
{
    if (texObj && texObj.texture) {
        texObj.texture.needsUpdate = true;
        _renderer.initTexture(texObj.texture);
    }
}

/* returns the raw WebGL texture handle for use in the face-mesh raw-GL pass */
export function getRawTexture (texture)
{
    return _renderer.properties.get(texture).__webglTexture;
}


/* ---- draw call helpers ---- */

function _positionMesh (mesh, x, y, w, h)
{
    mesh.position.set(x + w * 0.5, y + h * 0.5, 0);
    mesh.scale.set(w, h, 1);
}

export function beginFrame ()
{
    _bgMesh.visible      = false;
    _previewMesh.visible = false;
    _dotsPoints.visible  = false;
    _fillCount  = 0;
    _borderCount = 0;
    for (const m of _fillMeshes)  m.visible = false;
    for (const l of _borderLines) l.visible = false;
}

export function drawBackground (texture, x, y, w, h, flipH)
{
    _bgMat.map         = texture;
    _bgMat.needsUpdate = true;
    _positionMesh(_bgMesh, x, y, w, h);
    _bgMesh.scale.x = flipH ? -w : w;
    _bgMesh.visible  = true;
}

export function drawPreview (texture, x, y, w, h)
{
    _previewMat.map         = texture;
    _previewMat.needsUpdate = true;
    _positionMesh(_previewMesh, x, y, w, h);
    _previewMesh.visible = true;
}

function _getFillMesh ()
{
    if (_fillCount >= _fillMeshes.length) {
        const mat  = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
        _scene.add(mesh);
        _fillMeshes.push(mesh);
    }
    const m   = _fillMeshes[_fillCount++];
    m.visible = true;
    return m;
}

export function drawFillRect (x, y, w, h, color)
{
    const mesh = _getFillMesh();
    _positionMesh(mesh, x, y, w, h);
    mesh.material.color.setRGB(color[0], color[1], color[2]);
    mesh.material.opacity = color[3];
}

function _getBorderLine ()
{
    if (_borderCount >= _borderLines.length) {
        /* unit square: (0,0)→(1,0)→(1,1)→(0,1)→(0,0) in local space */
        const pts = new Float32Array([0,0,0, 1,0,0, 1,1,0, 0,1,0, 0,0,0]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        const mat  = new THREE.LineBasicMaterial({ transparent: true, depthTest: false });
        const line = new THREE.Line(geo, mat);
        _scene.add(line);
        _borderLines.push(line);
    }
    const l   = _borderLines[_borderCount++];
    l.visible = true;
    return l;
}

export function drawBorderRect (x, y, w, h, color)
{
    const line = _getBorderLine();
    line.position.set(x, y, 0);
    line.scale.set(w, h, 1);
    line.material.color.setRGB(color[0], color[1], color[2]);
    line.material.opacity = color[3];
}

/* batch draw for landmark dots — points is array of [x, y] */
export function drawDots (points, color, size)
{
    const posAttr = _dotsGeo.getAttribute('position');
    const n = Math.min(points.length, MAX_DOTS);
    for (let i = 0; i < n; i++) {
        posAttr.setXYZ(i, points[i][0], points[i][1], 0);
    }
    _dotsGeo.setDrawRange(0, n);
    posAttr.needsUpdate    = true;
    _dotsMat.color.setRGB(color[0], color[1], color[2]);
    _dotsMat.opacity = color[3];
    _dotsMat.size    = size;
    _dotsPoints.visible = true;
}

export function renderScene2D ()
{
    _renderer.render(_scene, _camera);
}

/* call this before any raw-WebGL draw calls so Three.js doesn't assume
 * its cached GL state is still valid */
export function resetGLState ()
{
    _renderer.resetState();
}

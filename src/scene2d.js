import * as THREE from 'three';

const MAX_DOTS = 600;

export class Scene2D
{
    constructor (canvas, gl, w, h)
    {
        this._fillMeshes  = [];
        this._fillCount   = 0;
        this._borderLines = [];
        this._borderCount = 0;

        this._renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true });
        this._renderer.setSize(w, h, false);
        this._renderer.autoClear = false;
        this._renderer.setClearColor(new THREE.Color(0.7, 0.7, 0.7), 1.0);

        this._scene  = new THREE.Scene();
        /* OrthographicCamera(left, right, top, bottom, near, far)
         * top=0, bottom=h  →  y=0 at screen top, y=h at screen bottom (y-down) */
        this._camera = new THREE.OrthographicCamera(0, w, 0, h, -1, 1);

        /* background quad — DoubleSide so negative-x-scale (H-flip) still renders */
        this._bgMat  = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, side: THREE.DoubleSide });
        this._bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this._bgMat);
        this._bgMesh.renderOrder = 0;
        this._bgMesh.visible = false;
        this._scene.add(this._bgMesh);

        /* mask preview quad */
        this._previewMat  = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false });
        this._previewMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this._previewMat);
        this._previewMesh.renderOrder = 2;
        this._previewMesh.visible = false;
        this._scene.add(this._previewMesh);

        /* landmark dots */
        this._dotsGeo = new THREE.BufferGeometry();
        this._dotsGeo.setAttribute('position',
            new THREE.BufferAttribute(new Float32Array(MAX_DOTS * 3), 3));
        this._dotsMat    = new THREE.PointsMaterial({ sizeAttenuation: false, transparent: true, depthTest: false });
        this._dotsPoints = new THREE.Points(this._dotsGeo, this._dotsMat);
        this._dotsPoints.renderOrder = 3;
        this._dotsPoints.visible = false;
        this._scene.add(this._dotsPoints);
    }

    get scene ()    { return this._scene; }
    get camera ()   { return this._camera; }
    get renderer () { return this._renderer; }

    resize (w, h)
    {
        this._renderer.setSize(w, h, false);
        this._camera.right  = w;
        this._camera.bottom = h;
        this._camera.updateProjectionMatrix();
    }

    clear ()
    {
        this._renderer.clear(true, true, false);
    }

    uploadTexture (texObj)
    {
        if (texObj && texObj.texture) {
            texObj.texture.needsUpdate = true;
            this._renderer.initTexture(texObj.texture);
        }
    }

    begin ()
    {
        this._bgMesh.visible      = false;
        this._previewMesh.visible = false;
        this._dotsPoints.visible  = false;
        this._fillCount   = 0;
        this._borderCount = 0;
        for (const m of this._fillMeshes)  m.visible = false;
        for (const l of this._borderLines) l.visible = false;
    }

    _positionMesh (mesh, x, y, w, h)
    {
        mesh.position.set(x + w * 0.5, y + h * 0.5, 0);
        mesh.scale.set(w, h, 1);
    }

    drawBackground (texture, x, y, w, h, flipH)
    {
        this._bgMat.map         = texture;
        this._bgMat.needsUpdate = true;
        this._positionMesh(this._bgMesh, x, y, w, h);
        this._bgMesh.scale.x = flipH ? -w : w;
        this._bgMesh.visible  = true;
    }

    drawPreview (texture, x, y, w, h)
    {
        this._previewMat.map         = texture;
        this._previewMat.needsUpdate = true;
        this._positionMesh(this._previewMesh, x, y, w, h);
        this._previewMesh.visible = true;
    }

    _getFillMesh ()
    {
        if (this._fillCount >= this._fillMeshes.length) {
            const mat  = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false });
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
            mesh.renderOrder = 4;
            this._scene.add(mesh);
            this._fillMeshes.push(mesh);
        }
        const m   = this._fillMeshes[this._fillCount++];
        m.visible = true;
        return m;
    }

    drawFillRect (x, y, w, h, color)
    {
        const mesh = this._getFillMesh();
        this._positionMesh(mesh, x, y, w, h);
        mesh.material.color.setRGB(color[0], color[1], color[2]);
        mesh.material.opacity = color[3];
    }

    _getBorderLine ()
    {
        if (this._borderCount >= this._borderLines.length) {
            const pts = new Float32Array([0,0,0, 1,0,0, 1,1,0, 0,1,0, 0,0,0]);
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
            const mat  = new THREE.LineBasicMaterial({ transparent: true, depthTest: false });
            const line = new THREE.Line(geo, mat);
            line.renderOrder = 5;
            this._scene.add(line);
            this._borderLines.push(line);
        }
        const l   = this._borderLines[this._borderCount++];
        l.visible = true;
        return l;
    }

    drawBorderRect (x, y, w, h, color)
    {
        const line = this._getBorderLine();
        line.position.set(x, y, 0);
        line.scale.set(w, h, 1);
        line.material.color.setRGB(color[0], color[1], color[2]);
        line.material.opacity = color[3];
    }

    drawDots (points, color, size)
    {
        const posAttr = this._dotsGeo.getAttribute('position');
        const n = Math.min(points.length, MAX_DOTS);
        for (let i = 0; i < n; i++)
            posAttr.setXYZ(i, points[i][0], points[i][1], 0);
        this._dotsGeo.setDrawRange(0, n);
        posAttr.needsUpdate = true;
        this._dotsMat.color.setRGB(color[0], color[1], color[2]);
        this._dotsMat.opacity = color[3];
        this._dotsMat.size    = size;
        this._dotsPoints.visible = true;
    }

    render ()
    {
        this._renderer.render(this._scene, this._camera);
    }


    /* ---- static texture factories ---- */

    static createImageTexture (url)
    {
        const obj = { ready: false, image: new Image() };
        obj.texture = new THREE.TextureLoader().load(url, (tex) => {
            tex.flipY = false;
            tex.needsUpdate = true;
            obj.image = tex.image;
            obj.ready = true;
        });
        obj.texture.flipY = false;
        return obj;
    }

    static createImageTextureFromFile (file)
    {
        const obj = { ready: false, image: new Image() };
        const tex = new THREE.Texture();
        tex.flipY   = false;
        obj.texture = tex;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = obj.image;
            img.onload = () => {
                tex.image       = img;
                tex.needsUpdate = true;
                obj.ready = true;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        return obj;
    }

    static createCameraTexture ()
    {
        const obj   = { ready: false };
        const video = document.createElement('video');
        video.autoplay = video.muted = video.loop = video.playsInline = true;

        const tex   = new THREE.VideoTexture(video);
        tex.flipY   = false;
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
        }).catch(() => alert('failed to initialize a camera'));

        return obj;
    }
}

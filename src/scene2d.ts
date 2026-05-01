import * as THREE from 'three'

const MAX_DOTS = 600

export type Color4 = [number, number, number, number]

export interface TexObj {
    ready: boolean
    texture: THREE.Texture
    image: HTMLImageElement
}

export interface CamTexObj {
    ready: boolean
    texture: THREE.VideoTexture
    video: HTMLVideoElement
}

type FillMesh   = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
type BorderLine = THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>

export class Scene2D
{
    private _renderer:     THREE.WebGLRenderer
    private _scene:        THREE.Scene
    private _camera:       THREE.OrthographicCamera
    private _bgMat:        THREE.MeshBasicMaterial
    private _bgMesh:       THREE.Mesh
    private _previewMat:   THREE.MeshBasicMaterial
    private _previewMesh:  THREE.Mesh
    private _dotsGeo:      THREE.BufferGeometry
    private _dotsMat:      THREE.PointsMaterial
    private _dotsPoints:   THREE.Points
    private _fillMeshes:   FillMesh[]   = []
    private _fillCount     = 0
    private _borderLines:  BorderLine[] = []
    private _borderCount   = 0

    constructor (canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, w: number, h: number)
    {
        this._renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true })
        this._renderer.setSize(w, h, false)
        this._renderer.autoClear = false
        this._renderer.setClearColor(new THREE.Color(0.7, 0.7, 0.7), 1.0)

        this._scene  = new THREE.Scene()
        /* OrthographicCamera(left, right, top, bottom, near, far)
         * top=0, bottom=h  →  y=0 at screen top, y=h at screen bottom (y-down) */
        this._camera = new THREE.OrthographicCamera(0, w, 0, h, -1, 1)

        /* background quad — DoubleSide so negative-x-scale (H-flip) still renders */
        this._bgMat  = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, side: THREE.DoubleSide })
        this._bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this._bgMat)
        this._bgMesh.renderOrder = 0
        this._bgMesh.visible = false
        this._scene.add(this._bgMesh)

        /* mask preview quad */
        this._previewMat  = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false })
        this._previewMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this._previewMat)
        this._previewMesh.renderOrder = 2
        this._previewMesh.visible = false
        this._scene.add(this._previewMesh)

        /* landmark dots */
        this._dotsGeo = new THREE.BufferGeometry()
        this._dotsGeo.setAttribute('position',
            new THREE.BufferAttribute(new Float32Array(MAX_DOTS * 3), 3))
        this._dotsMat    = new THREE.PointsMaterial({ sizeAttenuation: false, transparent: true, depthTest: false })
        this._dotsPoints = new THREE.Points(this._dotsGeo, this._dotsMat)
        this._dotsPoints.renderOrder = 3
        this._dotsPoints.visible = false
        this._scene.add(this._dotsPoints)
    }

    get scene ():    THREE.Scene              { return this._scene }
    get camera ():   THREE.OrthographicCamera { return this._camera }
    get renderer (): THREE.WebGLRenderer      { return this._renderer }

    resize (w: number, h: number): void
    {
        this._renderer.setSize(w, h, false)
        this._camera.right  = w
        this._camera.bottom = h
        this._camera.updateProjectionMatrix()
    }

    clear (): void
    {
        this._renderer.clear(true, true, false)
    }

    uploadTexture (texObj: TexObj | CamTexObj): void
    {
        if (texObj?.texture) {
            texObj.texture.needsUpdate = true
            this._renderer.initTexture(texObj.texture)
        }
    }

    begin (): void
    {
        this._bgMesh.visible      = false
        this._previewMesh.visible = false
        this._dotsPoints.visible  = false
        this._fillCount   = 0
        this._borderCount = 0
        for (const m of this._fillMeshes)  m.visible = false
        for (const l of this._borderLines) l.visible = false
    }

    private _positionMesh (mesh: THREE.Object3D, x: number, y: number, w: number, h: number): void
    {
        mesh.position.set(x + w * 0.5, y + h * 0.5, 0)
        mesh.scale.set(w, h, 1)
    }

    drawBackground (texture: THREE.Texture, x: number, y: number, w: number, h: number, flipH: boolean): void
    {
        this._bgMat.map         = texture
        this._bgMat.needsUpdate = true
        this._positionMesh(this._bgMesh, x, y, w, h)
        this._bgMesh.scale.x = flipH ? -w : w
        this._bgMesh.visible  = true
    }

    drawPreview (texture: THREE.Texture, x: number, y: number, w: number, h: number): void
    {
        this._previewMat.map         = texture
        this._previewMat.needsUpdate = true
        this._positionMesh(this._previewMesh, x, y, w, h)
        this._previewMesh.visible = true
    }

    private _getFillMesh (): FillMesh
    {
        if (this._fillCount >= this._fillMeshes.length) {
            const mat  = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false })
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat) as FillMesh
            mesh.renderOrder = 4
            this._scene.add(mesh)
            this._fillMeshes.push(mesh)
        }
        const m   = this._fillMeshes[this._fillCount++]!
        m.visible = true
        return m
    }

    drawFillRect (x: number, y: number, w: number, h: number, color: Color4): void
    {
        const mesh = this._getFillMesh()
        this._positionMesh(mesh, x, y, w, h)
        mesh.material.color.setRGB(color[0], color[1], color[2])
        mesh.material.opacity = color[3]
    }

    private _getBorderLine (): BorderLine
    {
        if (this._borderCount >= this._borderLines.length) {
            const pts = new Float32Array([0,0,0, 1,0,0, 1,1,0, 0,1,0, 0,0,0])
            const geo = new THREE.BufferGeometry()
            geo.setAttribute('position', new THREE.BufferAttribute(pts, 3))
            const mat  = new THREE.LineBasicMaterial({ transparent: true, depthTest: false })
            const line = new THREE.Line(geo, mat) as BorderLine
            line.renderOrder = 5
            this._scene.add(line)
            this._borderLines.push(line)
        }
        const l   = this._borderLines[this._borderCount++]!
        l.visible = true
        return l
    }

    drawBorderRect (x: number, y: number, w: number, h: number, color: Color4): void
    {
        const line = this._getBorderLine()
        line.position.set(x, y, 0)
        line.scale.set(w, h, 1)
        line.material.color.setRGB(color[0], color[1], color[2])
        line.material.opacity = color[3]
    }

    drawDots (points: [number, number][], color: Color4, size: number): void
    {
        const posAttr = this._dotsGeo.getAttribute('position') as THREE.BufferAttribute
        const n = Math.min(points.length, MAX_DOTS)
        for (let i = 0; i < n; i++) {
            const p = points[i]!
            posAttr.setXYZ(i, p[0], p[1], 0)
        }
        this._dotsGeo.setDrawRange(0, n)
        posAttr.needsUpdate = true
        this._dotsMat.color.setRGB(color[0], color[1], color[2])
        this._dotsMat.opacity = color[3]
        this._dotsMat.size    = size
        this._dotsPoints.visible = true
    }

    render (): void
    {
        this._renderer.render(this._scene, this._camera)
    }


    /* ---- static texture factories ---- */

    static createImageTexture (url: string): TexObj
    {
        const obj: TexObj = { ready: false, image: new Image(), texture: new THREE.Texture() }
        obj.texture = new THREE.TextureLoader().load(url, (tex) => {
            tex.flipY = false
            tex.needsUpdate = true
            obj.image = tex.image as HTMLImageElement
            obj.ready = true
        })
        obj.texture.flipY = false
        return obj
    }

    static createImageTextureFromFile (file: File): TexObj
    {
        const obj: TexObj = { ready: false, image: new Image(), texture: new THREE.Texture() }
        const tex = obj.texture
        tex.flipY = false

        const reader = new FileReader()
        reader.onload = (e) => {
            const img = obj.image
            img.onload = () => {
                tex.image       = img
                tex.needsUpdate = true
                obj.ready = true
            }
            img.src = (e.target as FileReader).result as string
        }
        reader.readAsDataURL(file)
        return obj
    }

    static createCameraTexture (): CamTexObj
    {
        const video = document.createElement('video')
        video.autoplay = video.muted = video.loop = video.playsInline = true

        const tex   = new THREE.VideoTexture(video)
        tex.flipY   = false

        const obj: CamTexObj = { ready: false, texture: tex, video }

        if (!navigator.mediaDevices) {
            alert('not supported navigator.mediaDevices')
            return obj
        }

        navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { width: { ideal: 640 }, height: { ideal: 480 } }
        }).then(stream => {
            video.onloadedmetadata = () => { obj.ready = true }
            video.srcObject = stream
            void video.play()
        }).catch(() => alert('failed to initialize a camera'))

        return obj
    }
}

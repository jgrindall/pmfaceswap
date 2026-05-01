import * as THREE from 'three'

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

type FillMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>

export class Scene2D
{
    private renderer:   THREE.WebGLRenderer
    private scene:      THREE.Scene
    private camera:     THREE.OrthographicCamera
    private bgMaterial: THREE.MeshBasicMaterial
    private bgMesh:     THREE.Mesh
    private fillMeshes: FillMesh[] = []
    private fillCount   = 0

    public constructor (canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, w: number, h: number)
    {
        this.renderer = new THREE.WebGLRenderer({ 
            canvas, 
            context: gl, 
            alpha: true 
        })
        
        this.renderer.setSize(w, h, false)
        this.renderer.autoClear = false
        this.renderer.setClearColor(new THREE.Color(0.0, 0.0, 0.0), 1.0)

        this.scene  = new THREE.Scene()

        /* OrthographicCamera(left, right, top, bottom, near, far)*/
        this.camera = new THREE.OrthographicCamera(0, w, 0, h, -1, 1)

        /* background quad — DoubleSide so negative-x-scale (H-flip) still renders */
        this.bgMaterial = new THREE.MeshBasicMaterial({
            transparent: true, 
            depthTest: false, 
            side: THREE.DoubleSide 
        })
        this.bgMesh     = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.bgMaterial)
        this.bgMesh.renderOrder = 0
        this.bgMesh.visible = false
        this.scene.add(this.bgMesh)
    }

    /** Call after canvas is resized to keep renderer and camera in sync. */
    public resize (w: number, h: number): void
    {
        this.renderer.setSize(w, h, false)
        this.camera.right  = w
        this.camera.bottom = h
        this.camera.updateProjectionMatrix()
    }

    /** Clears the framebuffer at the start of each frame. */
    public clear (): void
    {
        this.renderer.clear(true, true, false)
    }

    public add (obj: THREE.Object3D): void
    {
        this.scene.add(obj)
    }

    public reset (): void
    {
        this.renderer.resetState()
    }

    /** Force-uploads a texture to the GPU so the first rendered frame has no stutter. */
    public uploadTexture (texObj: TexObj | CamTexObj): void
    {
        if (texObj?.texture) {
            texObj.texture.needsUpdate = true
            this.renderer.initTexture(texObj.texture)
        }
    }

    /** Call once per frame before any draw* calls — hides all pooled meshes and resets draw counters. */
    public begin (): void
    {
        this.bgMesh.visible = false
        this.fillCount = 0
        for (const m of this.fillMeshes){
            m.visible = false
        }
    }

    private positionMesh (mesh: THREE.Object3D, x: number, y: number, w: number, h: number): void
    {
        mesh.position.set(x + w * 0.5, y + h * 0.5, 0)
        mesh.scale.set(w, h, 1)
    }

    /** Draws the camera feed or source image as the full-canvas backdrop. */
    public drawBackground (texture: THREE.Texture, x: number, y: number, w: number, h: number, flipH: boolean): void
    {
        this.bgMaterial.map         = texture
        this.bgMaterial.needsUpdate = true
        this.positionMesh(this.bgMesh, x, y, w, h)
        this.bgMesh.scale.x = flipH ? -w : w
        this.bgMesh.visible  = true
    }

    private getFillMesh (): FillMesh
    {
        if (this.fillCount >= this.fillMeshes.length) {
            const mat  = new THREE.MeshBasicMaterial({
                transparent: true, 
                depthTest: false 
            })
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat) as FillMesh
            mesh.renderOrder = 4
            this.scene.add(mesh)
            this.fillMeshes.push(mesh)
        }
        const m   = this.fillMeshes[this.fillCount++]!
        m.visible = true
        return m
    }

    /** Draws a solid filled rectangle — used for the loading progress bar. */
    public drawFillRect (x: number, y: number, w: number, h: number, color: Color4): void
    {
        const mesh = this.getFillMesh()
        this.positionMesh(mesh, x, y, w, h)
        mesh.material.color.setRGB(color[0], color[1], color[2])
        mesh.material.opacity = color[3]
    }

    /** Submits the Three.js scene to the GPU. Call once at the end of each frame. */
    public render (): void
    {
        this.renderer.render(this.scene, this.camera)
    }
}

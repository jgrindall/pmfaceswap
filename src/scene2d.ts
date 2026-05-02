import * as THREE from 'three'

export type Color4 = [number, number, number, number]

export const RENDER_ORDER_BACKGROUND = 0
export const RENDER_ORDER_BODY       = 1
export const RENDER_ORDER_FACE       = 2
export const RENDER_ORDER_HAT        = 3

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
export class Scene2D {
    private renderer:   THREE.WebGLRenderer
    private scene:      THREE.Scene
    private camera:     THREE.OrthographicCamera
    private bgMaterial: THREE.MeshBasicMaterial
    private bgMesh:     THREE.Mesh
    
    constructor (canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, w: number, h: number) {
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
        this.camera = new THREE.OrthographicCamera(0, w, 0, h, -1000, 1000)

        /* background quad — DoubleSide so negative-x-scale (H-flip) still renders */
        this.bgMaterial = new THREE.MeshBasicMaterial({
            transparent: true, 
            depthTest: false, 
            side: THREE.DoubleSide 
        })
        this.bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.bgMaterial)
        this.bgMesh.renderOrder = RENDER_ORDER_BACKGROUND
        this.bgMesh.visible = false
        this.scene.add(this.bgMesh)
    }

    /** Call after canvas is resized to keep renderer and camera in sync. */
    public resize (w: number, h: number): void {
        this.renderer.setSize(w, h, false)
        this.camera.right  = w
        this.camera.bottom = h
        this.camera.updateProjectionMatrix()
    }

    /** Clears the framebuffer at the start of each frame. */
    public clear (): void {
        this.renderer.clear(true, true, false)
    }

    public add (obj: THREE.Object3D): void {
        this.scene.add(obj)
    }

    public reset (): void {
        this.renderer.resetState()
    }

    /** Force-uploads a texture to the GPU so the first rendered frame has no stutter. */
    public uploadTexture (texObj: TexObj | CamTexObj): void {
        if (texObj?.texture) {
            texObj.texture.needsUpdate = true
            this.renderer.initTexture(texObj.texture)
        }
    }

    private positionMesh (mesh: THREE.Object3D, x: number, y: number, w: number, h: number): void {
        mesh.position.set(x + w * 0.5, y + h * 0.5, 0)
        mesh.scale.set(w, h, 1)
    }

    /** Draws the camera feed or source image as the full-canvas backdrop. */
    public drawBackground (texture: THREE.Texture, x: number, y: number, w: number, h: number, flipH: boolean): void {
        this.bgMaterial.map = texture
        this.bgMaterial.needsUpdate = true
        this.positionMesh(this.bgMesh, x, y, w, h)
        this.bgMesh.scale.x = flipH ? -w : w
        this.bgMesh.visible  = true
    }

    /** Submits the Three.js scene to the GPU. Call once at the end of each frame. */
    public render (): void {
        this.renderer.render(this.scene, this.camera)
    }
}

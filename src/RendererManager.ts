import * as THREE from 'three'
import { BackgroundManager } from './BackgroundManager.ts'

export type Color4 = [number, number, number, number]

export const RENDER_ORDER_BACKGROUND = 0
export const RENDER_ORDER_BODY       = 1
export const RENDER_ORDER_FACE       = 2
export const RENDER_ORDER_HAT        = 3

export interface TextureObject {
    ready: boolean
    texture: THREE.Texture
    image: HTMLImageElement
}

export interface CameraTextureObject {
    ready: boolean
    texture: THREE.VideoTexture
    video: HTMLVideoElement
}

export class RendererManager {
    private renderer:   THREE.WebGLRenderer
    private scene:      THREE.Scene
    private camera:     THREE.OrthographicCamera
    private bg: BackgroundManager

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

        this.bg = new BackgroundManager(this.scene)

        /* lights needed by MeshStandardMaterial (used by GLB models) */
        this.scene.add(new THREE.AmbientLight(0xffffff, 1.0))
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
        dirLight.position.set(0, -1, 1)
        this.scene.add(dirLight)
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

    /** Draws the camera feed or source image as the full-canvas backdrop. */
    public drawBackground (texture: THREE.Texture, x: number, y: number, w: number, h: number, flipH: boolean): void {
        this.bg.draw(texture, x, y, w, h, flipH)
    }

    /** Submits the Three.js scene to the GPU. Call once at the end of each frame. */
    public render (): void {
        this.renderer.render(this.scene, this.camera)
    }
}

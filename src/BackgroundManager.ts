import * as THREE from 'three'
import { RENDER_ORDER_BACKGROUND } from './RendererManager.ts'

export class BackgroundManager {
    private material: THREE.MeshBasicMaterial
    private mesh:     THREE.Mesh

    constructor (scene: THREE.Scene) {
        /* background quad — DoubleSide so negative-x-scale (H-flip) still renders */
        this.material = new THREE.MeshBasicMaterial({
            transparent: true,
            depthTest:   false,
            side:        THREE.DoubleSide
        })
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material)
        this.mesh.renderOrder = RENDER_ORDER_BACKGROUND
        this.mesh.visible = false
        scene.add(this.mesh)
    }

    public draw (texture: THREE.Texture, x: number, y: number, w: number, h: number, flipH: boolean): void {
        this.material.map = texture
        this.material.needsUpdate = true
        this.mesh.position.set(x + w * 0.5, y + h * 0.5, 0)
        this.mesh.scale.set(flipH ? -w : w, h, 1)
        this.mesh.visible = true
    }
}

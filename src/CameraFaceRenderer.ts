import * as THREE from 'three'
import type { RendererManager } from './RendererManager.ts'
import { RENDER_ORDER_FACE } from './RendererManager.ts'
import type { SizeRegion } from './Utils.ts'
import faceTris from './assets/face_mesh_tris.json'

const LANDMARK_COUNT = 468

export class CameraFaceRenderer {
    private positionAttr: THREE.BufferAttribute
    private uvAttr:       THREE.BufferAttribute
    private material:     THREE.MeshBasicMaterial
    private mesh:         THREE.Mesh

    constructor (renderer: RendererManager) {
        this.positionAttr = new THREE.BufferAttribute(new Float32Array(LANDMARK_COUNT * 3), 3)
        this.uvAttr       = new THREE.BufferAttribute(new Float32Array(LANDMARK_COUNT * 2), 2)
        this.positionAttr.usage = THREE.DynamicDrawUsage
        this.uvAttr.usage       = THREE.DynamicDrawUsage

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', this.positionAttr)
        geometry.setAttribute('uv',       this.uvAttr)
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(faceTris), 1))

        this.material = new THREE.MeshBasicMaterial({
            transparent: true,
            depthTest:   false,
            side:        THREE.DoubleSide,
        })

        this.mesh = new THREE.Mesh(geometry, this.material)
        this.mesh.renderOrder = RENDER_ORDER_FACE
        this.mesh.visible = false
        renderer.add(this.mesh)
    }

    public draw (
        faceLandmarks: FaceLandmark[],
        sourceWidth:   number,
        sourceHeight:  number,
        region:        SizeRegion,
        texture:       THREE.VideoTexture
    ): void {
        const { scale, offsetX, offsetY } = region

        for (let i = 0; i < LANDMARK_COUNT; i++) {
            const lm = faceLandmarks[i]!
            this.positionAttr.setXYZ(
                i,
                (sourceWidth - lm[0]) * scale + offsetX,
                lm[1] * scale + offsetY,
                0
            )
            this.uvAttr.setXY(i, lm[0] / sourceWidth, lm[1] / sourceHeight)
        }
        this.positionAttr.needsUpdate = true
        this.uvAttr.needsUpdate       = true

        if (this.material.map !== texture) {
            this.material.map = texture
            this.material.needsUpdate = true
        }
        this.mesh.visible = true
    }

    public hide (): void {
        this.mesh.visible = false
    }
}

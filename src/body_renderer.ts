import * as THREE from 'three'
import type { Scene2D } from './scene2d.ts'
import { RENDER_ORDER_BODY } from './scene2d.ts'
import type { SizeRegion } from './utils.ts'

const IDX_CHIN  = 152
const IDX_TOP   = 10
const IDX_L_EAR = 234
const IDX_R_EAR = 454

/* Skip body repositioning when chin moves less than this many pixels */
const MOVE_THRESHOLD = 8

export class BodyRenderer
{
    private material:        THREE.MeshBasicMaterial
    private mesh:       THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
    private ready       = false
    private prevChinX   = -9999
    private prevChinY   = -9999

    public constructor (url: string, scene2d: Scene2D){
        this.material  = new THREE.MeshBasicMaterial({
            transparent: true,
            depthTest: false,
            side: THREE.DoubleSide,
            alphaTest: 0.01
        })

        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material)
        this.mesh.renderOrder = RENDER_ORDER_BODY
        this.mesh.visible     = false
        scene2d.add(this.mesh)

        new THREE.TextureLoader()
        .load(url, tex => {
            tex.flipY            = false
            this.material.map         = tex
            this.material.needsUpdate = true
            this.ready           = true
        })
    }

    public reset (): void { 
        this.mesh.visible = false 
    }

    public draw (landmarks: FaceLandmark[], sourceWidth: number, region: SizeRegion): void{
        if (!this.ready){
            return
        }
        const { scale, offsetX, offsetY } = region

        const chin    = landmarks[IDX_CHIN]!
        const top     = landmarks[IDX_TOP]!
        const leftEar = landmarks[IDX_L_EAR]!
        const rightEar = landmarks[IDX_R_EAR]!

        const chinScreenX = (sourceWidth - chin[0]) * scale + offsetX
        const chinScreenY = chin[1] * scale + offsetY

        /* skip update when face hasn't moved much — keeps body stable */
        if (Math.hypot(chinScreenX - this.prevChinX, chinScreenY - this.prevChinY) < MOVE_THRESHOLD && this.mesh.visible) return
        this.prevChinX = chinScreenX
        this.prevChinY = chinScreenY

        const faceWidthPx  = Math.abs(rightEar[0] - leftEar[0]) * scale
        const faceHeightPx = (chin[1] - top[1]) * scale

        const bodyWidth   = faceWidthPx * 2.0
        const bodyHeight  = faceHeightPx * 2.5
        const bodyCenterY = chinScreenY + faceHeightPx * 0.3 + bodyHeight * 0.5

        this.mesh.position.set(chinScreenX, bodyCenterY, 0)
        this.mesh.scale.set(bodyWidth, bodyHeight, 1)
        this.mesh.visible = true
    }
}

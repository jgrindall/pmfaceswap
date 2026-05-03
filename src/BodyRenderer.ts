import * as THREE from 'three'
import type { RendererManager } from './RendererManager.ts'
import { RENDER_ORDER_BODY } from './RendererManager.ts'
import type { SizeRegion } from './Utils.ts'
import gsap from 'gsap';

const IDX_CHIN  = 152
const IDX_TOP   = 10
const IDX_L_EAR = 234
const IDX_R_EAR = 454

/* Skip body repositioning when chin moves less than this many pixels */
const MOVE_THRESHOLD = 8

const BODY_WIDTH_RELATIVE_TO_HEAD = 6;
const BODY_HEIGHT_RELATIVE_TO_HEAD = 9;
const BODY_OFFSET_Y_RELATIVE_TO_HEAD = -1.33;
const BODY_OFFSET_X_RELATIVE_TO_HEAD = -0.333;

export class BodyRenderer {
    private material: THREE.MeshBasicMaterial
    private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
    private ready       = false
    private prevChinX   = -9999
    private prevChinY   = -9999

    public constructor (private renderer: RendererManager){
        this.material  = new THREE.MeshBasicMaterial({
            transparent: true,
            depthTest: false,
            side: THREE.DoubleSide,
            alphaTest: 0.01
        })

        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material)
        this.mesh.renderOrder = RENDER_ORDER_BODY
        this.renderer.add(this.mesh)
    }

    public load(url: string){
        const onLoad = (texture: THREE.Texture) => {
            texture.flipY = false
            this.material.map = texture
            this.material.needsUpdate = true
            this.ready = true
        }
        new THREE.TextureLoader().load(url, onLoad)
    }

    private lerpTo(){

    }

    public draw (landmarks: FaceLandmark[], sourceWidth: number, region: SizeRegion): void{
        if (!this.ready){
            return
        }
        const {
            scale,
            offsetX,
            offsetY
        } = region

        const chin    = landmarks[IDX_CHIN]!
        const top     = landmarks[IDX_TOP]!
        const leftEar = landmarks[IDX_L_EAR]!
        const rightEar = landmarks[IDX_R_EAR]!

        const chinScreenX = (sourceWidth - chin[0]) * scale + offsetX
        const chinScreenY = chin[1] * scale + offsetY

        /* skip update when face hasn't moved much — keeps body stable */
        if (Math.hypot(chinScreenX - this.prevChinX, chinScreenY - this.prevChinY) < MOVE_THRESHOLD && this.mesh.visible){
            return
        }       

        this.prevChinX = chinScreenX
        this.prevChinY = chinScreenY

        const faceWidthPx  = Math.abs(rightEar[0] - leftEar[0]) * scale
        const faceHeightPx = (chin[1] - top[1]) * scale

        const bodyWidth   = faceWidthPx * BODY_WIDTH_RELATIVE_TO_HEAD
        const bodyHeight  = faceHeightPx * BODY_HEIGHT_RELATIVE_TO_HEAD
        const bodyCenterY = chinScreenY + faceHeightPx * BODY_OFFSET_Y_RELATIVE_TO_HEAD + bodyHeight * 0.5
        const bodyCenterX = chinScreenX + faceWidthPx * BODY_OFFSET_X_RELATIVE_TO_HEAD

        gsap.to(this.mesh.position, {
            duration: 0.25,
            x: bodyCenterX,
            y: bodyCenterY,
            ease: "power2.out"
        });

        gsap.to(this.mesh.scale, {
            duration: 0.25,
            x: bodyWidth,
            y: bodyHeight,
            ease: "power2.out"
        });

        //this.mesh.position.set(bodyCenterX, bodyCenterY, 0)
        //this.mesh.scale.set(bodyWidth, bodyHeight, 1)
    }
}

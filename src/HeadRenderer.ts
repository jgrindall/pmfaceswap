import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { RendererManager } from './RendererManager.ts'
import { RENDER_ORDER_HAT } from './RendererManager.ts'
import type { SizeRegion } from './Utils.ts'

const IDX_FOREHEAD = 10
const IDX_CHIN     = 152
const IDX_L_EAR    = 234
const IDX_R_EAR    = 454

const SCALE_FACTOR_RELATIVE_TO_FACE = 5.1
const OFFSET_Y_RELATIVE_TO_FACE = 0.425
const OFFSET_X_RELATIVE_TO_FACE = 0
const OFFSET_Z_RELATIVE_TO_FACE = 0.5

export class HeadRenderer{
    private pivot: THREE.Group | undefined
    private normScale  = 1
    
    public constructor (private renderer: RendererManager){
        
    }

    public load(url: string){
        new GLTFLoader().load(url, gltf => {
            const model = gltf.scene

            /* normalise so the longest axis == 1 unit */
            const box    = new THREE.Box3().setFromObject(model)
            const size   = box.getSize(new THREE.Vector3())
            const maxDimension = Math.max(size.x, size.y, size.z)
            this.normScale = 1 / maxDimension

            /* offset model inside a pivot so its bounding-box centre is at the pivot origin.
               Setting pivot.position in draw() then moves the visual centre correctly. */
            const center = box.getCenter(new THREE.Vector3())
            model.position.set(-center.x, -center.y, -center.z)

            this.pivot = new THREE.Group()
            this.pivot.add(model)

            /* renderOrder on the Mesh children (doesn't cascade from Group);
               swap to BasicMaterial so no lights are required */

            model.traverse(obj => {
                if (obj instanceof THREE.Mesh) {
                    obj.renderOrder   = RENDER_ORDER_HAT
                    obj.frustumCulled = false
                    const mats = Array.isArray(obj.material)
                        ? obj.material as THREE.Material[]
                        : [obj.material as THREE.Material]
                    for (const m of mats) {
                        m.depthTest   = false
                        m.transparent = true
                    }
                }
            })

            this.pivot.visible = false
            this.renderer.add(this.pivot)
        })
    }

    public draw (landmarks: FaceLandmark[], sourceWidth: number, region: SizeRegion): void{
        if (!this.pivot){
            return
        }
        const { 
            scale,
            offsetX,
            offsetY
        } = region

        const toScreenX = (lm: FaceLandmark) => {
            return (sourceWidth - lm[0]) * scale + offsetX
        }

        const toScreenY = (lm: FaceLandmark) => {
            return lm[1] * scale + offsetY
        }

        const forehead = landmarks[IDX_FOREHEAD]!
        const chin     = landmarks[IDX_CHIN]!
        const leftEar  = landmarks[IDX_L_EAR]!
        const rightEar = landmarks[IDX_R_EAR]!

        const faceWidthPx = Math.abs(toScreenX(rightEar) - toScreenX(leftEar))
        const hatSizePx   = faceWidthPx * SCALE_FACTOR_RELATIVE_TO_FACE
        const modelScale  = hatSizePx * this.normScale

        /* roll: angle of face-up vector in screen space */
        const upX  = toScreenX(forehead) - toScreenX(chin)
        const upY  = toScreenY(forehead) - toScreenY(chin)
        const roll = Math.atan2(upX, -upY)

        /* yaw: negated because the Y-flip on the pivot inverts the apparent rotation direction */
        const yaw = (rightEar[2] - leftEar[2]) * 0.005

        const posX = toScreenX(forehead) + hatSizePx * OFFSET_X_RELATIVE_TO_FACE
        const posY = toScreenY(forehead) + hatSizePx * OFFSET_Y_RELATIVE_TO_FACE
        const posZ = hatSizePx * OFFSET_Z_RELATIVE_TO_FACE
        this.pivot.position.set(posX, posY, posZ)
        this.pivot.scale.set(modelScale, -modelScale, modelScale)   /* negative Y flips Y-up model into Y-down screen space */
        this.pivot.rotation.set(0, yaw, roll)
        this.pivot.visible = true

    }
}

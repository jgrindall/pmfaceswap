import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Scene2D } from './scene2d.ts'
import { RENDER_ORDER_HAT } from './scene2d.ts'
import type { SizeRegion } from './utils.ts'

const IDX_FOREHEAD = 10
const IDX_CHIN     = 152
const IDX_L_EAR    = 234
const IDX_R_EAR    = 454

export class HatRenderer
{
    private group:     THREE.Group | undefined
    private normScale  = 1

    public constructor (url: string, scene2d: Scene2D)
    {
        new GLTFLoader().load(url, gltf => {
            const model = gltf.scene

            model.traverse(obj => {
                if (obj instanceof THREE.Mesh) {
                    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
                    for (const mat of mats as THREE.Material[]) {
                        (mat as THREE.MeshStandardMaterial).side = THREE.DoubleSide
                    }
                }
            })

            /* normalise so the longest axis == 1 unit, centred at origin */
            const box    = new THREE.Box3().setFromObject(model)
            const size   = box.getSize(new THREE.Vector3())
            this.normScale = 1 / Math.max(size.x, size.y, size.z)
            const center = box.getCenter(new THREE.Vector3())
            model.position.sub(center)

            this.group             = model
            this.group.visible     = false
            this.group.renderOrder = RENDER_ORDER_HAT
            scene2d.add(this.group)
        })
    }

    public reset (): void { if (this.group) this.group.visible = false }

    public draw (landmarks: FaceLandmark[], sourceWidth: number, region: SizeRegion): void
    {
        if (!this.group) return
        const { scale, offsetX, offsetY } = region

        const toScreenX = (lm: FaceLandmark) => (sourceWidth - lm[0]) * scale + offsetX
        const toScreenY = (lm: FaceLandmark) => lm[1] * scale + offsetY

        const forehead = landmarks[IDX_FOREHEAD]!
        const chin     = landmarks[IDX_CHIN]!
        const leftEar  = landmarks[IDX_L_EAR]!
        const rightEar = landmarks[IDX_R_EAR]!

        const faceWidthPx = Math.abs(toScreenX(rightEar) - toScreenX(leftEar))
        const hatSizePx   = faceWidthPx * 1.3
        const modelScale  = hatSizePx * this.normScale

        /* roll: angle of face-up vector in screen space */
        const upX = toScreenX(forehead) - toScreenX(chin)
        const upY = toScreenY(forehead) - toScreenY(chin)
        const roll = Math.atan2(upX, -upY)

        /* yaw: difference in z-depth of ears (mediapipe provides normalised z) */
        const yaw = (leftEar[2] - rightEar[2]) * 0.005

        this.group.position.set(toScreenX(forehead), toScreenY(forehead) - hatSizePx * 0.3, 0)
        this.group.scale.set(modelScale, -modelScale, modelScale)   /* negative Y flips Y-up model into Y-down screen space */
        this.group.rotation.set(0, yaw, roll)
        this.group.visible = true
    }
}

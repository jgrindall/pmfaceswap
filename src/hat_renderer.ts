import * as THREE from 'three'
import type { Scene2D } from './scene2d.ts'
import type { SizeRegion } from './utils.ts'

/* Mediapipe landmark indices */
const IDX_FOREHEAD = 10   /* top-centre of forehead */
const IDX_L_EAR    = 234  /* left ear */
const IDX_R_EAR    = 454  /* right ear */

export class HatRenderer
{
    private mat:   THREE.MeshBasicMaterial
    private mesh:  THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
    private ready  = false

    public constructor (url: string, scene2d: Scene2D)
    {
        this.mat  = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, side: THREE.DoubleSide, alphaTest: 0.01 })
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat)
        this.mesh.renderOrder = 3
        this.mesh.visible     = false
        scene2d.add(this.mesh)

        new THREE.TextureLoader().load(url, tex => {
            tex.flipY        = false
            this.mat.map     = tex
            this.mat.needsUpdate = true
            this.ready       = true
        })
    }

    public reset (): void { this.mesh.visible = false }

    public draw (kp: FaceLandmark[], src_w: number, region: SizeRegion): void
    {
        if (!this.ready) return
        const { scale, tex_x: tx, tex_y: ty } = region

        const top  = kp[IDX_FOREHEAD]!
        const lEar = kp[IDX_L_EAR]!
        const rEar = kp[IDX_R_EAR]!

        const face_w = Math.abs(rEar[0] - lEar[0]) * scale
        const hat_w  = face_w * 1.4
        const hat_h  = hat_w * 0.5   /* assumes roughly 2:1 hat image */

        const cx = (src_w - top[0]) * scale + tx
        const cy = top[1] * scale + ty - hat_h * 0.6  /* sit above forehead */

        this.mesh.position.set(cx, cy, 0)
        this.mesh.scale.set(hat_w, hat_h, 1)
        this.mesh.visible = true
    }
}

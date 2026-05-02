import * as THREE from 'three'
import type { Scene2D } from './scene2d.ts'
import type { SizeRegion } from './utils.ts'

const IDX_CHIN  = 152
const IDX_TOP   = 10
const IDX_L_EAR = 234
const IDX_R_EAR = 454

/* Skip body repositioning when chin moves less than this many pixels */
const MOVE_THRESHOLD = 8

export class BodyRenderer
{
    private mat:    THREE.MeshBasicMaterial
    private mesh:   THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
    private ready   = false
    private prev_cx = -9999
    private prev_cy = -9999

    public constructor (url: string, scene2d: Scene2D)
    {
        this.mat  = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, side: THREE.DoubleSide, alphaTest: 0.01 })
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat)
        this.mesh.renderOrder = 1
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

        const chin = kp[IDX_CHIN]!
        const top  = kp[IDX_TOP]!
        const lEar = kp[IDX_L_EAR]!
        const rEar = kp[IDX_R_EAR]!

        const chin_sx = (src_w - chin[0]) * scale + tx
        const chin_sy = chin[1] * scale + ty

        /* skip update when face hasn't moved much — keeps body stable */
        if (Math.hypot(chin_sx - this.prev_cx, chin_sy - this.prev_cy) < MOVE_THRESHOLD && this.mesh.visible) return
        this.prev_cx = chin_sx
        this.prev_cy = chin_sy

        const face_w_px = Math.abs(rEar[0] - lEar[0]) * scale
        const face_h_px = (chin[1] - top[1]) * scale

        const body_w  = face_w_px * 2.0
        const body_h  = face_h_px * 2.5
        const body_cy = chin_sy + face_h_px * 0.3 + body_h * 0.5

        this.mesh.position.set(chin_sx, body_cy, 0)
        this.mesh.scale.set(body_w, body_h, 1)
        this.mesh.visible = true
    }
}

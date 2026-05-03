import * as THREE from 'three'
import type { RendererManager } from './RendererManager.ts'
import { RENDER_ORDER_FACE } from './RendererManager.ts'
import type { SizeRegion } from './Utils.ts'
import faceTris            from './assets/face_mesh_tris.json'
import faceContourIndices  from './assets/face_contour_idx.json'
import vertexShaderSrc     from './shaders/facemesh.vert?raw'
import fragmentShaderSrc   from './shaders/facemesh.frag?raw'

const LANDMARK_COUNT = 468

export class CameraFaceRenderer {
    private positionAttr: THREE.BufferAttribute
    private uvAttr:       THREE.BufferAttribute
    private mesh:         THREE.Mesh
    private uniforms: {
        u_sampler: THREE.IUniform<THREE.Texture | null>
        u_color:   THREE.IUniform<THREE.Color>
        u_alpha:   THREE.IUniform<number>
    }

    constructor (renderer: RendererManager) {
        this.positionAttr = new THREE.BufferAttribute(new Float32Array(LANDMARK_COUNT * 3), 3)
        this.uvAttr       = new THREE.BufferAttribute(new Float32Array(LANDMARK_COUNT * 2), 2)
        this.positionAttr.usage = THREE.DynamicDrawUsage
        this.uvAttr.usage       = THREE.DynamicDrawUsage

        const edgeAlpha = new Float32Array(LANDMARK_COUNT).fill(1.0)
        for (const i of faceContourIndices as number[]) edgeAlpha[i] = 0.0

        this.uniforms = {
            u_sampler: { value: null },
            u_color:   { value: new THREE.Color(1, 1, 1) },
            u_alpha:   { value: 1.0 },
        }

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', this.positionAttr)
        geometry.setAttribute('uv',       this.uvAttr)
        geometry.setAttribute('vtxalpha', new THREE.BufferAttribute(edgeAlpha, 1))
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(faceTris), 1))

        const material = new THREE.ShaderMaterial({
            glslVersion:    THREE.GLSL3,
            vertexShader:   vertexShaderSrc,
            fragmentShader: fragmentShaderSrc,
            uniforms:       this.uniforms,
            transparent:    true,
            depthTest:      false,
            side:           THREE.DoubleSide,
        })

        this.mesh = new THREE.Mesh(geometry, material)
        this.mesh.renderOrder = RENDER_ORDER_FACE + 0.5
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
            /* screen position: mirrored X so face matches camera display */
            this.positionAttr.setXYZ(
                i,
                (sourceWidth - lm[0]) * scale + offsetX,
                lm[1] * scale + offsetY,
                0
            )
            /* UV: direct camera space — no mirror, no Y-flip (flipY=false on VideoTexture) */
            this.uvAttr.setXY(i, lm[0] / sourceWidth, lm[1] / sourceHeight)
        }
        this.positionAttr.needsUpdate = true
        this.uvAttr.needsUpdate       = true

        this.uniforms.u_sampler.value = texture
        this.mesh.visible = true
    }

    public hide (): void {
        this.mesh.visible = false
    }
}


import * as THREE from 'three'
import type { Scene2D, Color4 } from './scene2d.ts'
import { RENDER_ORDER_FACE } from './scene2d.ts'
import type { SizeRegion } from './utils.ts'
import { landmarkCentroid } from './utils.ts'
import faceTris            from './assets/face_mesh_tris.json'
import faceContourIndices  from './assets/face_contour_idx.json'
import vertexShaderSrc     from './shaders/facemesh.vert?raw'
import fragmentShaderSrc   from './shaders/facemesh.frag?raw'

const LANDMARK_COUNT = 468
const EXPAND_FACTOR  = 1.15 /* scale mesh outward from centroid to cover ears/hairline */

/* Build per-vertex alpha: 1.0 everywhere except the face-contour boundary
   vertices (0.0) so the mask fades out at the edges instead of hard-clipping. */
const makeEdgeAlphaAttr = (count: number, boundaryIndices: number[]): THREE.BufferAttribute => {
    const alpha = new Float32Array(count).fill(1.0)
    for (const i of boundaryIndices) alpha[i] = 0.0
    return new THREE.BufferAttribute(alpha, 1)
}

type ShaderMaterialParams = NonNullable<ConstructorParameters<typeof THREE.ShaderMaterial>[0]>
type Uniforms = ShaderMaterialParams["uniforms"]

interface FaceMeshUniforms {
    u_sampler: THREE.IUniform<THREE.Texture | null>
    u_color:   THREE.IUniform<THREE.Color>
    u_alpha:   THREE.IUniform<number>
}

export class FaceMeshRenderer
{
    private positionAttr:  THREE.BufferAttribute
    private uvAttr:        THREE.BufferAttribute
    private material:      THREE.ShaderMaterial
    private mesh:          THREE.Mesh
    private uniforms: FaceMeshUniforms & Uniforms

    public constructor (scene2d: Scene2D)
    {
        this.positionAttr = new THREE.BufferAttribute(new Float32Array(LANDMARK_COUNT * 3), 3)
        this.uvAttr       = new THREE.BufferAttribute(new Float32Array(LANDMARK_COUNT * 2), 2)
        this.positionAttr.usage = THREE.DynamicDrawUsage
        this.uvAttr.usage       = THREE.DynamicDrawUsage

        this.uniforms = {
            u_sampler: { value: null },
            u_color:   { value: new THREE.Color(1, 1, 1) },
            u_alpha:   { value: 1.0 },
        }

        this.material = new THREE.ShaderMaterial({
            glslVersion:    THREE.GLSL3,
            vertexShader:   vertexShaderSrc,
            fragmentShader: fragmentShaderSrc,
            uniforms:       this.uniforms,
            transparent:    true,
            depthTest:      false,
            side:           THREE.DoubleSide,
        })

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', this.positionAttr)
        geometry.setAttribute('uv',       this.uvAttr)
        geometry.setAttribute('vtxalpha', makeEdgeAlphaAttr(LANDMARK_COUNT, faceContourIndices as number[]))
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(faceTris), 1))

        this.mesh = new THREE.Mesh(geometry, this.material)
        this.mesh.renderOrder = RENDER_ORDER_FACE
        this.reset()
        scene2d.add(this.mesh)
    }

    /** Hides the face mesh — call at the start of each frame before draw(). */
    public reset (): void
    {
        this.mesh.visible = false
    }

    /**
     * Warps the mask texture onto the detected face landmarks.
     *
     * @param faceLandmarks  468 screen-space landmarks from the live camera face
     * @param maskLandmarks  468 image-space landmarks from the mask image face
     * @param sourceWidth    pixel width of the source camera/image frame
     * @param region         scale + canvas offset produced by calc_size_to_fit
     * @param maskImage      the mask source image (used to normalise UV coordinates)
     * @param color          RGBA tint applied to the mask [r, g, b, a]
     * @param maskTexture    GPU texture of the mask image
     */
    public draw (
        faceLandmarks: FaceLandmark[],
        maskLandmarks: FaceLandmark[],
        sourceWidth:   number,
        region:        SizeRegion,
        maskImage:     HTMLImageElement,
        color:         Color4,
        maskTexture:   THREE.Texture
    ): void
    {
        const {
            scale,
            offsetX,
            offsetY 
        } = region

        /* screen-space centroid — used to expand the mesh uniformly outward */
        const { 
            x: centroidX, 
            y: centroidY 
        } = landmarkCentroid(faceLandmarks, sourceWidth, region)

        for (let i = 0; i < LANDMARK_COUNT; i++) {
            /* map source-face landmark → mirrored screen position, expanded from centroid */
            const faceLandmark  = faceLandmarks[i]!
            const screenX = (sourceWidth - faceLandmark[0]) * scale + offsetX
            const screenY = faceLandmark[1] * scale + offsetY
            this.positionAttr.setXYZ(
                i,
                centroidX + (screenX - centroidX) * EXPAND_FACTOR,
                centroidY + (screenY - centroidY) * EXPAND_FACTOR,
                0
            )

            /* UV from matching landmark on the mask image */
            const maskLandmark = maskLandmarks[i]!
            this.uvAttr.setXY(i, maskLandmark[0] / maskImage.width, maskLandmark[1] / maskImage.height)
        }
        this.positionAttr.needsUpdate = true
        this.uvAttr.needsUpdate       = true

        this.uniforms.u_sampler.value = maskTexture
        this.uniforms.u_color.value.setRGB(color[0], color[1], color[2])
        this.uniforms.u_alpha.value   = color[3]

        this.mesh.visible = true
    }
}

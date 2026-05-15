
import * as THREE from 'three'
import type { RendererManager, Color4 } from './RendererManager.ts'
import { RENDER_ORDER_FACE } from './RendererManager.ts'
import type { SizeRegion } from './Utils.ts'
import { landmarkCentroid, fillBufferAttribute } from './Utils.ts'
import faceTris            from './assets/face_mesh_tris.json'
import vertexShaderSrc     from './shaders/facemesh.vert?raw'
import fragmentShaderSrc   from './shaders/facemesh.frag?raw'

const LANDMARK_COUNT = 468
const EXPAND_FACTOR  = 1.15 /* scale mesh outward from centroid to cover ears/hairline */

/* Landmark indices used to size the black face fill */
const IDX_FOREHEAD = 10
const IDX_CHIN     = 152
const IDX_L_EAR    = 234
const IDX_R_EAR    = 454

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
    private faceFill:      THREE.Mesh  /* black oval rendered behind the mask to fill mouth hole */

    public constructor (renderer: RendererManager)
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
        geometry.setAttribute('vtxalpha', fillBufferAttribute(LANDMARK_COUNT, 0.5))
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(faceTris), 1))

        this.mesh = new THREE.Mesh(geometry, this.material)
        this.mesh.renderOrder = RENDER_ORDER_FACE + 0.5
        renderer.add(this.mesh)

        /* black oval sits just below the face mesh layer, filling any holes (e.g. mouth) */
        this.faceFill = new THREE.Mesh(
            new THREE.CircleGeometry(1, 64),
            new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true, 
                depthTest: false
            })
        )
        this.faceFill.renderOrder = RENDER_ORDER_FACE - 0.5
        this.faceFill.visible     = false
        renderer.add(this.faceFill)

        this.mesh.visible = false
    }

    /**
     * Warps the mask texture onto the detected face landmarks.
     *
     * @param faceLandmarks  468 screen-space landmarks from the live camera face
     * @param maskLandmarks  468 image-space landmarks from the mask image face
     * @param sourceWidth    pixel width of the source camera/image frame
     * @param region         scale + canvas offset produced by calculateSizeToFit
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
        const { scale, offsetX, offsetY } = region

        /* screen-space centroid — used to expand the mesh uniformly outward */
        const {
            x: centroidX,
            y: centroidY 
        } = landmarkCentroid(faceLandmarks, sourceWidth, region)

        for (let i = 0; i < LANDMARK_COUNT; i++) {
            /* map source-face landmark → mirrored screen position, expanded from centroid */
            const faceLandmark = faceLandmarks[i]!
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

        /* size the black fill oval to the face bounding box */
        const toSX = (lm: FaceLandmark) => (sourceWidth - lm[0]) * scale + offsetX
        const toSY = (lm: FaceLandmark) => lm[1] * scale + offsetY
        const faceWidthPx  = Math.abs(toSX(faceLandmarks[IDX_R_EAR]!) - toSX(faceLandmarks[IDX_L_EAR]!))
        const faceHeightPx = Math.abs(toSY(faceLandmarks[IDX_CHIN]!)  - toSY(faceLandmarks[IDX_FOREHEAD]!))
        this.faceFill.position.set(centroidX, centroidY, 0)
        this.faceFill.scale.set(faceWidthPx * EXPAND_FACTOR, faceHeightPx * EXPAND_FACTOR, 1)
        this.faceFill.visible = true
    }
}

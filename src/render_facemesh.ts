
import * as THREE from 'three'
import type { Scene2D, Color4 } from './scene2d.ts'
import faceTris      from './assets/face_mesh_tris.json'
import faceContourIdx from './assets/face_contour_idx.json'
import strVS from './shaders/facemesh.vert?raw'
import strFS from './shaders/facemesh.frag?raw'

const LANDMARK_COUNT = 468
const RENDER_ORDER   = 1   /* between background (0) and overlay (2+) */

const makeAlphaAttr = (len: number, indices:number[]): THREE.BufferAttribute => {
    const alpha = new Float32Array(len).fill(1.0)
    for (const i of indices){
        alpha[i] = 0.0
    }
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
    private posAttr:        THREE.BufferAttribute
    private uvAttr:         THREE.BufferAttribute
    private material:       THREE.ShaderMaterial
    private mesh:           THREE.Mesh
    private uniforms: FaceMeshUniforms & Uniforms

    public constructor (scene2d: Scene2D)
    {
        
        this.posAttr = new THREE.BufferAttribute(new Float32Array(LANDMARK_COUNT * 3), 3)
        this.uvAttr  = new THREE.BufferAttribute(new Float32Array(LANDMARK_COUNT * 2), 2)
        this.posAttr.usage = THREE.DynamicDrawUsage
        this.uvAttr.usage  = THREE.DynamicDrawUsage

        this.uniforms = {
            u_sampler: {
                value: null 
            },
            u_color:   { 
                value: new THREE.Color(1, 1, 1) 
            },
            u_alpha:   { 
                value: 1.0 
            },
        }

        this.material = new THREE.ShaderMaterial({
            glslVersion:    THREE.GLSL3,
            vertexShader:   strVS,
            fragmentShader: strFS,
            uniforms:       this.uniforms,
            transparent:    true,
            depthTest:      false,
            side:           THREE.DoubleSide,
        })

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', this.posAttr)
        geometry.setAttribute('uv',       this.uvAttr)
        geometry.setAttribute('vtxalpha', makeAlphaAttr(LANDMARK_COUNT, faceContourIdx as number[]))
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(faceTris), 1))

        this.mesh = new THREE.Mesh(geometry, this.material)
        this.mesh.renderOrder = RENDER_ORDER
        this.reset()
        scene2d.add(this.mesh)
    }

    /** Hides the face mesh — call at the start of each frame before draw(). */
    public reset (): void
    {
        this.mesh.visible = false
    }

    /** Warps the mask texture onto the detected face by uploading landmark positions as vertices and mask UVs. */
    public draw (vtx: number[], uv: number[], color: Color4, maskTexture: THREE.Texture): void
    {
        for (let i = 0; i < LANDMARK_COUNT; i++) {
            this.posAttr.setXYZ(i, vtx[3*i]!, vtx[3*i+1]!, 0)
            this.uvAttr.setXY(i, uv [2*i]!, uv [2*i+1]!)
        }
        this.posAttr.needsUpdate = true
        this.uvAttr.needsUpdate  = true

        this.uniforms.u_sampler.value = maskTexture
        this.uniforms.u_color.value.setRGB(color[0], color[1], color[2])
        this.uniforms.u_alpha.value = color[3]

        this.mesh.visible = true
    }
}


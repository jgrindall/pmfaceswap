
import * as THREE from 'three'
import type { Scene2D, Color4 } from './scene2d.ts'
import faceTris from './assets/face_mesh_tris.json'

const LANDMARK_COUNT = 468
const RENDER_ORDER   = 1   /* between background (0) and overlay (2+) */

const s_face_contour_idx = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172,  58, 132,  93, 234, 127, 162,  21,  54, 103,  67, 109
]

/* vertex shader — Three.js auto-injects: projectionMatrix, modelViewMatrix, position, uv */
const strVS = `
    in float vtxalpha;
    out vec2  v_texcoord;
    out float v_vtxalpha;
    void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, 0.0, 1.0);
        v_texcoord  = uv;
        v_vtxalpha  = vtxalpha;
    }
`

const strFS = `
    uniform vec3      u_color;
    uniform float     u_alpha;
    uniform sampler2D u_sampler;
    in  vec2  v_texcoord;
    in  float v_vtxalpha;
    out vec4  FragColor;
    void main() {
        vec3 color = texture(u_sampler, v_texcoord).rgb * u_color;
        FragColor  = vec4(color, v_vtxalpha * u_alpha);
    }`

function makeAlphaAttr (): THREE.BufferAttribute
{
    const alpha = new Float32Array(LANDMARK_COUNT).fill(1.0)
    for (const i of s_face_contour_idx) alpha[i] = 0.0
    return new THREE.BufferAttribute(alpha, 1)
}

interface FaceMeshUniforms {
    u_sampler: THREE.IUniform<THREE.Texture | null>
    u_color:   THREE.IUniform<THREE.Color>
    u_alpha:   THREE.IUniform<number>
}

export class FaceMeshRenderer
{
    private _posAttr:  THREE.BufferAttribute
    private _uvAttr:   THREE.BufferAttribute
    private _mat:      THREE.ShaderMaterial
    private _mesh:     THREE.Mesh
    private _uniforms: FaceMeshUniforms

    constructor (scene2d: Scene2D)
    {
        const scene = scene2d.scene

        this._posAttr = new THREE.BufferAttribute(new Float32Array(LANDMARK_COUNT * 3), 3)
        this._uvAttr  = new THREE.BufferAttribute(new Float32Array(LANDMARK_COUNT * 2), 2)
        this._posAttr.usage = THREE.DynamicDrawUsage
        this._uvAttr.usage  = THREE.DynamicDrawUsage

        this._uniforms = {
            u_sampler: { value: null },
            u_color:   { value: new THREE.Color(1, 1, 1) },
            u_alpha:   { value: 1.0 },
        }

        this._mat = new THREE.ShaderMaterial({
            glslVersion:    THREE.GLSL3,
            vertexShader:   strVS,
            fragmentShader: strFS,
            uniforms:       this._uniforms,
            transparent:    true,
            depthTest:      false,
            side:           THREE.DoubleSide,
        })

        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', this._posAttr)
        geo.setAttribute('uv',       this._uvAttr)
        geo.setAttribute('vtxalpha', makeAlphaAttr())
        geo.setIndex(new THREE.BufferAttribute(new Uint16Array(faceTris), 1))

        this._mesh = new THREE.Mesh(geo, this._mat)
        this._mesh.renderOrder = RENDER_ORDER
        this.reset()
        scene.add(this._mesh)
    }

    reset (): void
    {
        this._mesh.visible = false
    }

    draw (vtx: number[], uv: number[], color: Color4, masktexture: THREE.Texture): void
    {
        for (let i = 0; i < LANDMARK_COUNT; i++) {
            this._posAttr.setXYZ(i, vtx[3*i]!, vtx[3*i+1]!, 0)
            this._uvAttr.setXY  (i, uv [2*i]!, uv [2*i+1]!)
        }
        this._posAttr.needsUpdate = true
        this._uvAttr.needsUpdate  = true

        this._uniforms.u_sampler.value = masktexture
        this._uniforms.u_color.value.setRGB(color[0], color[1], color[2])
        this._uniforms.u_alpha.value = color[3]

        this._mesh.visible = true
    }
}


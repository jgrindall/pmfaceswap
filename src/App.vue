<template>
  <h1>Mashcams v2</h1>
  <div ref="spinnerEl" id="loading">
    <div class="spinner"></div>
  </div>
  <div style="position: relative; display: inline-block; text-align: center">
    <canvas ref="canvasEl" width="800" height="800" @dragover.prevent>
    </canvas>
    <div id="canvas-overlay">
      <div ref="timingEl" id="timing-info"></div>
    </div>
  </div>
  <h1>&#8593;<br />Drop a face image to change the face mask.</h1>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Stats from 'stats.js'
import { Scene2D, type Color4, type TexObj, type CamTexObj } from './scene2d.ts'
import { FaceMeshRenderer } from './render_facemesh.ts'
import { TextureFactory } from './texture_factory.ts'
import * as THREE from 'three'
import { calc_size_to_fit } from './utils.ts'
import './css/loading1.css'

const MASK_ALPHA = 0.75

let drop_files:        FileList | File[]  = []
let canvas!:           HTMLCanvasElement
let win_w              = 0
let win_h              = 0
let scene2d!:          Scene2D
let faceMesh!:         FaceMeshRenderer
let camtex!:           CamTexObj
let imgtex!:           TexObj
let masktex!:          TexObj
let masktex_next:      TexObj | undefined
let mask_predictions:  FacemeshFace[]     = []
let mask_init_done     = false
let mask_update_req    = false
let stats!:            Stats
let facemesh_ready     = false
let facemesh_model:    FacemeshModel | undefined
let prev_time_ms       = 0

const canvasEl  = ref<HTMLCanvasElement | null>(null)
const timingEl  = ref<HTMLElement | null>(null)
const spinnerEl = ref<HTMLElement | null>(null)

async function render (): Promise<void>
{
    const cur_time_ms = performance.now()
    const interval_ms = cur_time_ms - prev_time_ms
    prev_time_ms      = cur_time_ms

    stats.begin()

    /* resize canvas if needed */
    {
        const display_w = canvas.clientWidth
        const display_h = canvas.clientHeight
        if (canvas.width !== display_w || canvas.height !== display_h) {
            canvas.width  = display_w
            canvas.height = display_h
            scene2d.resize(display_w, display_h)
        }
        win_w = canvas.width
        win_h = canvas.height
    }


    /* --------------------------------------- *
     *  Update Mask (if needed)
     * --------------------------------------- */
    let mask_updated = false
    if (facemesh_ready && facemesh_model)
    {
        if (mask_init_done === false)
        {
            for (let i = 0; i < 5; i++)
                mask_predictions = await facemesh_model.estimateFaces({ input: masktex.image })
            mask_init_done   = true
            scene2d.uploadTexture(masktex)
            mask_updated     = true
        }

        if (drop_files.length > 0) {
            masktex_next    = TextureFactory.fromFile(drop_files[0]!)
            mask_update_req = true
            drop_files      = []
        }

        if (mask_update_req && masktex_next && masktex_next.image.width > 0)
        {
            for (let i = 0; i < 5; i++)
                mask_predictions = await facemesh_model.estimateFaces({ input: masktex_next.image })
            mask_update_req  = false
            masktex          = masktex_next
            scene2d.uploadTexture(masktex)
            mask_updated     = true
        }

        /* reset GL state after TF.js GPU work */
        scene2d.reset()
    }


    /* source texture + face-detection input */
    let src_w:     number               = imgtex.image.width  || 800
    let src_h:     number               = imgtex.image.height || 800
    let srcTex:    THREE.Texture        = imgtex.texture
    let faceInput: HTMLImageElement | HTMLVideoElement = imgtex.image

    if (camtex.ready) {
        camtex.texture.needsUpdate = true
        src_w     = camtex.video.videoWidth
        src_h     = camtex.video.videoHeight
        srcTex    = camtex.texture
        faceInput = camtex.video
    }


    /* --------------------------------------- *
     *  invoke TF.js (Facemesh)
     * --------------------------------------- */
    const srctex_region    = calc_size_to_fit(src_w, src_h, win_w, win_h)
    let face_predictions: FacemeshFace[] = []
    let time_invoke0       = 0

    if (facemesh_ready && facemesh_model) {
        const t0      = performance.now()
        const num_rep = mask_updated ? 2 : 1
        for (let i = 0; i < num_rep; i++)
            face_predictions = await facemesh_model.estimateFaces({ input: faceInput })
        time_invoke0 = performance.now() - t0
    }


    /* --------------------------------------- *
     *  render scene  (single Three.js pass)
     * --------------------------------------- */
    scene2d.clear()
    scene2d.begin()
    faceMesh.reset()

    const { tex_x: tx, tex_y: ty, tex_w: tw, tex_h: th, scale } = srctex_region

    /* background — always flip horizontal */
    scene2d.drawBackground(srcTex, tx, ty, tw, th, true)

    /* face mesh warp */
    const mask_color: Color4 = [1.0, 1.0, 1.0, MASK_ALPHA]

    if (mask_predictions.length > 0)
    {
        const mask_kp = mask_predictions[0]!.scaledMesh

        for (let i = 0; i < face_predictions.length; i++)
        {
            const kp  = face_predictions[i]!.scaledMesh
            const n   = kp.length
            const vtx = new Array<number>(n * 3)
            const uv  = new Array<number>(n * 2)

            for (let j = 0; j < n; j++) {
                const p    = kp[j]!
                vtx[3*j]   = (src_w - p[0]) * scale + tx   /* always flip H */
                vtx[3*j+1] = p[1] * scale + ty
                vtx[3*j+2] = p[2]

                const q   = mask_kp[j]!
                uv[2*j]   = q[0] / masktex.image.width
                uv[2*j+1] = q[1] / masktex.image.height
            }

            faceMesh.draw(vtx, uv, mask_color, masktex.texture)
        }
    }

    scene2d.render()

    timingEl.value!.innerHTML =
        `Interval: ${interval_ms.toFixed(1)} ms<br>TF.js: ${time_invoke0.toFixed(1)} ms`

    stats.end()
    requestAnimationFrame(render)
}

onMounted(async () =>
{
    canvas   = canvasEl.value!
    const gl = canvas.getContext('webgl2')
    if (!gl) {
        alert('Failed to initialize WebGL.')
        return
    }

    canvas.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault()
        if (e.dataTransfer) drop_files = e.dataTransfer.files
    })

    win_w    = canvas.clientWidth
    win_h    = canvas.clientHeight
    scene2d  = new Scene2D(canvas, gl, win_w, win_h)
    faceMesh = new FaceMeshRenderer(scene2d)
    camtex   = TextureFactory.fromCamera()
    imgtex   = TextureFactory.fromUrl('bg.jpg')
    masktex  = TextureFactory.fromUrl('./assets/mask/khamun.jpg')

    stats = new Stats()
    stats.showPanel(0)
    document.body.appendChild(stats.dom)

    const model = await window.faceLandmarksDetection.load(
        window.faceLandmarksDetection.SupportedPackages.mediapipeFacemesh
    )
    facemesh_ready = true
    facemesh_model = model

    spinnerEl.value!.classList.add('loaded')
    prev_time_ms = performance.now()
    void render()
})
</script>


<style scoped>
#canvas-overlay {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  font-family: monospace;
  font-size: 13px;
  color: cyan;
}

#timing-info {
  position: absolute;
  top: 10px; left: 10px;
  line-height: 22px;
  text-shadow: 1px 1px 2px black;
}
</style>

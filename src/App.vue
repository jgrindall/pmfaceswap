<template>
    <h1>
        Mashcams v2
    </h1>
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
    <h1>
        Drop a face image to change the face mask.
    </h1>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Stats from 'stats.js'
import { Scene2D, type Color4, type TexObj, type CamTexObj } from './scene2d.ts'
import { FaceMeshRenderer } from './render_facemesh.ts'
import { TextureFactory } from './texture_factory.ts'
import { calc_size_to_fit } from './utils.ts'
import { MaskManager } from './mask_manager.ts'
import { HatRenderer } from './hat_renderer.ts'
import { BodyRenderer } from './body_renderer.ts'
import './css/loading1.css'

const MASK_ALPHA           = 0.75
const FACE_DETECT_INTERVAL = 2   /* run TF.js every N frames; raise to 3-4 for more speed */

let canvas!:        HTMLCanvasElement
let win_w           = 0
let win_h           = 0
let scene2d!:       Scene2D
let faceMesh!:      FaceMeshRenderer
let hatRend!:       HatRenderer
let bodyRend!:      BodyRenderer
let camtex!:        CamTexObj
let imgtex!:        TexObj
let maskMgr!:       MaskManager
let stats!:         Stats
let facemesh_ready       = false
let facemesh_model:      FacemeshModel | undefined
let face_cache:          FacemeshFace[] = []
let face_frame_count     = 0
let prev_time_ms         = 0

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
    if (facemesh_ready && facemesh_model) {
        mask_updated = await maskMgr.update(facemesh_model)
        scene2d.reset()
    }


    /* source dimensions + face-detection input (camera); bg.jpg used for display */
    let src_w:     number = imgtex.image.width  || 800
    let src_h:     number = imgtex.image.height || 800
    let faceInput: HTMLImageElement | HTMLVideoElement = imgtex.image

    if (camtex.ready) {
        camtex.texture.needsUpdate = true
        src_w     = camtex.video.videoWidth
        src_h     = camtex.video.videoHeight
        faceInput = camtex.video
    }


    /* --------------------------------------- *
     *  invoke TF.js (Facemesh)
     * --------------------------------------- */
    const srctex_region = calc_size_to_fit(src_w, src_h, win_w, win_h)
    let time_invoke0    = 0

    if (facemesh_ready && facemesh_model && (mask_updated || face_frame_count++ % FACE_DETECT_INTERVAL === 0)) {
        const t0      = performance.now()
        const num_rep = mask_updated ? 2 : 1
        for (let i = 0; i < num_rep; i++)
            face_cache = await facemesh_model.estimateFaces({ input: faceInput })
        time_invoke0 = performance.now() - t0
    }


    /* --------------------------------------- *
     *  render scene  (single Three.js pass)
     * --------------------------------------- */
    scene2d.clear()
    scene2d.begin()
    faceMesh.reset()
    bodyRend.reset()
    hatRend.reset()

    /* background — static image, fill canvas */
    scene2d.drawBackground(imgtex.texture, 0, 0, win_w, win_h, false)

    /* body, face warp, hat */
    const mask_color: Color4 = [1.0, 1.0, 1.0, MASK_ALPHA]

    if (face_cache.length > 0 && maskMgr.predictions.length > 0) {
        const kp      = face_cache[0]!.scaledMesh
        const mask_kp = maskMgr.predictions[0]!.scaledMesh
        bodyRend.draw(kp, src_w, srctex_region)
        for (const face of face_cache)
            faceMesh.draw(face.scaledMesh, mask_kp, src_w, srctex_region, maskMgr.image, mask_color, maskMgr.texture)
        hatRend.draw(kp, src_w, srctex_region)
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

    win_w    = canvas.clientWidth
    win_h    = canvas.clientHeight
    scene2d  = new Scene2D(canvas, gl, win_w, win_h)
    faceMesh  = new FaceMeshRenderer(scene2d)
    bodyRend  = new BodyRenderer('./shirt.jpg', scene2d)
    hatRend   = new HatRenderer('./hat.png', scene2d)
    camtex    = TextureFactory.fromCamera()
    imgtex    = TextureFactory.fromUrl('assets/egypt.png')
    maskMgr   = new MaskManager('./assets/mask/einstein.jpg', scene2d)

    canvas.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault()
        if (e.dataTransfer?.files[0]){
            maskMgr.queueDrop(e.dataTransfer.files[0])
        }
    })

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

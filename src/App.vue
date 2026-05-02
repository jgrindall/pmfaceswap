<template>
    <h1>
        Mashcams v2
    </h1>
    <div ref="spinnerEl" id="loading">
        <div class="spinner"></div>
    </div>
    <canvas ref="canvasEl" width="800" height="800" @dragover.prevent>
    </canvas>
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

const MASK_ALPHA           = 1.0
const FACE_DETECT_INTERVAL = 4   /* run TF.js every N frames; raise for more speed */

let canvas!:         HTMLCanvasElement
let canvasWidth      = 0
let canvasHeight     = 0
let scene2d!:        Scene2D
let faceMesh!:       FaceMeshRenderer
let hatRenderer!:    HatRenderer
let bodyRenderer!:   BodyRenderer
let camtex!:         CamTexObj
let imgtex!:         TexObj
let maskMgr!:        MaskManager
let stats!:          Stats
let modelReady       = false
let facemeshModel:   FacemeshModel | undefined
let detectedFaces:   FacemeshFace[] = []
let frameCount       = 0

const canvasEl  = ref<HTMLCanvasElement | null>(null)
const spinnerEl = ref<HTMLElement | null>(null)

async function render (): Promise<void>
{
    stats.begin()

    /* resize canvas if needed */
    {
        const displayW = canvas.clientWidth
        const displayH = canvas.clientHeight
        if (canvas.width !== displayW || canvas.height !== displayH) {
            canvas.width  = displayW
            canvas.height = displayH
            scene2d.resize(displayW, displayH)
        }
        canvasWidth  = canvas.width
        canvasHeight = canvas.height
    }

    /* --------------------------------------- *
     *  Update Mask (if needed)
     * --------------------------------------- */
    let maskUpdated = false
    if (modelReady && facemeshModel) {
        maskUpdated = await maskMgr.update(facemeshModel)
        scene2d.reset()
    }

    /* source dimensions + face-detection input */
    let sourceWidth:  number = imgtex.image.width  || 800
    let sourceHeight: number = imgtex.image.height || 800
    let faceInput: HTMLImageElement | HTMLVideoElement = imgtex.image

    if (camtex.ready) {
        camtex.texture.needsUpdate = true
        sourceWidth  = camtex.video.videoWidth
        sourceHeight = camtex.video.videoHeight
        faceInput    = camtex.video
    }

    /* --------------------------------------- *
     *  Invoke TF.js (Facemesh)
     * --------------------------------------- */
    const sourceRegion = calc_size_to_fit(sourceWidth, sourceHeight, canvasWidth, canvasHeight)

    if (modelReady && facemeshModel && (maskUpdated || frameCount++ % FACE_DETECT_INTERVAL === 0)) {
        const repeatCount = maskUpdated ? 2 : 1
        for (let i = 0; i < repeatCount; i++)
            detectedFaces = await facemeshModel.estimateFaces({ input: faceInput })
    }

    /* --------------------------------------- *
     *  Render scene  (single Three.js pass)
     * --------------------------------------- */
    scene2d.clear()
    scene2d.drawBackground(imgtex.texture, 0, 0, canvasWidth, canvasHeight, false)

    const maskColor: Color4 = [1.0, 1.0, 1.0, MASK_ALPHA]

    if (detectedFaces.length > 0 && maskMgr.predictions.length > 0) {
        const primaryLandmarks = detectedFaces[0]!.scaledMesh
        const maskLandmarks    = maskMgr.predictions[0]!.scaledMesh
        bodyRenderer.draw(primaryLandmarks, sourceWidth, sourceRegion)
        for (const face of detectedFaces)
            faceMesh.draw(face.scaledMesh, maskLandmarks, sourceWidth, sourceRegion, maskMgr.image, maskColor, maskMgr.texture)
        hatRenderer.draw(primaryLandmarks, sourceWidth, sourceRegion)
    }

    scene2d.render()
    stats.end()
    requestAnimationFrame(render)
}

onMounted(async () =>
{
    canvas = canvasEl.value!
    const gl = canvas.getContext('webgl2')
    if (!gl) {
        alert('Failed to initialize WebGL.')
        return
    }

    canvasWidth  = canvas.clientWidth
    canvasHeight = canvas.clientHeight
    scene2d      = new Scene2D(canvas, gl, canvasWidth, canvasHeight)
    faceMesh     = new FaceMeshRenderer(scene2d)
    bodyRenderer = new BodyRenderer('./assets/body/shirt.jpg', scene2d)
    hatRenderer  = new HatRenderer('./assets/head/tut.glb', scene2d)
    camtex       = TextureFactory.fromCamera()
    imgtex       = TextureFactory.fromUrl('assets/egypt.png')
    maskMgr      = new MaskManager('./assets/mask/khamun.jpg', scene2d)

    canvas.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault()
        if (e.dataTransfer?.files[0])
            maskMgr.queueDrop(e.dataTransfer.files[0])
    })

    stats = new Stats()
    stats.showPanel(0)
    document.body.appendChild(stats.dom)

    const model = await window.faceLandmarksDetection.load(
        window.faceLandmarksDetection.SupportedPackages.mediapipeFacemesh
    )
    modelReady    = true
    facemeshModel = model

    spinnerEl.value!.classList.add('loaded')
    void render()
})
</script>

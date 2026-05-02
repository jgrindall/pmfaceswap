<template>
    <h1>
        Mashcams v2
    </h1>
    <canvas ref="canvasEl" width="800" height="800" @dragover.prevent>
    </canvas>
    <h1>
        Drop a face image to change the face mask.
    </h1>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Stats from 'stats.js'
import { Scene2D, type Color4, type TextureObject, type CameraTextureObject } from './scene2d.ts'
import { FaceMeshRenderer } from './render_facemesh.ts'
import { TextureFactory } from './texture_factory.ts'
import { calculateSizeToFit } from './utils.ts'
import { MaskManager } from './mask_manager.ts'
import { HatRenderer } from './hat_renderer.ts'
import { BodyRenderer } from './body_renderer.ts'
import './css/loading1.css'

/* 
run TF.js every N frames. larger N -> better perf
*/
const FACE_DETECT_INTERVAL = 3   

let canvas!:         HTMLCanvasElement
let canvasWidth      = 0
let canvasHeight     = 0
let scene2d!:        Scene2D
let faceMesh!:       FaceMeshRenderer
let hatRenderer!:    HatRenderer
let bodyRenderer!:   BodyRenderer
let cameraTexture!:         CameraTextureObject
let imageTexture!:         TextureObject
let maskManager!:        MaskManager
let stats!:          Stats
let modelReady       = false
let facemeshModel:   FacemeshModel | undefined
let detectedFaces:   FacemeshFace[] = []
let frameCount       = 0

const canvasEl  = ref<HTMLCanvasElement | null>(null)

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
        maskUpdated = await maskManager.update(facemeshModel)
        scene2d.reset()
    }

    /* source dimensions + face-detection input */
    let sourceWidth:  number = imageTexture.image.width  || 800
    let sourceHeight: number = imageTexture.image.height || 800
    let faceInput: HTMLImageElement | HTMLVideoElement = imageTexture.image

    if (cameraTexture.ready) {
        cameraTexture.texture.needsUpdate = true
        sourceWidth  = cameraTexture.video.videoWidth
        sourceHeight = cameraTexture.video.videoHeight
        faceInput    = cameraTexture.video
    }

    /* --------------------------------------- *
     *  Invoke TF.js (Facemesh)
     * --------------------------------------- */
    const sourceRegion = calculateSizeToFit(sourceWidth, sourceHeight, canvasWidth, canvasHeight)

    if (modelReady && facemeshModel && (maskUpdated || frameCount++ % FACE_DETECT_INTERVAL === 0)) {
        const repeatCount = maskUpdated ? 2 : 1
        for (let i = 0; i < repeatCount; i++)
            detectedFaces = await facemeshModel.estimateFaces({ input: faceInput })
    }

    /* --------------------------------------- *
     *  Render scene  (single Three.js pass)
     * --------------------------------------- */
    scene2d.clear()
    scene2d.drawBackground(imageTexture.texture, 0, 0, canvasWidth, canvasHeight, false)

    const maskColor: Color4 = [1, 1, 1, 1]

    if (detectedFaces.length > 0 && maskManager.predictions.length > 0) {
        const primaryLandmarks = detectedFaces[0]!.scaledMesh
        const maskLandmarks    = maskManager.predictions[0]!.scaledMesh
        bodyRenderer.draw(primaryLandmarks, sourceWidth, sourceRegion)
        for (const face of detectedFaces){
            faceMesh.draw(face.scaledMesh, maskLandmarks, sourceWidth, sourceRegion, maskManager.image, maskColor, maskManager.texture)
        }
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
    cameraTexture       = TextureFactory.fromCamera()
    imageTexture       = TextureFactory.fromUrl('assets/bg/egypt.png')
    maskManager      = new MaskManager('./assets/mask/khamun.jpg', scene2d)

    canvas.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault()
        if (e.dataTransfer?.files[0])
            maskManager.queueDrop(e.dataTransfer.files[0])
    })

    stats = new Stats()
    stats.showPanel(0)
    document.body.appendChild(stats.dom)

    const model = await window.faceLandmarksDetection.load(
        window.faceLandmarksDetection.SupportedPackages.mediapipeFacemesh
    )
    modelReady    = true
    facemeshModel = model

    render()
})
</script>

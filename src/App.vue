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
import { RendererManager, type Color4, type TextureObject, type CameraTextureObject } from './RendererManager.ts'
import { FaceMeshRenderer } from './FaceMeshRenderer.ts'
import { TextureFactory } from './TextureFactory.ts'
import { calculateSizeToFit } from './Utils.ts'
import { MaskManager } from './MaskManager.ts'
import { HeadRenderer } from './HeadRenderer.ts'
import { BodyRenderer } from './BodyRenderer.ts'
import './css/loading1.css'

/* 
run TF.js every N frames. larger N -> better perf
*/
const FACE_DETECT_INTERVAL = 3   

let canvas!:         HTMLCanvasElement
let canvasWidth      = 0
let canvasHeight     = 0
let renderer!:       RendererManager
let faceMesh!:       FaceMeshRenderer
let headRenderer!:    HeadRenderer
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

async function render (): Promise<void>{
    stats.begin()

    const displayW = canvas.clientWidth
    const displayH = canvas.clientHeight
    if (canvas.width !== displayW || canvas.height !== displayH) {
        canvas.width  = displayW
        canvas.height = displayH
        renderer.resize(displayW, displayH)
    }
    canvasWidth  = canvas.width
    canvasHeight = canvas.height
    
    
    let maskUpdated = false
    if (modelReady && facemeshModel) {
        maskUpdated = await maskManager.update(facemeshModel)
        renderer.reset()
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
     *  Invoke TF.js
     * --------------------------------------- */
    const sourceRegion = calculateSizeToFit(sourceWidth, sourceHeight, canvasWidth, canvasHeight)

    if (modelReady && facemeshModel && (maskUpdated || frameCount++ % FACE_DETECT_INTERVAL === 0)) {
        const repeatCount = maskUpdated ? 2 : 1
        for (let i = 0; i < repeatCount; i++)
            detectedFaces = await facemeshModel.estimateFaces({ input: faceInput })
    }

    /* --------------------------------------- *
     *  Render
     * --------------------------------------- */
    renderer.clear()
    renderer.drawBackground(imageTexture.texture, 0, 0, canvasWidth, canvasHeight, false)

    const maskColor: Color4 = [1, 1, 1, 1]

    if (detectedFaces.length > 0 && maskManager.predictions.length > 0) {
        const primaryLandmarks = detectedFaces[0]!.scaledMesh
        const maskLandmarks    = maskManager.predictions[0]!.scaledMesh
        bodyRenderer.draw(primaryLandmarks, sourceWidth, sourceRegion)
        for (const face of detectedFaces){
            faceMesh.draw(face.scaledMesh, maskLandmarks, sourceWidth, sourceRegion, maskManager.image, maskColor, maskManager.texture)
        }
        headRenderer.draw(primaryLandmarks, sourceWidth, sourceRegion)
    }

    renderer.render()
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

    renderer      = new RendererManager(canvas, gl, canvasWidth, canvasHeight)
    faceMesh     = new FaceMeshRenderer(renderer)

    bodyRenderer = new BodyRenderer(renderer)
    bodyRenderer.load('./assets/body/shirt.jpg');
    
    headRenderer = new HeadRenderer(renderer);
    headRenderer.load('./assets/head/tut.glb');
    
    cameraTexture = TextureFactory.fromCamera();
    imageTexture = TextureFactory.fromUrl('assets/bg/egypt.png');
    
    maskManager = new MaskManager();
    maskManager.load('./assets/mask/rapunzel.webp');

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

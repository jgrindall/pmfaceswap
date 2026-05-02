import * as THREE from 'three'
import type { TexObj, CamTexObj } from './scene2d.ts'

export class TextureFactory {
    
    /** Load an image from a URL into a texture. Ready flag is set once the image has loaded. */
    public static fromUrl (url: string): TexObj{
        const obj: TexObj = { 
            ready: false,
            image: new Image(),
            texture: new THREE.Texture()
        }
        const onLoad = (texture: THREE.Texture) => {
            texture.flipY       = false
            texture.needsUpdate = true
            obj.image       = texture.image as HTMLImageElement
            obj.ready       = true
        }
        obj.texture = new THREE.TextureLoader().load(url, onLoad)
        obj.texture.flipY = false
        return obj
    }

    /** Load an image from a dropped File into a texture. Ready flag is set once decoded. */
    public static fromFile (file: File): TexObj {
        const texture = new THREE.Texture()
        const obj: TexObj = {
            ready: false,
            image: new Image(),
            texture
        }
        texture.flipY = false

        const reader = new FileReader()
        reader.onload = (e) => {
            const img = obj.image

            img.onload = () => {
                texture.image       = img
                texture.needsUpdate = true
                obj.ready       = true
            }
            img.src = (e.target as FileReader).result as string
        }
        reader.readAsDataURL(file)
        return obj
    }

    /** Open the device camera as a live VideoTexture. Ready flag is set once the stream starts. */
    public static fromCamera (): CamTexObj {
        const video = document.createElement('video')
        video.autoplay = true
        video.muted = true
        video.loop = true
        video.playsInline = true

        const texture   = new THREE.VideoTexture(video)
        texture.flipY   = false

        const obj: CamTexObj = {
            ready: false,
            texture,
            video: video
        }

        if (!navigator.mediaDevices) {
            alert('not supported navigator.mediaDevices')
            return obj
        }

        const options = {
            width: { 
                ideal: 640 
            }, 
            height: { 
                ideal: 480 
            }
        }

        navigator.mediaDevices.getUserMedia({
            audio: false,
            video: options
        })
        .then(stream => {
            video.onloadedmetadata = () => { 
                obj.ready = true 
            }
            video.srcObject = stream
            void video.play()
        })
        .catch(() => alert('failed to initialize a camera'))

        return obj
    }
}

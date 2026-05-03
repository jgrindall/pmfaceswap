import { TextureFactory } from './TextureFactory.ts'
import type { TextureObject } from './RendererManager.ts'

export class MaskManager{

    private maskTextureObj?: TextureObject
    private maskTextureNextObj: TextureObject | undefined
    public predictions: FacemeshFace[] = []
    private initDone     = false
    private updateRequired    = false

    constructor (){
        
    }

    public load(url: string){
        this.maskTextureObj = TextureFactory.fromUrl(url)
    }

    public get texture ():     TextureObject['texture']   { 
        return this.maskTextureObj!.texture
    }
    
    public get image ():       TextureObject['image']     {
        return this.maskTextureObj!.image 
    }

    /** Queue a new mask image from a dropped file. Applied on the next update(). */
    public queueDrop (file: File): void{
        this.maskTextureNextObj = TextureFactory.fromFile(file)
        this.updateRequired   = true
    }

    /** Run face detection on the mask if it has changed. Returns true when TF.js ran on the mask. */
    public async update (model: FacemeshModel): Promise<boolean>{
        let updated = false

        const NUM_ESTIMATION_RUNS = 5

        if (!this.initDone){
            for (let i = 0; i < NUM_ESTIMATION_RUNS; i++){
                this.predictions = await model.estimateFaces({ input: this.maskTextureObj!.image, returnTensors: false, predictIrises: false })
            }
            this.initDone = true
            this.maskTextureObj!.texture.needsUpdate = true
            updated = true
        }

        if (this.updateRequired && this.maskTextureNextObj && this.maskTextureNextObj.image.width > 0){
            for (let i = 0; i < NUM_ESTIMATION_RUNS; i++){
                this.predictions = await model.estimateFaces({ input: this.maskTextureNextObj.image, returnTensors: false, predictIrises: false })
            }
            this.updateRequired = false
            this.maskTextureObj = this.maskTextureNextObj
            this.maskTextureObj.texture.needsUpdate = true
            updated = true
        }

        return updated
    }
}

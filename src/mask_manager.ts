import { TextureFactory } from './texture_factory.ts'
import type { Scene2D, TexObj } from './scene2d.ts'

export class MaskManager{

    private maskTextureObj: TexObj
    private maskTextureNextObj: TexObj | undefined
    public predictions: FacemeshFace[] = []
    private initDone     = false
    private updateRequired    = false
    private scene2d:      Scene2D

    public get texture ():     TexObj['texture']   { 
        return this.maskTextureObj.texture
    }
    
    public get image ():       TexObj['image']     {
        return this.maskTextureObj.image 
    }

    constructor (maskUrl: string, scene2d: Scene2D){
        this.maskTextureObj = TextureFactory.fromUrl(maskUrl)
        this.scene2d = scene2d
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
                this.predictions = await model.estimateFaces({ 
                    input: this.maskTextureObj.image 
                })
            }
            this.initDone = true
            this.scene2d.uploadTexture(this.maskTextureObj)
            updated = true
        }

        if (this.updateRequired && this.maskTextureNextObj && this.maskTextureNextObj.image.width > 0){
            for (let i = 0; i < NUM_ESTIMATION_RUNS; i++){
                this.predictions = await model.estimateFaces({ 
                    input: this.maskTextureNextObj.image 
                })
            }
            this.updateRequired = false
            this.maskTextureObj    = this.maskTextureNextObj
            this.scene2d.uploadTexture(this.maskTextureObj)
            updated = true
        }

        return updated
    }
}

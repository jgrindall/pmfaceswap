export interface SizeRegion {
    width:        number  /* full canvas width */
    height:       number  /* full canvas height */

    offsetX:      number  /* left edge of the image on canvas */
    offsetY:      number  /* top edge of the image on canvas */
    
    displayWidth: number  /* image width after scaling to fit */
    displayHeight: number /* image height after scaling to fit */
    
    scale:        number  /* uniform scale factor applied to source pixels */
}

/** Returns the screen-space centroid of a landmark array, accounting for the
 *  mirrored X axis and the canvas offset/scale from calculateSizeToFit. */
export function landmarkCentroid (landmarks:   FaceLandmark[], sourceWidth: number, region: SizeRegion): { x: number; y: number } {
    const { 
        scale, 
        offsetX, 
        offsetY 
    } = region
    
    let x = 0
    let y = 0

    const count = landmarks.length
    for (const lm of landmarks) {
        x += (sourceWidth - lm[0]) * scale + offsetX
        y += lm[1] * scale + offsetY
    }

    return {
        x: x / count,
        y: y / count 
    }
}

export function calculateSizeToFit (srcWidth: number, srcHeight: number, winWidth: number, winHeight: number): SizeRegion {
    const winAspectRatio     = winWidth / winHeight
    const textureAspectRatio = srcWidth / srcHeight

    let scale: number
    let displayWidth: number
    let displayHeight: number
    let offsetX: number
    let offsetY: number

    if (winAspectRatio > textureAspectRatio) {
        scale         = winHeight / srcHeight
        displayWidth  = scale * srcWidth
        displayHeight = scale * srcHeight
        offsetX       = (winWidth - displayWidth) / 2
        offsetY       = 0
    }
    else {
        scale         = winWidth / srcWidth
        displayWidth  = scale * srcWidth
        displayHeight = scale * srcHeight
        offsetX       = 0
        offsetY       = (winHeight - displayHeight) / 2
    }

    return {
        width:         winWidth,
        height:        winHeight,
        offsetX,
        offsetY,
        displayWidth,
        displayHeight,
        scale,
    }
}

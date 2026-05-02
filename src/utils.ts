export interface SizeRegion {
    width:  number;  
    height: number
    tex_x:  number;  
    tex_y:  number
    tex_w:  number; 
    tex_h:  number
    scale:  number
}

export function calc_size_to_fit (srcWidth: number, srcHeight: number, winWidth: number, winHeight: number): SizeRegion {
    const winAspectRatio = winWidth / winHeight
    const textureAspectRatio = srcWidth / srcHeight

    let scale: number
    let width: number
    let height: number
    let offsetX: number
    let offsetY: number

    if (winAspectRatio > textureAspectRatio) {
        scale    = winHeight / srcHeight
        width = scale * srcWidth
        height = scale * srcHeight
        offsetX = (winWidth - width) * 0.5
        offsetY = 0
    }
    else {
        scale    = winWidth / srcWidth
        width = scale * srcWidth
        height = scale * srcHeight
        offsetX = 0
        offsetY = (winHeight - height) * 0.5
    }

    return {
        width  : winWidth,
        height : winHeight,
        tex_x  : offsetX,
        tex_y  : offsetY,
        tex_w  : width,
        tex_h  : height,
        scale  : scale,
    }
}

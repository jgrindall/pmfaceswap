export interface SizeRegion {
    width:  number;  height: number
    tex_x:  number;  tex_y:  number
    tex_w:  number;  tex_h:  number
    scale:  number
}

export function calc_size_to_fit (src_w: number, src_h: number, win_w: number, win_h: number): SizeRegion
{
    const win_aspect = win_w / win_h
    const tex_aspect = src_w / src_h
    let scale: number, scaled_w: number, scaled_h: number, offset_x: number, offset_y: number

    if (win_aspect > tex_aspect) {
        scale    = win_h / src_h
        scaled_w = scale * src_w
        scaled_h = scale * src_h
        offset_x = (win_w - scaled_w) * 0.5
        offset_y = 0
    } else {
        scale    = win_w / src_w
        scaled_w = scale * src_w
        scaled_h = scale * src_h
        offset_x = 0
        offset_y = (win_h - scaled_h) * 0.5
    }

    return {
        width  : win_w,    height : win_h,
        tex_x  : offset_x, tex_y  : offset_y,
        tex_w  : scaled_w, tex_h  : scaled_h,
        scale  : scale,
    }
}

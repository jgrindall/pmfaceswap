
import Stats from 'stats.js'
import { Scene2D, type Color4 } from './scene2d.ts'
import { FaceMeshRenderer } from './render_facemesh.ts'

const MASK_ALPHA   = 0.75
const SRCIMG_SCALE = 2

let s_timing_info: HTMLElement
let s_status_msg:  HTMLElement

let s_is_dragover = false
let s_drop_files: FileList | File[] = []


interface SizeRegion {
    width:  number;  height: number
    tex_x:  number;  tex_y:  number
    tex_w:  number;  tex_h:  number
    scale:  number
}

function init_stats (): Stats
{
    const stats = new Stats()
    stats.showPanel(0)
    document.body.appendChild(stats.dom)
    return stats
}


function calc_size_to_fit (src_w: number, src_h: number, win_w: number, win_h: number): SizeRegion
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
        tex_w  : scaled_w,  tex_h  : scaled_h,
        scale  : scale,
    }
}


function on_dragover (event: DragEvent):  void { event.preventDefault(); s_is_dragover = true }
function on_dragleave (event: DragEvent): void { event.preventDefault(); s_is_dragover = false }
function on_drop (event: DragEvent):      void
{
    event.preventDefault()
    s_is_dragover = false
    if (event.dataTransfer) s_drop_files = event.dataTransfer.files
}


/* ---------------------------------------------------------------- *
 *      M A I N    F U N C T I O N
 * ---------------------------------------------------------------- */
export function startWebGL (): void
{
    let current_phase = 0

    const canvas = document.querySelector<HTMLCanvasElement>('#glcanvas')!
    const gl     = canvas.getContext('webgl2')
    if (!gl) {
        alert('Failed to initialize WebGL.')
        return
    }

    canvas.addEventListener('dragover',  on_dragover)
    canvas.addEventListener('dragleave', on_dragleave)
    canvas.addEventListener('drop',      on_drop)

    let win_w = canvas.clientWidth
    let win_h = canvas.clientHeight

    const scene2d  = new Scene2D(canvas, gl, win_w, win_h)
    const faceMesh = new FaceMeshRenderer(scene2d)

    const camtex  = Scene2D.createCameraTexture()
    const imgtex  = Scene2D.createImageTexture('pakutaso_sotsugyou.jpg')
    let   masktex = Scene2D.createImageTexture('./assets/mask/khamun.jpg')
    let   masktex_next: ReturnType<typeof Scene2D.createImageTexture> | undefined
    let   mask_predictions: FacemeshFace[] = []
    let   mask_init_done   = false
    let   mask_update_req  = false
    let   s_masktex_region!: SizeRegion

    s_timing_info = document.getElementById('timing-info')!
    s_status_msg  = document.getElementById('status-msg')!
    const stats   = init_stats()


    /* --------------------------------- *
     *  load FACEMESH
     * --------------------------------- */
    window.faceLandmarksDetection.load(
        window.faceLandmarksDetection.SupportedPackages.mediapipeFacemesh
    ).then(model => {
        current_phase  = 1
        facemesh_ready = true
        facemesh_model = model
    }).catch(() => {
        alert('failed to load facemesh model')
    })

    let facemesh_ready = false
    let facemesh_model: FacemeshModel | undefined

    /* stop loading spinner */
    const spinner = document.getElementById('loading')!
    spinner.classList.add('loaded')

    let prev_time_ms   = performance.now()
    let s_showme_count = 0

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
        if (facemesh_ready && facemesh_model)
        {
            if (mask_init_done === false)
            {
                for (let i = 0; i < 5; i++)
                    mask_predictions = await facemesh_model.estimateFaces({ input: masktex.image })
                mask_init_done   = true
                scene2d.uploadTexture(masktex)
                s_masktex_region = calc_size_to_fit(masktex.image.width, masktex.image.height, 150, 150)
                mask_updated     = true
            }

            if (s_drop_files.length > 0) {
                masktex_next    = Scene2D.createImageTextureFromFile(s_drop_files[0]!)
                mask_update_req = true
                s_drop_files    = []
            }

            if (mask_update_req && masktex_next && masktex_next.image.width > 0)
            {
                for (let i = 0; i < 5; i++)
                    mask_predictions = await facemesh_model.estimateFaces({ input: masktex_next.image })
                mask_update_req  = false
                masktex          = masktex_next
                scene2d.uploadTexture(masktex)
                s_masktex_region = calc_size_to_fit(masktex.image.width, masktex.image.height, 150, 150)
                mask_updated     = true
            }

            /* reset GL state after TF.js GPU work */
            scene2d.renderer.resetState()
        }


        /* source texture + face-detection input */
        let src_w:     number               = imgtex.image.width  || 800
        let src_h:     number               = imgtex.image.height || 800
        let srcTex:    THREE.Texture        = imgtex.texture
        let faceInput: HTMLImageElement | HTMLVideoElement = imgtex.image

        if (camtex.ready) {
            camtex.texture.needsUpdate = true
            src_w     = camtex.video.videoWidth
            src_h     = camtex.video.videoHeight
            srcTex    = camtex.texture
            faceInput = camtex.video
        }


        /* --------------------------------------- *
         *  invoke TF.js (Facemesh)
         * --------------------------------------- */
        const srctex_region     = calc_size_to_fit(src_w, src_h, win_w, win_h)
        let face_predictions: FacemeshFace[] = []
        let time_invoke0        = 0

        if (facemesh_ready && facemesh_model) {
            const t0       = performance.now()
            const num_rep  = mask_updated ? 2 : 1
            for (let i = 0; i < num_rep; i++)
                face_predictions = await facemesh_model.estimateFaces({ input: faceInput })
            time_invoke0 = performance.now() - t0
        }


        /* --------------------------------------- *
         *  render scene  (single Three.js pass)
         * --------------------------------------- */
        scene2d.clear()
        scene2d.begin()
        faceMesh.reset()

        const { tex_x: tx, tex_y: ty, tex_w: tw, tex_h: th, scale } = srctex_region

        /* background — always flip horizontal */
        scene2d.drawBackground(srcTex, tx, ty, tw, th, true)

        /* face mesh warp */
        const mask_color: Color4 = s_is_dragover
            ? [0.8, 0.8, 0.8, 1.0]
            : [1.0, 1.0, 1.0, MASK_ALPHA]

        if (mask_predictions.length > 0)
        {
            const mask_kp = mask_predictions[0]!.scaledMesh

            for (let i = 0; i < face_predictions.length; i++)
            {
                const kp  = face_predictions[i]!.scaledMesh
                const n   = kp.length
                const vtx = new Array<number>(n * 3)
                const uv  = new Array<number>(n * 2)

                for (let j = 0; j < n; j++) {
                    const p    = kp[j]!
                    vtx[3*j]   = (src_w - p[0]) * scale + tx   /* always flip H */
                    vtx[3*j+1] = p[1] * scale + ty
                    vtx[3*j+2] = p[2]

                    const q   = mask_kp[j]!
                    uv[2*j]   = q[0] / masktex.image.width
                    uv[2*j+1] = q[1] / masktex.image.height
                }

                faceMesh.draw(vtx, uv, mask_color, masktex.texture)
            }
        }

        /* mask image thumbnail + landmark dots */
        if (mask_predictions.length > 0)
        {
            const ptx = 5, pty = 60
            const ptw = s_masktex_region.tex_w * SRCIMG_SCALE
            const pth = s_masktex_region.tex_h * SRCIMG_SCALE

            scene2d.drawPreview(masktex.texture, ptx, pty, ptw, pth)
            scene2d.drawBorderRect(ptx, pty, ptw, pth, [1.0, 1.0, 1.0, 1.0])

            const mk   = mask_predictions[0]!.scaledMesh
            const dots = mk.map((p): [number, number] => [
                p[0] / masktex.image.width  * ptw + ptx,
                p[1] / masktex.image.height * pth + pty,
            ])
            scene2d.drawDots(dots, [0.0, 1.0, 1.0, 0.5], 2)
        }

        /* progress bar */
        if (face_predictions.length > 0) {
            s_showme_count = 30
            s_status_msg.textContent = ''
        } else if (current_phase >= 2 && s_showme_count > 0) {
            s_showme_count--
        } else {
            const bx = win_w * 0.25,  by = win_h * 0.5 - 50
            const bw = win_w * 0.5,   bh = 100
            const wp = (bw / 2) * current_phase

            scene2d.drawFillRect(bx, by, bw, bh, [0.0, 0.4, 0.4, 0.2])
            scene2d.drawFillRect(bx, by, wp, bh, [0.0, 0.4, 0.4, 0.5])
            scene2d.drawBorderRect(bx, by, bw, bh, [0.0, 1.0, 1.0, 0.8])

            s_status_msg.textContent = current_phase < 2
                ? `Initializing[${current_phase}/2]... Please wait a minute.`
                : 'show me your face'
        }

        scene2d.render()


        /* --------------------------------------- *
         *  post process
         * --------------------------------------- */
        s_timing_info.innerHTML =
            `Interval: ${interval_ms.toFixed(1)} ms<br>TF.js: ${time_invoke0.toFixed(1)} ms`

        stats.end()
        requestAnimationFrame(render)
    }
    void render()
}

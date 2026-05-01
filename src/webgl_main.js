/* ------------------------------------------------ *
 * The MIT License (MIT)
 * Copyright (c) 2020 terryky1220@gmail.com
 * ------------------------------------------------ */
import Stats from 'stats.js';
import * as dat from 'dat.gui';
import {
    initScene2D, resizeScene2D, clearFrame,
    createImageTexture, createImageTextureFromFile, createCameraTexture,
    uploadTexture, getRawTexture,
    beginFrame, drawBackground, drawPreview, drawFillRect, drawBorderRect, drawDots,
    renderScene2D, resetGLState
} from './scene2d.js';
import { init_facemesh_render, draw_facemesh_tri_tex, resize_facemesh_render } from './render_facemesh.js';

let s_timing_info;
let s_status_msg;

let s_debug_log;
let s_is_dragover = false;
let s_drop_files  = [];

class GuiProperty {
    constructor() {
        this.srcimg_scale    = 1.0;
        this.mask_alpha      = 0.7;
        this.flip_horizontal = true;
        this.mask_eye_hole   = false;
    }
}
const s_gui_prop = new GuiProperty();

let s_srctex_region;
let s_masktex_region;


function init_stats ()
{
    var stats  = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
    return stats;
}


/* Adjust the texture size to fit the window size */
function calc_size_to_fit (gl, src_w, src_h, win_w, win_h)
{
    let win_aspect = win_w / win_h;
    let tex_aspect = src_w / src_h;
    let scale;
    let scaled_w, scaled_h;
    let offset_x, offset_y;

    if (win_aspect > tex_aspect) {
        scale    = win_h / src_h;
        scaled_w = scale * src_w;
        scaled_h = scale * src_h;
        offset_x = (win_w - scaled_w) * 0.5;
        offset_y = 0;
    } else {
        scale    = win_w / src_w;
        scaled_w = scale * src_w;
        scaled_h = scale * src_h;
        offset_x = 0;
        offset_y = (win_h - scaled_h) * 0.5;
    }

    return {
        width  : win_w,
        height : win_h,
        tex_x  : offset_x,
        tex_y  : offset_y,
        tex_w  : scaled_w,
        tex_h  : scaled_h,
        scale  : scale,
    };
}


function init_gui ()
{
    const gui = new dat.GUI();
    gui.add(s_gui_prop, 'srcimg_scale', 0, 5.0);
    gui.add(s_gui_prop, 'mask_alpha', 0.0, 1.0);
    gui.add(s_gui_prop, 'flip_horizontal');
    gui.add(s_gui_prop, 'mask_eye_hole');
}


/* ---------------------------------------------------------------- *
 *  Drag and Drop Event
 * ---------------------------------------------------------------- */
function on_dragover (event)  { event.preventDefault(); s_is_dragover = true; }
function on_dragleave (event) { event.preventDefault(); s_is_dragover = false; }
function on_drop (event)      { event.preventDefault(); s_is_dragover = false; s_drop_files = event.dataTransfer.files; }


/* ---------------------------------------------------------------- *
 *      M A I N    F U N C T I O N
 * ---------------------------------------------------------------- */
export function startWebGL()
{
    s_debug_log = document.getElementById('debug_log');
    let current_phase = 0;

    const canvas = document.querySelector('#glcanvas');
    const gl     = canvas.getContext('webgl2');
    if (!gl) {
        alert('Failed to initialize WebGL.');
        return;
    }

    gl.clearColor(0.7, 0.7, 0.7, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    canvas.addEventListener('dragover',  on_dragover);
    canvas.addEventListener('dragleave', on_dragleave);
    canvas.addEventListener('drop',      on_drop);

    init_gui();

    const camtex  = createCameraTexture();
    const imgtex  = createImageTexture('pakutaso_sotsugyou.jpg');
    let   masktex = createImageTexture('./assets/mask/khamun.jpg');
    let   masktex_next;
    let   mask_predictions = { length: 0 };
    let   mask_init_done   = false;
    let   mask_update_req  = false;

    let win_w = canvas.clientWidth;
    let win_h = canvas.clientHeight;

    initScene2D(canvas, gl, win_w, win_h);
    init_facemesh_render(gl, win_w, win_h);

    s_timing_info = document.getElementById('timing-info');
    s_status_msg  = document.getElementById('status-msg');
    const stats   = init_stats();


    /* --------------------------------- *
     *  load FACEMESH
     * --------------------------------- */
    let facemesh_ready = false;
    let facemesh_model;
    {
        window.faceLandmarksDetection.load(
            window.faceLandmarksDetection.SupportedPackages.mediapipeFacemesh
        ).then(model => {
            facemesh_ready = true;
            facemesh_model = model;
        }).catch(() => {
            alert('failed to load facemesh model');
        });
    }

    current_phase = 1;

    /* stop loading spinner */
    const spinner = document.getElementById('loading');
    spinner.classList.add('loaded');

    let prev_time_ms = performance.now();
    let s_showme_count = 0;

    async function render (now)
    {
        s_debug_log.innerHTML = 'tfjs.Backend = ' + window.tf.getBackend() + '<br>';

        let cur_time_ms  = performance.now();
        let interval_ms  = cur_time_ms - prev_time_ms;
        prev_time_ms     = cur_time_ms;

        stats.begin();

        /* resize canvas if needed */
        {
            let display_w = canvas.clientWidth;
            let display_h = canvas.clientHeight;
            if (canvas.width !== display_w || canvas.height !== display_h) {
                canvas.width  = display_w;
                canvas.height = display_h;
                gl.viewport(0, 0, display_w, display_h);
                resizeScene2D(display_w, display_h);
                resize_facemesh_render(gl, display_w, display_h);
            }
            win_w = canvas.width;
            win_h = canvas.height;
        }


        /* --------------------------------------- *
         *  Update Mask (if needed)
         * --------------------------------------- */
        let mask_updated = false;
        if (facemesh_ready)
        {
            if (mask_init_done === false)
            {
                for (let i = 0; i < 5; i++)
                    mask_predictions = await facemesh_model.estimateFaces({ input: masktex.image });
                mask_init_done    = true;
                uploadTexture(masktex);
                s_masktex_region  = calc_size_to_fit(gl, masktex.image.width, masktex.image.height, 150, 150);
                mask_updated      = true;
            }

            if (s_drop_files.length > 0) {
                masktex_next     = createImageTextureFromFile(s_drop_files[0]);
                mask_update_req  = true;
                s_drop_files     = [];
            }

            if (mask_update_req && masktex_next.image.width > 0)
            {
                for (let i = 0; i < 5; i++)
                    mask_predictions = await facemesh_model.estimateFaces({ input: masktex_next.image });
                mask_update_req  = false;
                masktex          = masktex_next;
                uploadTexture(masktex);
                s_masktex_region = calc_size_to_fit(gl, masktex.image.width, masktex.image.height, 150, 150);
                mask_updated     = true;
            }

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, win_w, win_h);
            gl.scissor (0, 0, win_w, win_h);
        }


        /* source texture + face-detection input */
        let src_w     = imgtex.image.width  || 800;
        let src_h     = imgtex.image.height || 800;
        let srcTex    = imgtex.texture;
        let faceInput = imgtex.image;

        if (camtex.ready) {
            camtex.texture.needsUpdate = true;
            src_w     = camtex.video.videoWidth;
            src_h     = camtex.video.videoHeight;
            srcTex    = camtex.texture;
            faceInput = camtex.video;
        }


        /* --------------------------------------- *
         *  invoke TF.js (Facemesh)
         * --------------------------------------- */
        s_srctex_region      = calc_size_to_fit(gl, src_w, src_h, win_w, win_h);
        let face_predictions = { length: 0 };
        let time_invoke0     = 0;

        if (facemesh_ready) {
            current_phase = 2;
            let t0        = performance.now();
            let num_repeat = mask_updated ? 2 : 1;
            for (let i = 0; i < num_repeat; i++)
                face_predictions = await facemesh_model.estimateFaces({ input: faceInput });
            time_invoke0 = performance.now() - t0;
        }


        /* --------------------------------------- *
         *  render scene
         * --------------------------------------- */
        clearFrame();

        /* --- Pass 1 : background texture --- */
        let flip_h = s_gui_prop.flip_horizontal;
        let { tex_x: tx, tex_y: ty, tex_w: tw, tex_h: th, scale } = s_srctex_region;

        beginFrame();
        drawBackground(srcTex, tx, ty, tw, th, flip_h);
        renderScene2D();
        resetGLState();


        /* --- raw WebGL : face-mesh warp --- */
        gl.disable(gl.DEPTH_TEST);

        let mask_color = [1.0, 1.0, 1.0, s_gui_prop.mask_alpha];
        if (s_is_dragover) mask_color = [0.8, 0.8, 0.8, 1.0];

        if (mask_predictions.length > 0)
        {
            const mask_keypoints = mask_predictions[0].scaledMesh;
            const rawTex         = getRawTexture(masktex.texture);
            const eye_hole       = s_gui_prop.mask_eye_hole;

            for (let i = 0; i < face_predictions.length; i++)
            {
                const keypoints = face_predictions[i].scaledMesh;
                const n         = keypoints.length;
                const face_vtx  = new Array(n * 3);
                const face_uv   = new Array(n * 2);

                for (let j = 0; j < n; j++) {
                    const p = keypoints[j];
                    face_vtx[3*j+0] = flip_h ? (src_w - p[0]) * scale + tx : p[0] * scale + tx;
                    face_vtx[3*j+1] = p[1] * scale + ty;
                    face_vtx[3*j+2] = p[2];

                    const q = mask_keypoints[j];
                    face_uv[2*j+0] = q[0] / masktex.image.width;
                    face_uv[2*j+1] = q[1] / masktex.image.height;
                }

                draw_facemesh_tri_tex(gl, rawTex, face_vtx, face_uv, mask_color, eye_hole, flip_h);
            }
        }


        /* --- Pass 2 : overlay (preview + progress bar) --- */
        beginFrame();

        /* mask image thumbnail */
        if (mask_predictions.length > 0)
        {
            let ptx = 5, pty = 60;
            let ptw = s_masktex_region.tex_w * s_gui_prop.srcimg_scale;
            let pth = s_masktex_region.tex_h * s_gui_prop.srcimg_scale;

            drawPreview(masktex.texture, ptx, pty, ptw, pth);
            drawBorderRect(ptx, pty, ptw, pth, [1.0, 1.0, 1.0, 1.0]);

            const mask_keypoints = mask_predictions[0].scaledMesh;
            const dots = mask_keypoints.map(p => [
                p[0] / masktex.image.width  * ptw + ptx,
                p[1] / masktex.image.height * pth + pty
            ]);
            drawDots(dots, [0.0, 1.0, 1.0, 0.5], 2);
        }

        /* progress bar */
        if (face_predictions.length > 0) {
            s_showme_count = 30;
            s_status_msg.textContent = '';
        } else if (current_phase >= 2 && s_showme_count > 0) {
            s_showme_count--;
        } else {
            let bx = win_w * 0.25;
            let by = win_h * 0.5 - 50;
            let bw = win_w * 0.5;
            let bh = 100;
            let wp = (bw / 2) * current_phase;

            drawFillRect(bx, by, bw, bh, [0.0, 0.4, 0.4, 0.2]);
            drawFillRect(bx, by, wp, bh, [0.0, 0.4, 0.4, 0.5]);
            drawBorderRect(bx, by, bw, bh, [0.0, 1.0, 1.0, 0.8]);

            if (current_phase < 2) {
                s_status_msg.textContent = `Initializing[${current_phase}/2]... Please wait a minute.`;
            } else {
                s_status_msg.textContent = 'show me your face';
            }
        }

        renderScene2D();


        /* --------------------------------------- *
         *  post process
         * --------------------------------------- */
        s_timing_info.innerHTML =
            `Interval: ${interval_ms.toFixed(1)} ms<br>TF.js: ${time_invoke0.toFixed(1)} ms`;

        stats.end();
        requestAnimationFrame(render);
    }
    render();
}

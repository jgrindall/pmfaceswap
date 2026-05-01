<script setup lang="ts">
import { onMounted } from 'vue'
import { startWebGL } from './webgl_main.js'
import './css/loading1.css'

onMounted(() => {
  startWebGL()
})
</script>

<template>
  <h1>Mashcams v2</h1>
  <div id="loading">
    <div class="spinner"></div>
  </div>
  <div style="position: relative; display: inline-block; text-align: center">
    <canvas id="glcanvas" width="800" height="800"></canvas>
    <div id="canvas-overlay">
      <div id="timing-info"></div>
      <div id="status-msg"></div>
    </div>
  </div>
  <h1>&#8593;<br />Drop a face image to change the face mask.</h1>
  <div id="debug_log"></div>
</template>

<style scoped>
#canvas-overlay {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  font-family: monospace;
  font-size: 13px;
  color: cyan;
}

#timing-info {
  position: absolute;
  top: 10px; left: 10px;
  line-height: 22px;
  text-shadow: 1px 1px 2px black;
}

#status-msg {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  text-shadow: 1px 1px 3px black;
  font-size: 16px;
}
</style>

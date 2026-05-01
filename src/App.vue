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
  <div style="text-align: center">
    <canvas id="glcanvas" width="800" height="800"></canvas>
  </div>
  <h1>&#8593;<br />Drop a face image to change the face mask.</h1>
  <div id="debug_log"></div>
</template>

<style scoped></style>

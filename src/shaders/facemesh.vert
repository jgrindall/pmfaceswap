/* Three.js auto-injects: projectionMatrix, modelViewMatrix, position, uv */
in  float vtxalpha;
out vec2  v_texcoord;
out float v_vtxalpha;

void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, 0.0, 1.0);
    v_texcoord  = uv;
    v_vtxalpha  = vtxalpha;
}

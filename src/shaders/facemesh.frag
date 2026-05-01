uniform vec3      u_color;
uniform float     u_alpha;
uniform sampler2D u_sampler;

in  vec2  v_texcoord;
in  float v_vtxalpha;
out vec4  FragColor;

void main() {
    vec3 color = texture(u_sampler, v_texcoord).rgb * u_color;
    FragColor  = vec4(color, v_vtxalpha * u_alpha);
}

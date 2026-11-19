precision highp float;
precision highp sampler2D;
varying highp vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTone;
uniform float uDither;

void main() {
    vec3 color = texture2D(uTex, vUv).rgb;
    float luminance = dot(color, vec3(0.2125, 0.7154, 0.0721));
    color = mix(vec3(luminance), color, uTone.x);
    // Match Apple's adjustment order; early clipping destroys dark color transitions.
    color = clamp(((color - 0.5) * 1.9 + 0.5) * uTone.y, 0.0, 1.0) * 0.65;
    // Screen-space, monochrome dither, after all blur and tone mapping.
    float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;
    gl_FragColor = vec4(color + noise * uDither, 1.0);
}

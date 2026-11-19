precision highp float;
varying highp vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uStep;

void main() {
    gl_FragColor = (
        texture2D(uTex, vUv + uStep * vec2(-0.5, -0.5)) +
        texture2D(uTex, vUv + uStep * vec2(0.5, -0.5)) +
        texture2D(uTex, vUv + uStep * vec2(-0.5, 0.5)) +
        texture2D(uTex, vUv + uStep * vec2(0.5, 0.5))
    ) * 0.25;
}

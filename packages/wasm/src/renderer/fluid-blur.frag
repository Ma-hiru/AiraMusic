precision highp float;
precision highp sampler2D;
varying highp vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uStep;

// A 53-tap Gaussian (sigma 8.32), paired with LINEAR filtering into 27 fetches.
// Adjacent taps stay adjacent: widely spaced blur taps create visible ripples.
void main() {
    vec3 color = texture2D(uTex, vUv).rgb * 0.048018820;
    color += (texture2D(uTex, vUv + uStep * 1.49458289).rgb +
              texture2D(uTex, vUv - uStep * 1.49458289).rgb) * 0.094324519;
    color += (texture2D(uTex, vUv + uStep * 3.48736228).rgb +
              texture2D(uTex, vUv - uStep * 3.48736228).rgb) * 0.087774501;
    color += (texture2D(uTex, vUv + uStep * 5.48014693).rgb +
              texture2D(uTex, vUv - uStep * 5.48014693).rgb) * 0.077109363;
    color += (texture2D(uTex, vUv + uStep * 7.47293986).rgb +
              texture2D(uTex, vUv - uStep * 7.47293986).rgb) * 0.063950028;
    color += (texture2D(uTex, vUv + uStep * 9.46574405).rgb +
              texture2D(uTex, vUv - uStep * 9.46574405).rgb) * 0.050069024;
    color += (texture2D(uTex, vUv + uStep * 11.45856246).rgb +
              texture2D(uTex, vUv - uStep * 11.45856246).rgb) * 0.037007702;
    color += (texture2D(uTex, vUv + uStep * 13.45139805).rgb +
              texture2D(uTex, vUv - uStep * 13.45139805).rgb) * 0.025823167;
    color += (texture2D(uTex, vUv + uStep * 15.44425373).rgb +
              texture2D(uTex, vUv - uStep * 15.44425373).rgb) * 0.017010657;
    color += (texture2D(uTex, vUv + uStep * 17.43713239).rgb +
              texture2D(uTex, vUv - uStep * 17.43713239).rgb) * 0.010578560;
    color += (texture2D(uTex, vUv + uStep * 19.43003687).rgb +
              texture2D(uTex, vUv - uStep * 19.43003687).rgb) * 0.006210486;
    color += (texture2D(uTex, vUv + uStep * 21.42296998).rgb +
              texture2D(uTex, vUv - uStep * 21.42296998).rgb) * 0.003442056;
    color += (texture2D(uTex, vUv + uStep * 23.41593446).rgb +
              texture2D(uTex, vUv - uStep * 23.41593446).rgb) * 0.001800956;
    color += (texture2D(uTex, vUv + uStep * 25.40893304).rgb +
              texture2D(uTex, vUv - uStep * 25.40893304).rgb) * 0.000889571;
    gl_FragColor = vec4(color, 1.0);
}

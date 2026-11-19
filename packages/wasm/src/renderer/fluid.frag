precision highp float;
precision highp sampler2D;
varying highp vec2 vUv;
uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform float uMix;
uniform float uTime;
uniform float uAspect;

mat2 rot(float a) {
    return mat2(cos(a), -sin(a), sin(a), cos(a));
}

// A bounded sprite, rather than an infinitely mirrored copy of the cover.
vec4 sprite(sampler2D tex, vec2 p, vec2 center, float scale, float angle) {
    vec2 q = rot(angle) * (p - center) / scale + 0.5;
    float alpha = step(max(abs(q.x - 0.5), abs(q.y - 0.5)), 0.5);
    return vec4(texture2D(tex, clamp(q, 0.0, 1.0)).rgb, alpha);
}

vec3 scene(sampler2D tex, vec2 p) {
    vec3 color = sprite(tex, p, vec2(0.0), max(1.25, 1.25 / uAspect), uTime * 0.09).rgb;
    vec4 next = sprite(tex, p, vec2(-0.1, -0.1 / uAspect), 0.8, -uTime * 0.24);
    color = mix(color, next.rgb, next.a);
    vec2 orbit = 0.25 * vec2(cos(-uTime * 0.135 + 1.0), sin(-uTime * 0.135 + 1.0));
    next = sprite(tex, p, orbit, 0.5, uTime * 0.18);
    color = mix(color, next.rgb, next.a);
    orbit = vec2(0.1, 0.1 / uAspect) + 0.25 * vec2(cos(uTime * 0.09 + 3.0), sin(uTime * 0.09 + 3.0));
    next = sprite(tex, p, orbit, 0.25, -uTime * 0.12);
    return mix(color, next.rgb, next.a);
}

void main() {
    vec2 d = (vUv - 0.5) * vec2(1.0, 1.0 / uAspect);
    float falloff = max(0.0, 1.0 - length(d) / 0.8);
    vec2 p = rot(-3.25 * falloff * falloff) * d;
    vec3 color = scene(uTexA, p);
    if (uMix > 0.001) color = mix(color, scene(uTexB, p), uMix);
    // Blur the combined, warped scene before tone mapping in the final pass.
    gl_FragColor = vec4(color, 1.0);
}

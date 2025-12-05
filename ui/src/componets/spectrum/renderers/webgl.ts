import { IRenderer, RendererOptions } from "./IRenderer";

export class WebGLRenderer implements IRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private rectBuffer: WebGLBuffer | null = null;
  private radiusBuffer: WebGLBuffer | null = null;
  private positionLoc = -1;
  private rectLoc = -1;
  private radiusLoc = -1;
  private resolutionLoc: WebGLUniformLocation | null = null;
  private colorBottomLoc: WebGLUniformLocation | null = null;
  private colorTopLoc: WebGLUniformLocation | null = null;
  private pixelRatioLoc: WebGLUniformLocation | null = null;
  private options: RendererOptions | null = null;

  init(canvas: HTMLCanvasElement, options: RendererOptions) {
    const gl = canvas.getContext("webgl");
    if (!gl) throw new Error("WebGLRenderer: WebGL context unavailable");
    this.gl = gl;
    this.options = options;
    canvas.width = Math.max(1, Math.floor(options.width * options.dpr));
    canvas.height = Math.max(1, Math.floor(options.height * options.dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);

    const vsSource = `
      precision mediump float;
      attribute vec2 a_position;
      attribute vec4 a_rect;
      attribute float a_radius;
      varying vec4 v_rect;
      varying float v_radius;
      uniform vec2 u_resolution;
      void main() {
        vec2 zeroToOne = a_position / u_resolution;
        vec2 zeroToTwo = zeroToOne * 2.0;
        vec2 clipSpace = zeroToTwo - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0.0, 1.0);
        v_rect = a_rect;
        v_radius = a_radius;
      }
    `;
    const fsSource = `
      precision mediump float;
      varying vec4 v_rect;
      varying float v_radius;
      uniform vec2 u_resolution;
      uniform vec4 u_colorBottom;
      uniform vec4 u_colorTop;
      uniform float u_pixelRatio;
      void main() {
        float canvasHeight = u_resolution.y;
        float pixelHeight = canvasHeight * u_pixelRatio;
        vec2 p;
        p.x = gl_FragCoord.x / u_pixelRatio;
        p.y = (pixelHeight - gl_FragCoord.y) / u_pixelRatio;

        float x = v_rect.x;
        float y = v_rect.y;
        float w = v_rect.z;
        float h = v_rect.w;
        float r = min(v_radius, min(w * 0.5, h * 0.5));

        vec2 cL = vec2(x + r, y + r);
        vec2 cR = vec2(x + w - r, y + r);
        bool inTopBand = p.y <= (y + r);
        if (r > 0.0 && inTopBand) {
          if (p.x < (x + r)) {
            if (distance(p, cL) > r) discard;
          } else if (p.x > (x + w - r)) {
            if (distance(p, cR) > r) discard;
          }
        }

        float denom = max(0.0001, canvasHeight - y);
        float t = clamp((canvasHeight - p.y) / denom, 0.0, 1.0);
        vec4 color;
        if (t <= 0.6) {
          color = u_colorBottom;
        } else {
          float mixFactor = (t - 0.6) / 0.4;
          color = mix(u_colorBottom, u_colorTop, clamp(mixFactor, 0.0, 1.0));
        }
        gl_FragColor = color;
      }
    `;

    const vs = this.createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = this.createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = this.createProgram(gl, vs, fs);
    this.program = program;
    this.positionLoc = gl.getAttribLocation(program, "a_position");
    this.rectLoc = gl.getAttribLocation(program, "a_rect");
    this.radiusLoc = gl.getAttribLocation(program, "a_radius");
    this.resolutionLoc = gl.getUniformLocation(program, "u_resolution");
    this.colorBottomLoc = gl.getUniformLocation(program, "u_colorBottom");
    this.colorTopLoc = gl.getUniformLocation(program, "u_colorTop");
    this.pixelRatioLoc = gl.getUniformLocation(program, "u_pixelRatio");
    this.positionBuffer = gl.createBuffer();
    this.rectBuffer = gl.createBuffer();
    this.radiusBuffer = gl.createBuffer();
  }

  draw(bands: Float32Array) {
    const gl = this.gl;
    const program = this.program;
    const opt = this.options;
    if (!gl || !program || !opt) return;
    const { width, height, gap, barWidth, color, secondaryColor, dpr } = opt;
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(this.resolutionLoc!, width, height);
    gl.uniform1f(this.pixelRatioLoc!, dpr);
    const rgbaBottom = this.parseCssColor(color) || { r: 0, g: 1, b: 0.666, a: 1 };
    const rgbaTop = this.parseCssColor(secondaryColor || color) || rgbaBottom;
    gl.uniform4f(this.colorBottomLoc!, rgbaBottom.r, rgbaBottom.g, rgbaBottom.b, rgbaBottom.a);
    gl.uniform4f(this.colorTopLoc!, rgbaTop.r, rgbaTop.g, rgbaTop.b, rgbaTop.a);

    const count = bands.length;
    const totalGap = gap * Math.max(0, count - 1);
    let computedBarWidth: number;
    if (typeof barWidth === "number" && barWidth > 0) {
      computedBarWidth = Math.max(1, Math.floor(barWidth));
    } else {
      const availableWidth = Math.max(1, width - totalGap);
      computedBarWidth = Math.max(2, Math.floor(availableWidth / count));
    }

    const rects: number[] = [];
    const rectAttribs: number[] = [];
    const radii: number[] = [];
    for (let i = 0; i < count; i++) {
      const v = Math.pow(Math.min(1, Math.max(0, bands[i] ?? 0)), 0.9);
      const h = Math.max(2, v * height);
      const x = i * (computedBarWidth + gap);
      const y = height - h;
      rects.push(
        x,
        y,
        x + computedBarWidth,
        y,
        x,
        y + h,
        x,
        y + h,
        x + computedBarWidth,
        y,
        x + computedBarWidth,
        y + h
      );
      const rectInfo = [x, y, computedBarWidth, h];
      rectAttribs.push(
        ...rectInfo,
        ...rectInfo,
        ...rectInfo,
        ...rectInfo,
        ...rectInfo,
        ...rectInfo
      );
      const radius = Math.min(3, Math.floor(computedBarWidth / 2), Math.floor(h / 2));
      radii.push(radius, radius, radius, radius, radius, radius);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rects), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.positionLoc);
    gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectBuffer!);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rectAttribs), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.rectLoc);
    gl.vertexAttribPointer(this.rectLoc, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.radiusBuffer!);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(radii), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.radiusLoc);
    gl.vertexAttribPointer(this.radiusLoc, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, rects.length / 2);
  }

  destroy() {
    if (this.gl && this.positionBuffer) this.gl.deleteBuffer(this.positionBuffer);
    if (this.gl && this.rectBuffer) this.gl.deleteBuffer(this.rectBuffer);
    if (this.gl && this.radiusBuffer) this.gl.deleteBuffer(this.radiusBuffer);
    if (this.gl && this.program) this.gl.deleteProgram(this.program);
    this.gl = null;
    this.program = null;
    this.positionBuffer = null;
    this.rectBuffer = null;
    this.radiusBuffer = null;
    this.resolutionLoc = null;
    this.colorBottomLoc = null;
    this.colorTopLoc = null;
    this.pixelRatioLoc = null;
    this.options = null;
  }

  private createShader(gl: WebGLRenderingContext, type: number, source: string) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || "";
      gl.deleteShader(shader);
      throw new Error("WebGL shader compile error: " + log);
    }
    return shader;
  }

  private createProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader) {
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) || "";
      gl.deleteProgram(program);
      throw new Error("WebGL program link error: " + log);
    }
    return program;
  }

  private parseCssColor(input?: string): { r: number; g: number; b: number; a: number } | null {
    if (!input) return null;
    let m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(input);
    if (m) {
      return {
        r: parseInt(m[1]!, 16) / 255,
        g: parseInt(m[2]!, 16) / 255,
        b: parseInt(m[3]!, 16) / 255,
        a: 1
      };
    }
    m = /^#?([\da-f])([\da-f])([\da-f])$/i.exec(input);
    if (m) {
      return {
        r: parseInt(m[1] + m[1]!, 16) / 255,
        g: parseInt(m[2] + m[2]!, 16) / 255,
        b: parseInt(m[3] + m[3]!, 16) / 255,
        a: 1
      };
    }
    m = /^rgba?\(([^)]+)\)$/i.exec(input);
    if (m) {
      const parts = m[1]!.split(/\s*,\s*/);
      if (parts.length >= 3) {
        const r = Number(parts[0]);
        const g = Number(parts[1]);
        const b = Number(parts[2]);
        const a = parts.length >= 4 ? Math.max(0, Math.min(1, Number(parts[3]))) : 1;
        return { r: r / 255, g: g / 255, b: b / 255, a };
      }
    }
    return null;
  }
}

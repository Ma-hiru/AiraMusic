use csscolorparser::Color;
use wasm_bindgen::prelude::*;
use web_sys::{
    HtmlCanvasElement, WebGlBuffer, WebGlProgram, WebGlRenderingContext as GL, WebGlShader,
    WebGlUniformLocation,
};

const VERTEX_SHADER: &str = r#"
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
"#;

const FRAGMENT_SHADER: &str = r#"
precision mediump float;
varying vec4 v_rect;
varying float v_radius;
uniform vec2 u_resolution;
uniform vec4 u_colorBottom;
uniform vec4 u_colorTop;
uniform float u_pixelRatio;
uniform int u_roundedCorners;
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

    vec2 cLT = vec2(x + r, y + r);
    vec2 cRT = vec2(x + w - r, y + r);
    vec2 cLB = vec2(x + r, y + h - r);
    vec2 cRB = vec2(x + w - r, y + h - r);

    bool inTopBand = p.y <= (y + r);
    bool inBottomBand = p.y >= (y + h - r);

    if (r > 0.0) {
        if ((u_roundedCorners == 1 || u_roundedCorners == 3) && inTopBand) {
            if (p.x < (x + r)) {
                if (distance(p, cLT) > r) discard;
            } else if (p.x > (x + w - r)) {
                if (distance(p, cRT) > r) discard;
            }
        }
        if ((u_roundedCorners == 2 || u_roundedCorners == 3) && inBottomBand) {
            if (p.x < (x + r)) {
                if (distance(p, cLB) > r) discard;
            } else if (p.x > (x + w - r)) {
                if (distance(p, cRB) > r) discard;
            }
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
"#;

#[wasm_bindgen]
pub struct WebGLRenderer {
    gl: GL,
    program: WebGlProgram,
    position_buffer: WebGlBuffer,
    rect_buffer: WebGlBuffer,
    radius_buffer: WebGlBuffer,
    position_loc: i32,
    rect_loc: i32,
    radius_loc: i32,
    resolution_loc: Option<WebGlUniformLocation>,
    color_bottom_loc: Option<WebGlUniformLocation>,
    color_top_loc: Option<WebGlUniformLocation>,
    pixel_ratio_loc: Option<WebGlUniformLocation>,
    rounded_corners_loc: Option<WebGlUniformLocation>,
    width: f32,
    height: f32,
    dpr: f32,
    gap: f32,
    bar_width: Option<f32>,
    height_scale: f32,
    // 复用临时缓冲区，避免每帧 Vec 分配导致 wasm 内存持续上升
    positions: Vec<f32>,
    rect_attribs: Vec<f32>,
    radii: Vec<f32>,
}

#[wasm_bindgen]
impl WebGLRenderer {
    #[wasm_bindgen(constructor)]
    pub fn new(
        canvas: HtmlCanvasElement,
        width: f32,
        height: f32,
        dpr: f32,
        gap: f32,
        bar_width: Option<f32>,
        height_scale: Option<f32>,
    ) -> Result<WebGLRenderer, JsValue> {
        let gl = canvas
            .get_context("webgl")?
            .ok_or("Failed to get WebGL context")?
            .dyn_into::<GL>()?;

        let canvas_width = (width * dpr).floor() as i32;
        let canvas_height = (height * dpr).floor() as i32;
        canvas.set_width(canvas_width as u32);
        canvas.set_height(canvas_height as u32);
        gl.viewport(0, 0, canvas_width, canvas_height);

        // 编译 shader
        let vs = compile_shader(&gl, GL::VERTEX_SHADER, VERTEX_SHADER)?;
        let fs = compile_shader(&gl, GL::FRAGMENT_SHADER, FRAGMENT_SHADER)?;
        let program = link_program(&gl, &vs, &fs)?;

        // program link 完成后即可释放 shader 对象
        gl.detach_shader(&program, &vs);
        gl.detach_shader(&program, &fs);
        gl.delete_shader(Some(&vs));
        gl.delete_shader(Some(&fs));

        // 获取 attribute 和 uniform 位置
        let position_loc = gl.get_attrib_location(&program, "a_position");
        let rect_loc = gl.get_attrib_location(&program, "a_rect");
        let radius_loc = gl.get_attrib_location(&program, "a_radius");
        let resolution_loc = gl.get_uniform_location(&program, "u_resolution");
        let color_bottom_loc = gl.get_uniform_location(&program, "u_colorBottom");
        let color_top_loc = gl.get_uniform_location(&program, "u_colorTop");
        let pixel_ratio_loc = gl.get_uniform_location(&program, "u_pixelRatio");
        let rounded_corners_loc = gl.get_uniform_location(&program, "u_roundedCorners");

        // 创建 buffers
        let position_buffer = gl
            .create_buffer()
            .ok_or("Failed to create position buffer")?;
        let rect_buffer = gl.create_buffer().ok_or("Failed to create rect buffer")?;
        let radius_buffer = gl.create_buffer().ok_or("Failed to create radius buffer")?;

        Ok(WebGLRenderer {
            gl,
            program,
            position_buffer,
            rect_buffer,
            radius_buffer,
            position_loc,
            rect_loc,
            radius_loc,
            resolution_loc,
            color_bottom_loc,
            color_top_loc,
            pixel_ratio_loc,
            rounded_corners_loc,
            width,
            height,
            dpr,
            gap,
            bar_width,
            height_scale: height_scale.unwrap_or(1.0),
            positions: Vec::new(),
            rect_attribs: Vec::new(),
            radii: Vec::new(),
        })
    }

    /// 显式释放 WebGL 资源（buffer/program）。
    /// 注意：单纯 drop Rust struct 不一定会及时释放 GPU 资源。
    #[wasm_bindgen]
    pub fn destroy(&mut self) {
        let gl = &self.gl;
        gl.bind_buffer(GL::ARRAY_BUFFER, None);
        gl.use_program(None);
        gl.delete_buffer(Some(&self.position_buffer));
        gl.delete_buffer(Some(&self.rect_buffer));
        gl.delete_buffer(Some(&self.radius_buffer));
        gl.delete_program(Some(&self.program));
    }

    pub fn draw(&mut self, bands: &[f32], color: &str, secondary_color: &str, rounded_corners: &str) -> Result<(), JsValue> {
        let gl = &self.gl;

        gl.use_program(Some(&self.program));
        gl.enable(GL::BLEND);
        gl.blend_func(GL::SRC_ALPHA, GL::ONE_MINUS_SRC_ALPHA);
        gl.clear_color(0.0, 0.0, 0.0, 0.0);
        gl.clear(GL::COLOR_BUFFER_BIT);

        // 设置 uniforms
        gl.uniform2f(self.resolution_loc.as_ref(), self.width, self.height);
        gl.uniform1f(self.pixel_ratio_loc.as_ref(), self.dpr);

        let corner_mode = match rounded_corners {
            "none" => 0,
            "top" => 1,
            "bottom" => 2,
            "both" => 3,
            _ => 1,
        };
        gl.uniform1i(self.rounded_corners_loc.as_ref(), corner_mode);

        let rgba_bottom = parse_css_color(color);
        let rgba_top = parse_css_color(secondary_color);
        gl.uniform4f(
            self.color_bottom_loc.as_ref(),
            rgba_bottom.0,
            rgba_bottom.1,
            rgba_bottom.2,
            rgba_bottom.3,
        );
        gl.uniform4f(
            self.color_top_loc.as_ref(),
            rgba_top.0,
            rgba_top.1,
            rgba_top.2,
            rgba_top.3,
        );

        // 计算柱宽
        let count = bands.len();
        if count == 0 {
            return Ok(());
        }
        let gap_count = count.saturating_sub(1) as f32;
        let preferred_gap = self.gap.max(0.0);
        let preferred_bar_width = if let Some(bw) = self.bar_width {
            bw.max(0.5)
        } else {
            ((self.width - preferred_gap * gap_count).max(1.0) / count as f32).max(1.0)
        };

        let preferred_total_width = preferred_bar_width * count as f32 + preferred_gap * gap_count;
        let mut computed_bar_width = preferred_bar_width;
        let mut computed_gap = preferred_gap;

        // gap 优先遵循配置值：仅在溢出时压缩；有剩余空间时优先扩展自动 bar 或做居中留白。
        if gap_count > 0.0 {
            if preferred_total_width > self.width && preferred_total_width > 0.0 {
                let scale = self.width / preferred_total_width;
                computed_bar_width = (preferred_bar_width * scale).max(0.5);
                computed_gap = preferred_gap * scale;
            } else if preferred_total_width < self.width {
                computed_bar_width = (self.width - preferred_gap * gap_count) / count as f32;
            }
        } else {
            computed_bar_width = self.width.max(0.5);
        }

        // 构建顶点数据（复用 Vec 容量）
        self.positions.clear();
        self.rect_attribs.clear();
        self.radii.clear();
        self.positions.reserve(count * 12);
        self.rect_attribs.reserve(count * 24);
        self.radii.reserve(count * 6);

        for (i, &band) in bands.iter().enumerate() {
            let v = band.clamp(0.0, 1.0).powf(0.9);
            let h = (v * self.height * self.height_scale).max(2.0);
            let x = i as f32 * (computed_bar_width + computed_gap);
            let draw_bar_width = if i + 1 == count {
                (self.width - x).max(0.5)
            } else {
                computed_bar_width
            };
            let y = self.height - h;

            // 两个三角形组成矩形
            self.positions.extend_from_slice(&[
                x,
                y,
                x + draw_bar_width,
                y,
                x,
                y + h,
                x,
                y + h,
                x + draw_bar_width,
                y,
                x + draw_bar_width,
                y + h,
            ]);

            // rect info (x, y, w, h) 重复 6 次
            let rect_info = [x, y, draw_bar_width, h];
            for _ in 0..6 {
                self.rect_attribs.extend_from_slice(&rect_info);
            }

            // radius
            let radius = 3.0_f32.min(draw_bar_width / 2.0).min(h / 2.0).floor();
            self.radii.extend_from_slice(&[radius; 6]);
        }

        // 上传数据到 GPU：每帧更新，使用 DYNAMIC_DRAW
        gl.bind_buffer(GL::ARRAY_BUFFER, Some(&self.position_buffer));
        unsafe {
            let view = js_sys::Float32Array::view(&self.positions);
            gl.buffer_data_with_array_buffer_view(GL::ARRAY_BUFFER, &view, GL::DYNAMIC_DRAW);
        }
        gl.enable_vertex_attrib_array(self.position_loc as u32);
        gl.vertex_attrib_pointer_with_i32(self.position_loc as u32, 2, GL::FLOAT, false, 0, 0);

        gl.bind_buffer(GL::ARRAY_BUFFER, Some(&self.rect_buffer));
        unsafe {
            let view = js_sys::Float32Array::view(&self.rect_attribs);
            gl.buffer_data_with_array_buffer_view(GL::ARRAY_BUFFER, &view, GL::DYNAMIC_DRAW);
        }
        gl.enable_vertex_attrib_array(self.rect_loc as u32);
        gl.vertex_attrib_pointer_with_i32(self.rect_loc as u32, 4, GL::FLOAT, false, 0, 0);

        gl.bind_buffer(GL::ARRAY_BUFFER, Some(&self.radius_buffer));
        unsafe {
            let view = js_sys::Float32Array::view(&self.radii);
            gl.buffer_data_with_array_buffer_view(GL::ARRAY_BUFFER, &view, GL::DYNAMIC_DRAW);
        }
        gl.enable_vertex_attrib_array(self.radius_loc as u32);
        gl.vertex_attrib_pointer_with_i32(self.radius_loc as u32, 1, GL::FLOAT, false, 0, 0);

        gl.draw_arrays(GL::TRIANGLES, 0, (self.positions.len() / 2) as i32);

        Ok(())
    }
}

fn compile_shader(gl: &GL, shader_type: u32, source: &str) -> Result<WebGlShader, JsValue> {
    let shader = gl
        .create_shader(shader_type)
        .ok_or("Failed to create shader")?;
    gl.shader_source(&shader, source);
    gl.compile_shader(&shader);

    if !gl
        .get_shader_parameter(&shader, GL::COMPILE_STATUS)
        .as_bool()
        .unwrap_or(false)
    {
        let log = gl.get_shader_info_log(&shader).unwrap_or_default();
        gl.delete_shader(Some(&shader));
        return Err(format!("Shader compile error: {}", log).into());
    }

    Ok(shader)
}

fn link_program(gl: &GL, vs: &WebGlShader, fs: &WebGlShader) -> Result<WebGlProgram, JsValue> {
    let program = gl.create_program().ok_or("Failed to create program")?;
    gl.attach_shader(&program, vs);
    gl.attach_shader(&program, fs);
    gl.link_program(&program);

    if !gl
        .get_program_parameter(&program, GL::LINK_STATUS)
        .as_bool()
        .unwrap_or(false)
    {
        let log = gl.get_program_info_log(&program).unwrap_or_default();
        gl.delete_program(Some(&program));
        return Err(format!("Program link error: {}", log).into());
    }

    Ok(program)
}

/// 解析 CSS 颜色字符串为 RGBA (0.0-1.0)
/// 使用 csscolorparser 库支持所有标准 CSS 颜色格式：
/// - 十六进制: #rgb, #rrggbb, #rrggbbaa
/// - 函数: rgb(), rgba(), hsl(), hsla(), hwb()
/// - 命名颜色: red, blue, transparent, 等 140+ 种
fn parse_css_color(input: &str) -> (f32, f32, f32, f32) {
    input
        .parse::<Color>()
        .map(|color| {
            let [r, g, b, a] = color.to_array();
            (r, g, b, a)
        })
        .unwrap_or((0.0, 1.0, 0.666, 1.0))
}

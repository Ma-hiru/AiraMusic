use serde::Deserialize;
use tsify::Tsify;
use wasm_bindgen::prelude::*;
use web_sys::{
    CanvasRenderingContext2d, HtmlCanvasElement, HtmlImageElement, WebGlBuffer,
    WebGlContextAttributes, WebGlFramebuffer, WebGlPowerPreference, WebGlProgram,
    WebGlRenderingContext as GL, WebGlTexture, WebGlUniformLocation,
};

#[derive(Deserialize, Tsify)]
#[tsify(from_wasm_abi)]
#[serde(rename_all = "camelCase")]
pub struct FluidOptions {
    pub blur: f64,
    pub saturate: f32,
    pub brightness: f32,
    pub speed: f64,
    pub opacity: f32,
    pub fps: f64,
    pub fade_duration: f64,
    pub texture_size: u32,
}

struct Resources {
    gl: GL,
    programs: Vec<WebGlProgram>,
    buffer: Option<WebGlBuffer>,
    textures: Vec<WebGlTexture>,
    targets: Vec<RenderTarget>,
}

impl Drop for Resources {
    fn drop(&mut self) {
        for texture in &self.textures {
            self.gl.delete_texture(Some(texture));
        }
        self.gl.delete_buffer(self.buffer.as_ref());
        for program in &self.programs {
            self.gl.delete_program(Some(program));
        }
        for target in &self.targets {
            self.gl.delete_framebuffer(Some(&target.framebuffer));
            self.gl.delete_texture(Some(&target.texture));
        }
    }
}

struct RenderTarget {
    framebuffer: WebGlFramebuffer,
    texture: WebGlTexture,
    width: u32,
    height: u32,
}

struct Uniforms {
    mix: Option<WebGlUniformLocation>,
    time: Option<WebGlUniformLocation>,
    aspect: Option<WebGlUniformLocation>,
    downsample_step: Option<WebGlUniformLocation>,
    blur_step: Option<WebGlUniformLocation>,
    dither: Option<WebGlUniformLocation>,
}

#[derive(Default)]
struct Animation {
    active: usize,
    has_image: bool,
    fade_start: Option<f64>,
    time: f64,
    last_draw: Option<f64>,
    paused: bool,
    dirty: bool,
}

impl Animation {
    fn is_animating(&self) -> bool {
        self.has_image && (!self.paused || self.fade_start.is_some())
    }

    fn image_slot(&self) -> usize {
        if !self.has_image {
            0
        } else if self.fade_start.is_some() {
            // Commit the incoming cover before reusing the old outgoing slot.
            self.active
        } else {
            1 - self.active
        }
    }

    fn set_image(&mut self, now: f64) {
        if self.fade_start.is_some() {
            self.active = 1 - self.active;
        }
        self.fade_start = self.has_image.then_some(now);
        self.has_image = true;
        self.dirty = true;
    }

    fn frame(&mut self, now: f64, options: &FluidOptions) -> Option<f32> {
        let interval = 1000.0 / options.fps.clamp(1.0, 60.0);
        let delta = self.last_draw.map_or(interval, |last| now - last);
        if !self.dirty && delta < interval - 0.5 {
            return None;
        }
        self.last_draw = Some(now);
        if !self.paused {
            self.time += delta.clamp(0.0, 120.0) / 1000.0 * options.speed;
        }
        let mut mix = 0.0;
        if let Some(start) = self.fade_start {
            let progress = if options.fade_duration > 0.0 {
                (now - start) / options.fade_duration
            } else {
                1.0
            };
            if progress >= 1.0 {
                self.active = 1 - self.active;
                self.fade_start = None;
                self.dirty = true;
            } else {
                mix = progress.max(0.0) as f32;
            }
        }
        if !self.has_image || (self.paused && self.fade_start.is_none() && !self.dirty) {
            return None;
        }
        self.dirty = false;
        Some(mix)
    }
}

/// Low-resolution scene composition and post-warp blur, with a full-size final pass.
#[wasm_bindgen]
pub struct FluidRenderer {
    canvas: HtmlCanvasElement,
    resources: Option<Resources>,
    uniforms: Uniforms,
    options: FluidOptions,
    animation: Animation,
}

#[wasm_bindgen]
impl FluidRenderer {
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement, mut options: FluidOptions) -> Result<Self, JsValue> {
        let attributes = WebGlContextAttributes::new();
        attributes.set_antialias(false);
        attributes.set_depth(false);
        attributes.set_stencil(false);
        attributes.set_alpha(false);
        attributes.set_premultiplied_alpha(false);
        attributes.set_power_preference(WebGlPowerPreference::LowPower);
        attributes.set_preserve_drawing_buffer(false);
        let gl = canvas
            .get_context_with_context_options("webgl", attributes.as_ref())?
            .ok_or("Fluid backdrop: WebGL unavailable")?
            .dyn_into::<GL>()?;
        options.texture_size = options.texture_size.clamp(64, 1024);
        let mut resources = Resources {
            gl: gl.clone(),
            programs: Vec::with_capacity(4),
            buffer: None,
            textures: Vec::with_capacity(2),
            targets: Vec::with_capacity(3),
        };
        for fragment in [
            include_str!("fluid.frag"),
            include_str!("fluid-downsample.frag"),
            include_str!("fluid-blur.frag"),
            include_str!("fluid-present.frag"),
        ] {
            resources.programs.push(create_program(&gl, fragment)?);
        }
        let program = &resources.programs[0];
        let buffer = gl
            .create_buffer()
            .ok_or("Fluid backdrop: buffer unavailable")?;
        resources.buffer = Some(buffer.clone());
        gl.bind_buffer(GL::ARRAY_BUFFER, Some(&buffer));
        let vertices = js_sys::Float32Array::from(&[-1.0_f32, -1.0, 3.0, -1.0, -1.0, 3.0][..]);
        gl.buffer_data_with_array_buffer_view(GL::ARRAY_BUFFER, &vertices, GL::STATIC_DRAW);
        let position = gl.get_attrib_location(program, "aPos") as u32;
        gl.enable_vertex_attrib_array(position);
        gl.vertex_attrib_pointer_with_i32(position, 2, GL::FLOAT, false, 0, 0);

        for slot in 0..2 {
            let texture = gl
                .create_texture()
                .ok_or("Fluid backdrop: texture unavailable")?;
            resources.textures.push(texture.clone());
            gl.active_texture(GL::TEXTURE0 + slot);
            gl.bind_texture(GL::TEXTURE_2D, Some(&texture));
            for parameter in [GL::TEXTURE_MIN_FILTER, GL::TEXTURE_MAG_FILTER] {
                gl.tex_parameteri(GL::TEXTURE_2D, parameter, GL::LINEAR as i32);
            }
            for parameter in [GL::TEXTURE_WRAP_S, GL::TEXTURE_WRAP_T] {
                gl.tex_parameteri(GL::TEXTURE_2D, parameter, GL::CLAMP_TO_EDGE as i32);
            }
            // Both samplers must be complete, including before the first crossfade.
            gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
                GL::TEXTURE_2D,
                0,
                GL::RGBA as i32,
                1,
                1,
                0,
                GL::RGBA,
                GL::UNSIGNED_BYTE,
                Some(&[0, 0, 0, 255]),
            )?;
        }
        gl.use_program(Some(program));
        gl.uniform1i(gl.get_uniform_location(program, "uTexA").as_ref(), 0);
        gl.uniform1i(gl.get_uniform_location(program, "uTexB").as_ref(), 1);
        let uniforms = Uniforms {
            mix: gl.get_uniform_location(program, "uMix"),
            time: gl.get_uniform_location(program, "uTime"),
            aspect: gl.get_uniform_location(program, "uAspect"),
            downsample_step: gl.get_uniform_location(&resources.programs[1], "uStep"),
            blur_step: gl.get_uniform_location(&resources.programs[2], "uStep"),
            dither: gl.get_uniform_location(&resources.programs[3], "uDither"),
        };
        for program in &resources.programs[1..] {
            gl.use_program(Some(program));
            gl.uniform1i(gl.get_uniform_location(program, "uTex").as_ref(), 0);
        }
        gl.uniform2f(
            gl.get_uniform_location(&resources.programs[3], "uTone")
                .as_ref(),
            options.saturate,
            options.brightness,
        );
        gl.uniform1f(uniforms.dither.as_ref(), dither_amplitude(options.opacity));
        gl.disable(GL::BLEND);
        gl.disable(GL::DEPTH_TEST);
        Ok(Self {
            canvas,
            resources: Some(resources),
            uniforms,
            options,
            animation: Animation::default(),
        })
    }

    #[wasm_bindgen(js_name = setImage)]
    pub fn set_image(&mut self, image: &HtmlImageElement, now: f64) -> Result<(), JsValue> {
        let Some(resources) = &self.resources else {
            return Ok(());
        };
        let baked = self.bake(image)?;
        let gl = &resources.gl;
        let slot = self.animation.image_slot();
        gl.active_texture(GL::TEXTURE0 + slot as u32);
        gl.bind_texture(GL::TEXTURE_2D, Some(&resources.textures[slot]));
        gl.pixel_storei(GL::UNPACK_FLIP_Y_WEBGL, 1);
        let result = gl.tex_image_2d_with_u32_and_u32_and_canvas(
            GL::TEXTURE_2D,
            0,
            GL::RGBA as i32,
            GL::RGBA,
            GL::UNSIGNED_BYTE,
            &baked,
        );
        gl.pixel_storei(GL::UNPACK_FLIP_Y_WEBGL, 0);
        result?;
        // Failed uploads leave the current cover and transition intact.
        self.animation.set_image(now);
        Ok(())
    }

    #[wasm_bindgen(js_name = setPaused)]
    pub fn set_paused(&mut self, paused: bool) {
        if self.animation.paused != paused {
            // A stopped rAF loop can stay idle indefinitely; resuming must not
            // count that idle period as animation time.
            self.animation.last_draw = None;
        }
        self.animation.paused = paused;
    }

    #[wasm_bindgen(js_name = setSpeed)]
    pub fn set_speed(&mut self, speed: f64) {
        self.options.speed = speed.max(0.1);
    }

    #[wasm_bindgen(js_name = setOpacity)]
    pub fn set_opacity(&mut self, opacity: f32) {
        self.options.opacity = opacity;
        if let Some(resources) = &self.resources {
            resources.gl.use_program(Some(&resources.programs[3]));
            resources
                .gl
                .uniform1f(self.uniforms.dither.as_ref(), dither_amplitude(opacity));
        }
        self.animation.dirty = true;
    }

    /// Returns whether the browser needs to schedule another animation frame.
    pub fn render(&mut self, now: f64, width: u32, height: u32) -> Result<bool, JsValue> {
        let Some(resources) = &mut self.resources else {
            return Ok(false);
        };
        let (width, height) = (width.max(1), height.max(1));
        if self.canvas.width() != width || self.canvas.height() != height {
            self.canvas.set_width(width);
            self.canvas.set_height(height);
            self.animation.dirty = true;
        }
        let Some(mix) = self.animation.frame(now, &self.options) else {
            return Ok(self.animation.is_animating());
        };
        let gl = &resources.gl;
        let (scene_width, scene_height) = scene_size(width, height);
        if resources
            .targets
            .first()
            .is_none_or(|target| target.width != scene_width || target.height != scene_height)
        {
            for target in resources.targets.drain(..) {
                gl.delete_framebuffer(Some(&target.framebuffer));
                gl.delete_texture(Some(&target.texture));
            }
            for (w, h) in [
                (scene_width, scene_height),
                (scene_width.div_ceil(2), scene_height.div_ceil(2)),
                (scene_width.div_ceil(2), scene_height.div_ceil(2)),
            ] {
                resources.targets.push(create_target(gl, w, h)?);
            }
        }
        let scene = &resources.targets[0];
        let blur = &resources.targets[1];
        let scratch = &resources.targets[2];
        gl.bind_framebuffer(GL::FRAMEBUFFER, Some(&scene.framebuffer));
        gl.viewport(0, 0, scene.width as i32, scene.height as i32);
        gl.use_program(Some(&resources.programs[0]));
        for slot in 0..2 {
            gl.active_texture(GL::TEXTURE0 + slot as u32);
            gl.bind_texture(
                GL::TEXTURE_2D,
                Some(&resources.textures[self.animation.active ^ slot]),
            );
        }
        gl.uniform1f(self.uniforms.mix.as_ref(), mix);
        gl.uniform1f(self.uniforms.time.as_ref(), self.animation.time as f32);
        gl.uniform1f(self.uniforms.aspect.as_ref(), width as f32 / height as f32);
        gl.draw_arrays(GL::TRIANGLES, 0, 3);

        bind_pass(
            gl,
            &resources.programs[1],
            &scene.texture,
            Some(blur),
            width,
            height,
        );
        gl.uniform2f(
            self.uniforms.downsample_step.as_ref(),
            1.0 / scene.width as f32,
            1.0 / scene.height as f32,
        );
        gl.draw_arrays(GL::TRIANGLES, 0, 3);
        bind_pass(
            gl,
            &resources.programs[2],
            &blur.texture,
            Some(scratch),
            width,
            height,
        );
        gl.uniform2f(
            self.uniforms.blur_step.as_ref(),
            1.0 / blur.width as f32,
            0.0,
        );
        gl.draw_arrays(GL::TRIANGLES, 0, 3);
        bind_pass(
            gl,
            &resources.programs[2],
            &scratch.texture,
            Some(blur),
            width,
            height,
        );
        gl.uniform2f(
            self.uniforms.blur_step.as_ref(),
            0.0,
            1.0 / blur.height as f32,
        );
        gl.draw_arrays(GL::TRIANGLES, 0, 3);
        bind_pass(
            gl,
            &resources.programs[3],
            &blur.texture,
            None,
            width,
            height,
        );
        gl.draw_arrays(GL::TRIANGLES, 0, 3);
        Ok(self.animation.is_animating())
    }

    pub fn destroy(&mut self) {
        // Releasing objects also works on init failure and .free() via Drop.
        // Do not lose the context: React StrictMode can reuse this canvas.
        self.resources.take();
    }
}

impl FluidRenderer {
    fn bake(&self, image: &HtmlImageElement) -> Result<HtmlCanvasElement, JsValue> {
        let document = self
            .canvas
            .owner_document()
            .ok_or("Fluid backdrop: document unavailable")?;
        let make_canvas =
            |size: u32| -> Result<(HtmlCanvasElement, CanvasRenderingContext2d), JsValue> {
                let canvas = document
                    .create_element("canvas")?
                    .dyn_into::<HtmlCanvasElement>()?;
                canvas.set_width(size);
                canvas.set_height(size);
                let context = canvas
                    .get_context("2d")?
                    .ok_or("Fluid backdrop: 2D context unavailable")?
                    .dyn_into::<CanvasRenderingContext2d>()?;
                Ok((canvas, context))
            };
        let size = self.options.texture_size;
        // Only prefilter the source to limit aliasing at the small scene resolution.
        // The visible blur happens after composition and warp, on the GPU.
        let blur = (self.options.blur / 30.0).clamp(0.0, 8.0);
        let padding = (blur * 2.0).ceil() as u32;
        let extent = size + padding * 2;
        let (source, context) = make_canvas(extent)?;
        context.set_filter(&format!("blur({blur}px)"));
        let width = if image.natural_width() > 0 {
            image.natural_width()
        } else {
            image.width()
        } as f64;
        let height = if image.natural_height() > 0 {
            image.natural_height()
        } else {
            image.height()
        } as f64;
        if width == 0.0 || height == 0.0 {
            return Err("Fluid backdrop: empty image".into());
        }
        let fit = (extent as f64 / width).max(extent as f64 / height);
        context.draw_image_with_html_image_element_and_dw_and_dh(
            image,
            (extent as f64 - width * fit) * 0.5,
            (extent as f64 - height * fit) * 0.5,
            width * fit,
            height * fit,
        )?;
        if padding == 0 {
            return Ok(source);
        }
        let (cropped, context) = make_canvas(size)?;
        context.draw_image_with_html_canvas_element_and_sw_and_sh_and_dx_and_dy_and_dw_and_dh(
            &source,
            padding as f64,
            padding as f64,
            size as f64,
            size as f64,
            0.0,
            0.0,
            size as f64,
            size as f64,
        )?;
        Ok(cropped)
    }
}

fn dither_amplitude(opacity: f32) -> f32 {
    1.0 / (255.0 * opacity.clamp(0.05, 1.0))
}

fn scene_size(width: u32, height: u32) -> (u32, u32) {
    let scale = (256.0 / width.max(height).max(1) as f64).min(1.0);
    (
        (width as f64 * scale).round().max(1.0) as u32,
        (height as f64 * scale).round().max(1.0) as u32,
    )
}

fn bind_pass(
    gl: &GL,
    program: &WebGlProgram,
    texture: &WebGlTexture,
    target: Option<&RenderTarget>,
    width: u32,
    height: u32,
) {
    gl.use_program(Some(program));
    gl.active_texture(GL::TEXTURE0);
    gl.bind_texture(GL::TEXTURE_2D, Some(texture));
    gl.bind_framebuffer(GL::FRAMEBUFFER, target.map(|target| &target.framebuffer));
    let (width, height) = target.map_or((width, height), |target| (target.width, target.height));
    gl.viewport(0, 0, width as i32, height as i32);
}

fn create_target(gl: &GL, width: u32, height: u32) -> Result<RenderTarget, JsValue> {
    let texture = gl
        .create_texture()
        .ok_or("Fluid backdrop: render texture unavailable")?;
    gl.bind_texture(GL::TEXTURE_2D, Some(&texture));
    for parameter in [GL::TEXTURE_MIN_FILTER, GL::TEXTURE_MAG_FILTER] {
        gl.tex_parameteri(GL::TEXTURE_2D, parameter, GL::LINEAR as i32);
    }
    for parameter in [GL::TEXTURE_WRAP_S, GL::TEXTURE_WRAP_T] {
        gl.tex_parameteri(GL::TEXTURE_2D, parameter, GL::CLAMP_TO_EDGE as i32);
    }
    if let Err(error) = gl
        .tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
            GL::TEXTURE_2D,
            0,
            GL::RGBA as i32,
            width as i32,
            height as i32,
            0,
            GL::RGBA,
            GL::UNSIGNED_BYTE,
            None,
        )
    {
        gl.delete_texture(Some(&texture));
        return Err(error);
    }
    let Some(framebuffer) = gl.create_framebuffer() else {
        gl.delete_texture(Some(&texture));
        return Err("Fluid backdrop: framebuffer unavailable".into());
    };
    gl.bind_framebuffer(GL::FRAMEBUFFER, Some(&framebuffer));
    gl.framebuffer_texture_2d(
        GL::FRAMEBUFFER,
        GL::COLOR_ATTACHMENT0,
        GL::TEXTURE_2D,
        Some(&texture),
        0,
    );
    if gl.check_framebuffer_status(GL::FRAMEBUFFER) != GL::FRAMEBUFFER_COMPLETE {
        gl.delete_framebuffer(Some(&framebuffer));
        gl.delete_texture(Some(&texture));
        return Err("Fluid backdrop: incomplete framebuffer".into());
    }
    Ok(RenderTarget {
        framebuffer,
        texture,
        width,
        height,
    })
}

fn create_program(gl: &GL, fragment_source: &str) -> Result<WebGlProgram, JsValue> {
    let vertex = super::webgl::compile_shader(gl, GL::VERTEX_SHADER, include_str!("fluid.vert"))?;
    let fragment = match super::webgl::compile_shader(gl, GL::FRAGMENT_SHADER, fragment_source) {
        Ok(shader) => shader,
        Err(error) => {
            gl.delete_shader(Some(&vertex));
            return Err(error);
        }
    };
    let result = if let Some(program) = gl.create_program() {
        gl.attach_shader(&program, &vertex);
        gl.attach_shader(&program, &fragment);
        gl.bind_attrib_location(&program, 0, "aPos");
        gl.link_program(&program);
        let linked = gl
            .get_program_parameter(&program, GL::LINK_STATUS)
            .as_bool()
            .unwrap_or(false);
        gl.detach_shader(&program, &vertex);
        gl.detach_shader(&program, &fragment);
        if linked {
            Ok(program)
        } else {
            let error = gl.get_program_info_log(&program).unwrap_or_default();
            gl.delete_program(Some(&program));
            Err(format!("Fluid backdrop: program link failed: {error}").into())
        }
    } else {
        Err("Fluid backdrop: program unavailable".into())
    };
    gl.delete_shader(Some(&vertex));
    gl.delete_shader(Some(&fragment));
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options() -> FluidOptions {
        FluidOptions {
            blur: 60.0,
            saturate: 3.0,
            brightness: 0.4,
            speed: 1.0,
            opacity: 0.4,
            fps: 60.0,
            fade_duration: 800.0,
            texture_size: 512,
        }
    }

    #[test]
    fn paused_cover_fades_finishes_and_redraws_on_resize() {
        let mut animation = Animation {
            paused: true,
            ..Default::default()
        };
        animation.set_image(0.0);
        assert!(!animation.is_animating());
        assert_eq!(animation.frame(0.0, &options()), Some(0.0));
        assert_eq!(animation.frame(100.0, &options()), None);
        animation.set_image(100.0);
        assert!(animation.is_animating());
        assert_eq!(animation.frame(500.0, &options()), Some(0.5));
        assert_eq!(animation.frame(900.0, &options()), Some(0.0));
        assert_eq!(animation.active, 1);
        assert!(!animation.is_animating());
        assert_eq!(animation.frame(1000.0, &options()), None);
        animation.dirty = true;
        assert_eq!(animation.frame(1100.0, &options()), Some(0.0));
        assert_eq!(animation.time, 0.0);
    }

    #[test]
    fn rapid_covers_reuse_outgoing_slot_and_keep_latest_cover() {
        let mut animation = Animation::default();
        assert_eq!(animation.image_slot(), 0);
        animation.set_image(0.0);
        assert_eq!(animation.image_slot(), 1);
        animation.set_image(100.0);
        assert_eq!(animation.image_slot(), 0);
        animation.set_image(200.0);
        assert_eq!(animation.active, 1);
        assert_eq!(animation.frame(600.0, &options()), Some(0.5));
        animation.frame(1000.0, &options());
        assert_eq!(animation.active, 0);
        assert_eq!(animation.fade_start, None);
    }

    #[test]
    fn speed_preserves_phase_and_frame_rate_is_bounded() {
        let mut animation = Animation::default();
        let mut options = options();
        animation.set_image(0.0);
        animation.frame(0.0, &options);
        let phase = animation.time;
        assert_eq!(animation.frame(5.0, &options), None);
        assert_eq!(animation.time, phase);
        options.speed = 3.0;
        animation.frame(20.0, &options);
        assert!((animation.time - phase - 0.06).abs() < 1e-6);
        animation.frame(10_000.0, &options);
        assert!((animation.time - phase - 0.42).abs() < 1e-6);
    }

    #[test]
    fn dither_survives_opacity_without_unbounded_amplification() {
        for opacity in [0.1, 0.4, 1.0] {
            assert!((dither_amplitude(opacity) * opacity * 255.0 - 1.0).abs() < 1e-6);
        }
        assert_eq!(dither_amplitude(0.0), dither_amplitude(0.05));
    }

    #[test]
    fn scene_resolution_stays_bounded_in_landscape_and_portrait() {
        assert_eq!(scene_size(1142, 670), (256, 150));
        assert_eq!(scene_size(670, 1142), (150, 256));
        assert_eq!(scene_size(7680, 4320), (256, 144));
        assert_eq!(scene_size(1, 10_000), (1, 256));
        assert_eq!(scene_size(100, 50), (100, 50));
    }
}

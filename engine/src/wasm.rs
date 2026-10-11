//! JavaScript bindings.

use wasm_bindgen::prelude::*;

use crate::color::Rgb;
use crate::error::EngineError;
use crate::image::Pixels;
use crate::optimizer::SearchParams;
use crate::palette::{PaletteColor, PaletteMethod};
use crate::redraw::RedrawMethod;
use crate::{RedrawDeduper, Session};

fn js_err(e: EngineError) -> JsError {
    JsError::new(&e.to_string())
}

fn to_usize(v: u32) -> usize {
    v as usize
}

#[allow(clippy::cast_possible_truncation)]
fn to_u32(v: usize) -> u32 {
    v as u32
}

/// Flattens a palette into `[r, g, b, weight, …]`.
fn flatten(palette: &[PaletteColor]) -> Vec<f64> {
    palette
        .iter()
        .flat_map(|p| [p.color.r, p.color.g, p.color.b, f64::from(p.weight)])
        .collect()
}

fn unflatten_rgb(rgb: &[f64]) -> Vec<Rgb> {
    rgb.as_chunks::<3>()
        .0
        .iter()
        .map(|c| Rgb {
            r: c[0],
            g: c[1],
            b: c[2],
        })
        .collect()
}

/// A palette waiting to be redrawn; `tolerance` is `None` for the cluster
/// search, which has none.
struct FoundPalette {
    tolerance: Option<f64>,
    colors: Vec<PaletteColor>,
}

#[wasm_bindgen]
pub struct RedrawResult {
    tolerance: Option<f64>,
    palette: Vec<f64>,
    rgba: Vec<u8>,
}

#[wasm_bindgen]
impl RedrawResult {
    /// The grouping tolerance, or `undefined` for the cluster search.
    #[wasm_bindgen(getter)]
    pub fn tolerance(&self) -> Option<f64> {
        self.tolerance
    }

    /// `[r, g, b, weight, …]` with channels in `[0, 1]`.
    #[wasm_bindgen(getter)]
    pub fn palette(&self) -> Vec<f64> {
        self.palette.clone()
    }

    /// Row-major RGBA bytes.
    #[wasm_bindgen(getter)]
    pub fn rgba(&self) -> Vec<u8> {
        self.rgba.clone()
    }
}

/// One image downsampled for one target size.
#[wasm_bindgen]
pub struct Downsampled {
    step: usize,
    pixels: Pixels,
}

#[wasm_bindgen]
impl Downsampled {
    #[wasm_bindgen(getter)]
    pub fn step(&self) -> u32 {
        to_u32(self.step)
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        to_u32(self.pixels.width)
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        to_u32(self.pixels.height)
    }

    /// `[r, g, b, …]` column-major, for `Engine.fromDownsampled`.
    #[wasm_bindgen(getter)]
    pub fn rgb(&self) -> Vec<f64> {
        self.pixels.to_rgb()
    }
}

/// Downsamples row-major straight-alpha 16-bit samples for one target size.
#[wasm_bindgen]
pub fn downsample(
    rgba: &[u16],
    width: u32,
    height: u32,
    target_size: u32,
) -> Result<Downsampled, JsError> {
    let (step, pixels) = crate::downsample(
        rgba,
        to_usize(width),
        to_usize(height),
        to_usize(target_size),
    )
    .map_err(js_err)?;
    Ok(Downsampled { step, pixels })
}

#[wasm_bindgen]
pub struct Engine {
    session: Session,
    palettes: Vec<FoundPalette>,
    redraw: Option<(RedrawMethod, usize, RedrawDeduper)>,
}

#[wasm_bindgen]
impl Engine {
    /// A session on an image `downsample` produced; `rgb` is its
    /// `Downsampled.rgb`.
    #[wasm_bindgen(js_name = fromDownsampled)]
    pub fn from_downsampled(
        step: u32,
        width: u32,
        height: u32,
        rgb: &[f64],
    ) -> Result<Engine, JsError> {
        let pixels = Pixels::from_rgb(to_usize(width), to_usize(height), rgb).map_err(js_err)?;
        Ok(Engine {
            session: Session::from_downsampled(to_usize(step), pixels),
            palettes: Vec::new(),
            redraw: None,
        })
    }

    #[wasm_bindgen(getter)]
    pub fn step(&self) -> u32 {
        to_u32(self.session.step())
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        to_u32(self.session.pixels().width)
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        to_u32(self.session.pixels().height)
    }

    #[wasm_bindgen(js_name = uniqueColors)]
    pub fn unique_colors(&mut self) -> u32 {
        to_u32(self.session.unique_colors())
    }

    /// Runs the tolerance search for one palette method and keeps its
    /// palettes for `beginRedraw`. Returns how many palettes were found.
    pub fn search(
        &mut self,
        method: &str,
        threshold: f64,
        palette_count: u32,
        tolerance: f64,
        increment: f64,
        max_images: u32,
    ) -> Result<u32, JsError> {
        let method = PaletteMethod::parse(method, threshold).map_err(js_err)?;
        let params = SearchParams {
            palette_count: to_usize(palette_count),
            max_results: to_usize(max_images),
            tolerance,
            increment,
        };
        self.palettes = self
            .session
            .find_palettes(method, &params)
            .map_err(js_err)?
            .into_iter()
            .map(|it| FoundPalette {
                tolerance: Some(it.tolerance),
                colors: it.colors,
            })
            .collect();
        self.redraw = None;
        Ok(to_u32(self.palettes.len()))
    }

    /// Runs the cluster search for one palette method and keeps its palette
    /// for `beginRedraw`. Returns how many palettes were found: always 1.
    pub fn cluster(
        &mut self,
        method: &str,
        threshold: f64,
        palette_count: u32,
    ) -> Result<u32, JsError> {
        let method = PaletteMethod::parse(method, threshold).map_err(js_err)?;
        let colors = self
            .session
            .cluster_palette(method, to_usize(palette_count))
            .map_err(js_err)?;
        self.palettes = vec![FoundPalette {
            tolerance: None,
            colors,
        }];
        self.redraw = None;
        Ok(1)
    }

    /// Starts redrawing the last search's palettes with one distance method.
    #[wasm_bindgen(js_name = beginRedraw)]
    pub fn begin_redraw(&mut self, method: &str) -> Result<(), JsError> {
        let method = RedrawMethod::parse(method).map_err(js_err)?;
        self.redraw = Some((method, 0, RedrawDeduper::default()));
        Ok(())
    }

    /// The next redraw that differs from all earlier ones since
    /// `beginRedraw`, or `undefined` when none are left.
    #[wasm_bindgen(js_name = nextRedraw)]
    pub fn next_redraw(&mut self) -> Result<Option<RedrawResult>, JsError> {
        let Some((method, cursor, dedupe)) = self.redraw.as_mut() else {
            return Err(JsError::new("beginRedraw must be called first"));
        };
        while let Some(it) = self.palettes.get(*cursor) {
            *cursor += 1;
            let colors = crate::palette_colors(&it.colors);
            let pixels =
                crate::redraw_with(self.session.pixels(), &colors, *method).map_err(js_err)?;
            if dedupe.insert(&pixels) {
                return Ok(Some(RedrawResult {
                    tolerance: it.tolerance,
                    palette: flatten(&it.colors),
                    rgba: pixels.to_rgba8(),
                }));
            }
        }
        Ok(None)
    }

    /// Redraws with a caller-supplied palette given as `[r, g, b, …]`.
    #[wasm_bindgen(js_name = redrawWith)]
    pub fn redraw_with(&self, palette_rgb: &[f64], method: &str) -> Result<Vec<u8>, JsError> {
        let method = RedrawMethod::parse(method).map_err(js_err)?;
        let pixels = crate::redraw_with(self.session.pixels(), &unflatten_rgb(palette_rgb), method)
            .map_err(js_err)?;
        Ok(pixels.to_rgba8())
    }
}

/// Every distinct color of a palette image as `[r, g, b, weight, …]`.
#[wasm_bindgen(js_name = extractImagePalette)]
pub fn extract_image_palette(rgba: &[u16], width: u32, height: u32) -> Result<Vec<f64>, JsError> {
    let palette =
        crate::extract_image_palette(rgba, to_usize(width), to_usize(height)).map_err(js_err)?;
    Ok(flatten(&palette))
}

#[wasm_bindgen]
pub struct DecodedPng {
    width: u32,
    height: u32,
    rgba: Vec<u16>,
}

#[wasm_bindgen]
impl DecodedPng {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }

    /// Row-major straight-alpha 16-bit RGBA samples.
    #[wasm_bindgen(getter)]
    pub fn rgba(&self) -> Vec<u16> {
        self.rgba.clone()
    }
}

/// Decodes a PNG exactly, without the browser's alpha premultiplication.
#[wasm_bindgen(js_name = decodePng)]
pub fn decode_png(bytes: &[u8]) -> Result<DecodedPng, JsError> {
    let image = crate::decode::decode_png(bytes).map_err(js_err)?;
    Ok(DecodedPng {
        width: to_u32(image.width),
        height: to_u32(image.height),
        rgba: image.rgba,
    })
}

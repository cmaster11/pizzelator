//! Pixel-art engine: downsamples an image, searches for palettes with an
//! exact number of colors and redraws the image with them.

pub mod cluster;
pub mod color;
pub mod decode;
pub mod error;
pub mod image;
pub mod optimizer;
pub mod palette;
pub mod redraw;
#[cfg(target_arch = "wasm32")]
mod wasm;

use std::collections::HashMap;
use std::rc::Rc;

use error::EngineError;
use image::Pixels;
use optimizer::{GroupCache, PaletteIteration, SearchParams};
use palette::{ColorEntry, LightnessBound, PaletteColor, PaletteMethod};
use redraw::RedrawMethod;

struct Analysis {
    entries: Vec<ColorEntry>,
    bound: LightnessBound,
    cache: GroupCache,
    /// Cluster search groupings by palette count.
    clusters: HashMap<usize, Rc<Vec<Vec<usize>>>>,
}

/// One input image downsampled for one target size. Palette searches on the
/// same session share their color groupings.
pub struct Session {
    step: usize,
    pixels: Pixels,
    analysis: Option<Analysis>,
}

impl Session {
    pub fn new(
        rgba: &[u16],
        width: usize,
        height: usize,
        target_size: usize,
    ) -> Result<Self, EngineError> {
        let src = image::Rgba16::new(rgba, width, height)?;
        let step = image::step_for_target(width, height, target_size)?;
        Ok(Self {
            step,
            pixels: image::quantize(&src, step),
            analysis: None,
        })
    }

    pub fn step(&self) -> usize {
        self.step
    }

    pub fn pixels(&self) -> &Pixels {
        &self.pixels
    }

    fn analysis(&mut self) -> &mut Analysis {
        let pixels = &self.pixels;
        self.analysis.get_or_insert_with(|| {
            let entries = palette::color_weights(pixels);
            let bound = LightnessBound::new(&entries);
            Analysis {
                entries,
                bound,
                cache: GroupCache::default(),
                clusters: HashMap::new(),
            }
        })
    }

    /// Distinct colors after merging near-identical ones.
    pub fn unique_colors(&mut self) -> usize {
        self.analysis().entries.len()
    }

    pub fn find_palettes(
        &mut self,
        method: PaletteMethod,
        params: &SearchParams,
    ) -> Result<Vec<PaletteIteration>, EngineError> {
        let a = self.analysis();
        optimizer::find_palettes(&a.entries, &a.bound, &mut a.cache, method, params)
    }

    /// The cluster search: one palette of exactly `palette_count` colors. The
    /// clustering does not depend on the palette method, so it is computed
    /// once per palette count.
    pub fn cluster_palette(
        &mut self,
        method: PaletteMethod,
        palette_count: usize,
    ) -> Result<Vec<PaletteColor>, EngineError> {
        let a = self.analysis();
        let groups = match a.clusters.get(&palette_count) {
            Some(groups) => Rc::clone(groups),
            None => {
                let groups = Rc::new(cluster::cluster_colors(&a.entries, palette_count)?);
                a.clusters.insert(palette_count, Rc::clone(&groups));
                groups
            }
        };
        Ok(palette::group_palette(&a.entries, &groups, method))
    }
}

/// Deduplicates redraws by their 8-bit pixels, keeping the first of each.
#[derive(Default)]
pub struct RedrawDeduper {
    seen: Vec<Vec<u8>>,
}

impl RedrawDeduper {
    /// Returns `true` when `pixels` has not been seen before.
    pub fn insert(&mut self, pixels: &Pixels) -> bool {
        let key = redraw::rgb255_key(pixels);
        if self.seen.contains(&key) {
            return false;
        }
        self.seen.push(key);
        true
    }
}

pub fn palette_colors(palette: &[PaletteColor]) -> Vec<color::Rgb> {
    palette.iter().map(|p| p.color).collect()
}

/// Every distinct color of a palette image (colors under 0.01 CIEDE2000
/// apart count as one), sorted by pixel count.
pub fn extract_image_palette(
    rgba: &[u16],
    width: usize,
    height: usize,
) -> Result<Vec<PaletteColor>, EngineError> {
    let pixels = Pixels::from_rgba16(rgba, width, height)?;
    let entries = palette::exact_color_weights(&pixels);
    let groups: Vec<Vec<usize>> = (0..entries.len()).map(|i| vec![i]).collect();
    Ok(palette::extract_palette(
        &entries,
        &groups,
        PaletteMethod::HsluvSatDist(0.0),
    ))
}

pub fn redraw_with(
    pixels: &Pixels,
    palette: &[color::Rgb],
    method: RedrawMethod,
) -> Result<Pixels, EngineError> {
    redraw::redraw(pixels, palette, method)
}

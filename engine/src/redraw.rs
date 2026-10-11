//! Redrawing an image with the nearest palette colors.

use crate::color::{self, Lab, Luv, Rgb};
use crate::error::EngineError;
use crate::image::Pixels;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RedrawMethod {
    Luv,
    Ciede2000,
    Rgb,
    Lab,
    Cie94,
}

impl RedrawMethod {
    pub fn parse(id: &str) -> Result<Self, EngineError> {
        match id {
            "luv" => Ok(Self::Luv),
            "cie2000" => Ok(Self::Ciede2000),
            "rgb" => Ok(Self::Rgb),
            "lab" => Ok(Self::Lab),
            "cie94" => Ok(Self::Cie94),
            other => Err(EngineError::UnknownRedrawMethod(other.to_owned())),
        }
    }
}

/// A color in the space a redraw method measures distance in.
#[derive(Clone, Copy)]
enum Coords {
    Rgb(Rgb),
    Lab(Lab),
    Luv(Luv),
}

fn coords(method: RedrawMethod, c: Rgb) -> Coords {
    match method {
        RedrawMethod::Rgb => Coords::Rgb(c),
        RedrawMethod::Luv => Coords::Luv(c.luv()),
        RedrawMethod::Lab | RedrawMethod::Ciede2000 | RedrawMethod::Cie94 => Coords::Lab(c.lab()),
    }
}

fn distance(method: RedrawMethod, palette: Coords, src: Coords) -> f64 {
    match (palette, src) {
        (Coords::Rgb(p), Coords::Rgb(s)) => color::distance_rgb(p, s),
        (Coords::Luv(p), Coords::Luv(s)) => color::distance_luv(p, s),
        (Coords::Lab(p), Coords::Lab(s)) => match method {
            RedrawMethod::Ciede2000 => color::distance_ciede2000(p, s),
            RedrawMethod::Cie94 => color::distance_cie94(p, s),
            _ => color::distance_lab(p, s),
        },
        _ => unreachable!("palette and source coordinates come from the same method"),
    }
}

/// Replaces every pixel with its nearest palette color; the earliest palette
/// color wins ties.
pub fn redraw(
    pixels: &Pixels,
    palette: &[Rgb],
    method: RedrawMethod,
) -> Result<Pixels, EngineError> {
    if palette.is_empty() {
        return Err(EngineError::EmptyPalette);
    }
    let targets: Vec<(Rgb, Coords)> = palette.iter().map(|&c| (c, coords(method, c))).collect();
    let data = pixels
        .data
        .iter()
        .map(|&src| {
            let src = coords(method, src);
            let mut best = (999999.0, targets[0].0);
            for &(c, p) in &targets {
                let d = distance(method, p, src);
                if d < best.0 {
                    best = (d, c);
                }
            }
            best.1
        })
        .collect();
    Ok(Pixels {
        width: pixels.width,
        height: pixels.height,
        data,
    })
}

/// The duplicate-detection key: go-colorful's `RGB255` of every pixel.
pub fn rgb255_key(pixels: &Pixels) -> Vec<u8> {
    pixels.data.iter().flat_map(|c| c.rgb255()).collect()
}

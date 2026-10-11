//! Column-major pixel grids and the blur-and-downsample quantizer.

use crate::color::Rgb;
use crate::error::EngineError;

/// Pixels stored column-major (`x * height + y`), the iteration order that
/// palette extraction depends on.
#[derive(Clone, Debug)]
pub struct Pixels {
    pub width: usize,
    pub height: usize,
    pub data: Vec<Rgb>,
}

impl Pixels {
    /// Builds a grid from row-major straight-alpha 16-bit RGBA samples.
    pub fn from_rgba16(rgba: &[u16], width: usize, height: usize) -> Result<Self, EngineError> {
        if width == 0 || height == 0 || rgba.len() != width * height * 4 {
            return Err(EngineError::InvalidImage {
                width,
                height,
                samples: rgba.len(),
            });
        }
        let mut data = Vec::with_capacity(width * height);
        for x in 0..width {
            for y in 0..height {
                let i = (y * width + x) * 4;
                data.push(Rgb::from_rgba16(
                    rgba[i],
                    rgba[i + 1],
                    rgba[i + 2],
                    rgba[i + 3],
                ));
            }
        }
        Ok(Self {
            width,
            height,
            data,
        })
    }

    pub fn at(&self, x: usize, y: usize) -> Rgb {
        self.data[x * self.height + y]
    }

    /// Row-major opaque RGBA bytes.
    pub fn to_rgba8(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(self.width * self.height * 4);
        for y in 0..self.height {
            for x in 0..self.width {
                let [r, g, b] = self.at(x, y).to_rgb8();
                out.extend_from_slice(&[r, g, b, 255]);
            }
        }
        out
    }
}

/// Block size that brings the shorter side down to about `target` pixels,
/// bumped to an odd number so the blur kernel has a center.
pub fn step_for_target(width: usize, height: usize, target: usize) -> Result<usize, EngineError> {
    let min_side = width.min(height);
    if target == 0 || target > min_side {
        return Err(EngineError::InvalidTargetSize { target, min_side });
    }
    let mut step = min_side.div_ceil(target);
    if step.is_multiple_of(2) {
        step += 1;
    }
    Ok(step)
}

/// Trims the image to a multiple of `step`, box-blurs it with a `step`-sized
/// kernel and keeps one sample per block.
///
/// The kernel is centered on each block's top-left pixel and clamps at the
/// edges.
pub fn quantize(src: &Pixels, step: usize) -> Pixels {
    let width = src.width - src.width % step;
    let height = src.height - src.height % step;
    if step <= 1 {
        let mut data = Vec::with_capacity(width * height);
        for x in 0..width {
            for y in 0..height {
                data.push(src.at(x, y));
            }
        }
        return Pixels {
            width,
            height,
            data,
        };
    }

    #[allow(clippy::cast_precision_loss)]
    let k = 1.0 / (step * step) as f64;
    let offset = step / 2;
    let clamp = |v: usize, max: usize| v.saturating_sub(offset).min(max - 1);
    let (out_w, out_h) = (width / step, height / step);
    let mut data = Vec::with_capacity(out_w * out_h);
    for bx in 0..out_w {
        for by in 0..out_h {
            let (x, y) = (bx * step, by * step);
            let (mut r, mut g, mut b) = (0.0, 0.0, 0.0);
            for a in 0..step {
                let xn = clamp(x + a, width);
                for c in 0..step {
                    let px = src.at(xn, clamp(y + c, height));
                    r += px.r * k;
                    g += px.g * k;
                    b += px.b * k;
                }
            }
            data.push(Rgb { r, g, b });
        }
    }
    Pixels {
        width: out_w,
        height: out_h,
        data,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn step_is_odd_and_rejects_oversized_targets() {
        assert_eq!(step_for_target(245, 184, 64), Ok(3));
        assert_eq!(step_for_target(1280, 720, 90), Ok(9));
        assert_eq!(step_for_target(100, 100, 50), Ok(3));
        assert!(step_for_target(100, 50, 51).is_err());
        assert!(step_for_target(100, 50, 0).is_err());
    }

    #[test]
    fn quantize_of_uniform_image_is_uniform() {
        let pixel = [10 * 257, 200 * 257, 30 * 257, 65535];
        let rgba: Vec<u16> = std::iter::repeat_n(pixel, 30 * 20).flatten().collect();
        let px = Pixels::from_rgba16(&rgba, 30, 20).unwrap();
        let q = quantize(&px, 3);
        assert_eq!((q.width, q.height), (10, 6));
        let expected = Rgb::from_rgba16(pixel[0], pixel[1], pixel[2], pixel[3]).to_rgb8();
        assert!(q.data.iter().all(|c| c.to_rgb8() == expected));
    }
}

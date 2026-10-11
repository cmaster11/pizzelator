//! Column-major pixel grids and the blur-and-downsample quantizer.

use crate::color::Rgb;
use crate::error::EngineError;

/// A grid the quantizer reads one pixel at a time.
pub trait Grid {
    fn width(&self) -> usize;
    fn height(&self) -> usize;
    fn at(&self, x: usize, y: usize) -> Rgb;
}

/// Row-major straight-alpha 16-bit RGBA, converted pixel by pixel as it is
/// read. A full-size input is downsampled through this view, so it never
/// exists as a grid of `f64` colors: a 12-megapixel photo stays at its 8 bytes
/// per pixel instead of growing by 288 MB in every worker.
pub struct Rgba16<'a> {
    rgba: &'a [u16],
    width: usize,
    height: usize,
}

impl<'a> Rgba16<'a> {
    pub fn new(rgba: &'a [u16], width: usize, height: usize) -> Result<Self, EngineError> {
        if width == 0 || height == 0 || rgba.len() != width * height * 4 {
            return Err(EngineError::InvalidImage {
                width,
                height,
                samples: rgba.len(),
            });
        }
        Ok(Self {
            rgba,
            width,
            height,
        })
    }
}

impl Grid for Rgba16<'_> {
    fn width(&self) -> usize {
        self.width
    }

    fn height(&self) -> usize {
        self.height
    }

    fn at(&self, x: usize, y: usize) -> Rgb {
        let i = (y * self.width + x) * 4;
        Rgb::from_rgba16(
            self.rgba[i],
            self.rgba[i + 1],
            self.rgba[i + 2],
            self.rgba[i + 3],
        )
    }
}

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
        let src = Rgba16::new(rgba, width, height)?;
        let mut data = Vec::with_capacity(width * height);
        for x in 0..width {
            for y in 0..height {
                data.push(src.at(x, y));
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

    /// The colors as `[r, g, b, …]` in storage (column-major) order, for
    /// handing a downsampled image to another worker bit for bit.
    pub fn to_rgb(&self) -> Vec<f64> {
        self.data.iter().flat_map(|c| [c.r, c.g, c.b]).collect()
    }

    /// The inverse of `to_rgb`.
    pub fn from_rgb(width: usize, height: usize, rgb: &[f64]) -> Result<Self, EngineError> {
        if width == 0 || height == 0 || rgb.len() != width * height * 3 {
            return Err(EngineError::InvalidDownsampled {
                width,
                height,
                values: rgb.len(),
            });
        }
        let data = rgb
            .as_chunks::<3>()
            .0
            .iter()
            .map(|c| Rgb {
                r: c[0],
                g: c[1],
                b: c[2],
            })
            .collect();
        Ok(Self {
            width,
            height,
            data,
        })
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

impl Grid for Pixels {
    fn width(&self) -> usize {
        self.width
    }

    fn height(&self) -> usize {
        self.height
    }

    fn at(&self, x: usize, y: usize) -> Rgb {
        Pixels::at(self, x, y)
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
pub fn quantize(src: &impl Grid, step: usize) -> Pixels {
    let width = src.width() - src.width() % step;
    let height = src.height() - src.height() % step;
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

    /// Deterministic varied samples, including partial and zero alpha.
    fn samples(width: usize, height: usize) -> Vec<u16> {
        (0..width * height * 4)
            .map(|i| {
                #[allow(clippy::cast_possible_truncation)]
                let v = (i.wrapping_mul(2_654_435_761) >> 7) as u16;
                v
            })
            .collect()
    }

    #[test]
    fn quantizing_the_rgba16_view_matches_the_converted_grid_bit_for_bit() {
        // The view converts each pixel when it is read; the grid converts them
        // all up front. Both must give the quantizer identical values.
        // fails-when: the view reads a different pixel, channel or row order.
        for (width, height) in [(30, 20), (31, 22), (7, 45)] {
            let rgba = samples(width, height);
            let view = Rgba16::new(&rgba, width, height).unwrap();
            let grid = Pixels::from_rgba16(&rgba, width, height).unwrap();
            for step in [1, 3, 5] {
                let (a, b) = (quantize(&view, step), quantize(&grid, step));
                assert_eq!((a.width, a.height), (b.width, b.height));
                let bits = |p: &Pixels| -> Vec<u64> {
                    p.data
                        .iter()
                        .flat_map(|c| [c.r.to_bits(), c.g.to_bits(), c.b.to_bits()])
                        .collect()
                };
                assert_eq!(bits(&a), bits(&b), "{width}x{height} step {step}");
            }
        }
    }

    #[test]
    fn rgb_round_trip_is_bit_exact_and_checks_its_length() {
        let rgba = samples(9, 7);
        let px = Pixels::from_rgba16(&rgba, 9, 7).unwrap();
        let back = Pixels::from_rgb(9, 7, &px.to_rgb()).unwrap();
        // fails-when: the flattening reorders pixels or channels.
        assert_eq!(back.to_rgb(), px.to_rgb());
        assert_eq!((back.width, back.height), (9, 7));
        assert!(Pixels::from_rgb(9, 7, &px.to_rgb()[3..]).is_err());
        assert!(Pixels::from_rgb(0, 7, &[]).is_err());
    }

    #[test]
    fn rgba16_view_rejects_a_mismatched_buffer() {
        assert!(Rgba16::new(&[0; 15], 2, 2).is_err());
        assert!(Rgba16::new(&[], 0, 0).is_err());
        assert!(Rgba16::new(&[0; 16], 2, 2).is_ok());
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

//! PNG decoding to straight-alpha 16-bit RGBA, as the golden fixtures expect:
//! no gamma or color-profile handling, 8-bit samples widened by 257.

use crate::error::EngineError;

pub struct DecodedImage {
    pub width: usize,
    pub height: usize,
    /// Row-major RGBA samples.
    pub rgba: Vec<u16>,
}

fn err(e: impl std::fmt::Display) -> EngineError {
    EngineError::InvalidPng(e.to_string())
}

pub fn decode_png(bytes: &[u8]) -> Result<DecodedImage, EngineError> {
    let mut decoder = png::Decoder::new(std::io::Cursor::new(bytes));
    decoder.set_transformations(png::Transformations::EXPAND);
    let mut reader = decoder.read_info().map_err(err)?;
    let mut buf = vec![0; reader.output_buffer_size()];
    let info = reader.next_frame(&mut buf).map_err(err)?;
    let (width, height) = (info.width as usize, info.height as usize);
    let buf = &buf[..info.buffer_size()];

    let samples: Vec<u16> = match info.bit_depth {
        png::BitDepth::Sixteen => buf
            .as_chunks::<2>()
            .0
            .iter()
            .map(|b| u16::from_be_bytes(*b))
            .collect(),
        png::BitDepth::Eight => buf.iter().map(|&v| u16::from(v) * 257).collect(),
        other => {
            return Err(err(format!(
                "unexpected bit depth {other:?} after expansion"
            )));
        }
    };
    let rgba = match info.color_type {
        png::ColorType::Rgba => samples,
        png::ColorType::Rgb => samples
            .as_chunks::<3>()
            .0
            .iter()
            .flat_map(|p| [p[0], p[1], p[2], u16::MAX])
            .collect(),
        png::ColorType::GrayscaleAlpha => samples
            .as_chunks::<2>()
            .0
            .iter()
            .flat_map(|p| [p[0], p[0], p[0], p[1]])
            .collect(),
        png::ColorType::Grayscale => samples.iter().flat_map(|&v| [v, v, v, u16::MAX]).collect(),
        png::ColorType::Indexed => return Err(err("indexed color was not expanded")),
    };
    Ok(DecodedImage {
        width,
        height,
        rgba,
    })
}

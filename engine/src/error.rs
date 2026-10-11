use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub enum EngineError {
    InvalidImage {
        width: usize,
        height: usize,
        samples: usize,
    },
    InvalidPng(String),
    InvalidTargetSize {
        target: usize,
        min_side: usize,
    },
    InvalidThreshold(f64),
    InvalidParameter(&'static str),
    UnknownPaletteMethod(String),
    UnknownRedrawMethod(String),
    NotEnoughColors {
        unique: usize,
        requested: usize,
    },
    NoPaletteFound {
        requested: usize,
    },
    EmptyPalette,
}

impl fmt::Display for EngineError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidImage {
                width,
                height,
                samples,
            } => write!(
                f,
                "invalid image: {width}x{height} needs {} RGBA samples, got {samples}",
                width * height * 4
            ),
            Self::InvalidPng(reason) => write!(f, "could not decode PNG: {reason}"),
            Self::InvalidTargetSize { target, min_side } => write!(
                f,
                "target size {target} must be between 1 and the image's shorter side ({min_side}px)"
            ),
            Self::InvalidThreshold(t) => write!(f, "threshold {t} must be between 0 and 1"),
            Self::InvalidParameter(name) => write!(f, "invalid parameter: {name}"),
            Self::UnknownPaletteMethod(m) => write!(f, "unknown palette method: {m}"),
            Self::UnknownRedrawMethod(m) => write!(f, "unknown redraw method: {m}"),
            Self::NotEnoughColors { unique, requested } => write!(
                f,
                "the downscaled image has {unique} distinct colors, fewer than the {requested} requested"
            ),
            Self::NoPaletteFound { requested } => write!(
                f,
                "no tolerance yields exactly {requested} colors; try another palette size or increment"
            ),
            Self::EmptyPalette => write!(f, "palette has no colors"),
        }
    }
}

impl std::error::Error for EngineError {}

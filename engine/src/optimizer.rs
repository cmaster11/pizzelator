//! Tolerance search for palettes with an exact number of colors.

use std::collections::HashMap;
use std::rc::Rc;

use crate::error::EngineError;
use crate::palette::{self, ColorEntry, LightnessBound, PaletteColor, PaletteMethod};

/// Stops the search once the step can no longer move the tolerance in a
/// meaningful way, which happens when no tolerance yields the exact count.
const MIN_TOLERANCE_STEP: f64 = 1e-10;
const MAX_ITERATIONS: usize = 10_000;

#[derive(Clone, Copy, Debug)]
pub struct SearchParams {
    pub palette_count: usize,
    pub max_results: usize,
    pub tolerance: f64,
    pub increment: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct PaletteIteration {
    pub tolerance: f64,
    pub colors: Vec<PaletteColor>,
}

/// Groupings by tolerance. Grouping does not depend on the palette method,
/// so one cache serves every method run on the same image.
#[derive(Default)]
pub struct GroupCache {
    groups: HashMap<u64, Rc<Vec<Vec<usize>>>>,
}

impl GroupCache {
    fn get(
        &mut self,
        entries: &[ColorEntry],
        bound: &LightnessBound,
        tolerance: f64,
    ) -> Rc<Vec<Vec<usize>>> {
        Rc::clone(
            self.groups
                .entry(tolerance.to_bits())
                .or_insert_with(|| Rc::new(palette::group_colors(entries, bound, tolerance))),
        )
    }
}

fn validate(params: &SearchParams, unique: usize) -> Result<(), EngineError> {
    if params.palette_count == 0 {
        return Err(EngineError::InvalidParameter(
            "palette count must be at least 1",
        ));
    }
    if params.max_results == 0 {
        return Err(EngineError::InvalidParameter(
            "max images must be at least 1",
        ));
    }
    if !(params.tolerance.is_finite() && params.tolerance >= 0.0) {
        return Err(EngineError::InvalidParameter(
            "tolerance must be zero or positive",
        ));
    }
    if !(params.increment.is_finite() && params.increment > 0.0) {
        return Err(EngineError::InvalidParameter("increment must be positive"));
    }
    if unique < params.palette_count {
        return Err(EngineError::NotEnoughColors {
            unique,
            requested: params.palette_count,
        });
    }
    Ok(())
}

/// Walks the tolerance upward from `params.tolerance` and collects up to
/// `params.max_results` consecutive palettes with exactly
/// `params.palette_count` colors. Overshooting halves the step and restarts
/// from the last tolerance that still had too many colors.
///
/// When the search gives up, it returns the palettes found so far, or an
/// error when there are none.
pub fn find_palettes(
    entries: &[ColorEntry],
    bound: &LightnessBound,
    cache: &mut GroupCache,
    method: PaletteMethod,
    params: &SearchParams,
) -> Result<Vec<PaletteIteration>, EngineError> {
    validate(params, entries.len())?;
    #[allow(clippy::cast_precision_loss)]
    let count_f = params.palette_count as f64;
    let mut valid: Vec<PaletteIteration> = Vec::new();
    let mut tolerance = params.tolerance;
    let mut min_valid = params.tolerance;
    let mut step = params.increment;

    for _ in 0..MAX_ITERATIONS {
        if step < MIN_TOLERANCE_STEP {
            break;
        }
        let groups = cache.get(entries, bound, tolerance);
        let colors = palette::extract_palette(entries, &groups, method);
        let found = colors.len();
        if found == params.palette_count {
            valid.push(PaletteIteration { tolerance, colors });
            if valid.len() >= params.max_results {
                return Ok(valid);
            }
            tolerance += step;
        } else if found > params.palette_count {
            min_valid = tolerance;
            valid.clear();
            #[allow(clippy::cast_precision_loss)]
            let found_f = found as f64;
            if found_f > count_f * 1.5 {
                tolerance += step.max(step * found_f / (count_f * 1.5));
            } else {
                tolerance += step;
            }
        } else {
            step /= 2.0;
            tolerance = min_valid;
        }
    }

    if valid.is_empty() {
        Err(EngineError::NoPaletteFound {
            requested: params.palette_count,
        })
    } else {
        Ok(valid)
    }
}

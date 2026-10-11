//! Color weighting, tolerance grouping and palette extraction.

use std::cmp::Ordering;
use std::collections::HashMap;

use crate::color::{self, Lab, Rgb};
use crate::error::EngineError;
use crate::image::Pixels;

/// A distinct color with its precomputed color-space coordinates and the
/// number of pixels it stands for.
#[derive(Clone, Debug)]
pub struct ColorEntry {
    pub color: Rgb,
    pub lab: Lab,
    pub weight: u32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PaletteColor {
    pub color: Rgb,
    pub weight: u32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum PaletteMethod {
    Weight,
    SquareWeight,
    Lab,
    HclDist(f64),
    HsluvSat(f64),
    HsluvSatDist(f64),
}

impl PaletteMethod {
    pub fn parse(id: &str, threshold: f64) -> Result<Self, EngineError> {
        let needs_threshold = |m: fn(f64) -> Self| {
            if (0.0..=1.0).contains(&threshold) {
                Ok(m(threshold))
            } else {
                Err(EngineError::InvalidThreshold(threshold))
            }
        };
        match id {
            "w" => Ok(Self::Weight),
            "sqQ" => Ok(Self::SquareWeight),
            "lab" => Ok(Self::Lab),
            "hcld" => needs_threshold(Self::HclDist),
            "ls" => needs_threshold(Self::HsluvSat),
            "lsd" => needs_threshold(Self::HsluvSatDist),
            other => Err(EngineError::UnknownPaletteMethod(other.to_owned())),
        }
    }
}

/// `a < b` as a total order: values neither less than the other are equal.
fn cmp_lt(a: f64, b: f64) -> Ordering {
    if a < b {
        Ordering::Less
    } else if b < a {
        Ordering::Greater
    } else {
        Ordering::Equal
    }
}

/// Rounds a sort key so floating-point noise from different math libraries
/// cannot reorder colors (gamut-edge saturations compute as 1.0 ± 1e-15).
fn sort_key(v: f64) -> f64 {
    (v * 1e9).round() / 1e9
}

fn hsluv_sat_key(c: Rgb) -> (f64, f64) {
    let (s, l) = c.hsluv_sl();
    (sort_key(s), sort_key(l))
}

fn hsluv_sat_cmp(a: (f64, f64), b: (f64, f64)) -> Ordering {
    cmp_lt(a.0, b.0).then_with(|| cmp_lt(a.1, b.1))
}

fn color_key(c: Rgb) -> [u64; 3] {
    [c.r.to_bits(), c.g.to_bits(), c.b.to_bits()]
}

/// Distinct colors in the order the golden fixtures pin: all pixels
/// column-major, stably sorted by HSLuv saturation then luminance, reversed.
/// Each color carries its pixel count.
fn visit_order(colors: &[Rgb]) -> Vec<(Rgb, u32)> {
    let mut ids: HashMap<[u64; 3], usize> = HashMap::new();
    let mut distinct: Vec<(Rgb, (f64, f64), u32)> = Vec::new();
    let mut per_pixel = Vec::with_capacity(colors.len());
    for &c in colors {
        let id = *ids.entry(color_key(c)).or_insert_with(|| {
            distinct.push((c, hsluv_sat_key(c), 0));
            distinct.len() - 1
        });
        distinct[id].2 += 1;
        per_pixel.push(id);
    }
    per_pixel.sort_by(|&a, &b| hsluv_sat_cmp(distinct[a].1, distinct[b].1));

    let mut seen = vec![false; distinct.len()];
    let mut out = Vec::with_capacity(distinct.len());
    for &id in per_pixel.iter().rev() {
        if !seen[id] {
            seen[id] = true;
            out.push((distinct[id].0, distinct[id].2));
        }
    }
    out
}

/// Merges near-identical colors into weighted entries, lightest-saturated
/// first, then sorts them by weight.
///
/// Identical colors always join the same entry, so the scan runs over
/// distinct colors and adds each one's pixel count at once.
fn weigh(visits: Vec<(Rgb, u32)>, same: impl Fn(&ColorEntry, Rgb, Lab) -> bool) -> Vec<ColorEntry> {
    let mut entries: Vec<ColorEntry> = Vec::new();
    for (c, count) in visits {
        let lab = c.lab();
        match entries.iter_mut().find(|e| same(e, c, lab)) {
            Some(e) => e.weight += count,
            None => entries.push(ColorEntry {
                color: c,
                lab,
                weight: count,
            }),
        }
    }
    entries.sort_by_key(|e| e.weight);
    entries
}

/// Weighted colors of a quantized image, merging colors within 1/255 RGB.
pub fn color_weights(pixels: &Pixels) -> Vec<ColorEntry> {
    weigh(visit_order(&pixels.data), |e, c, _| {
        c.almost_equal_rgb(e.color)
    })
}

/// Weighted colors of a palette image, merging colors under 0.01 CIEDE2000.
pub fn exact_color_weights(pixels: &Pixels) -> Vec<ColorEntry> {
    weigh(visit_order(&pixels.data), |e, _, lab| {
        color::distance_ciede2000(e.lab, lab) < 0.01
    })
}

/// The CIEDE2000 lightness lower bound for a set of entries: two colors whose
/// L differs by more than `tolerance * max_sl` cannot be within `tolerance`.
pub struct LightnessBound {
    max_sl: f64,
}

impl LightnessBound {
    pub fn new(entries: &[ColorEntry]) -> Self {
        let max_dist = entries
            .iter()
            .map(|e| (e.lab.l - 0.5).abs())
            .fold(0.0, f64::max);
        Self {
            max_sl: color::ciede2000_max_sl(max_dist),
        }
    }

    /// Half-width of the lightness window, with margin for rounding.
    fn window(&self, tolerance: f64) -> f64 {
        tolerance * self.max_sl * (1.0 + 1e-9) + 1e-12
    }
}

/// A group under construction, with its members also kept sorted by lightness.
struct Group {
    members: Vec<usize>,
    by_lightness: Vec<(f64, usize)>,
}

impl Group {
    fn new(entry: usize, l: f64) -> Self {
        Self {
            members: vec![entry],
            by_lightness: vec![(l, entry)],
        }
    }

    fn push(&mut self, entry: usize, l: f64) {
        self.members.push(entry);
        let at = self.by_lightness.partition_point(|&(m, _)| m < l);
        self.by_lightness.insert(at, (l, entry));
    }

    /// Whether any member is within `tolerance` of `lab`. Members are visited
    /// nearest lightness first; those outside the lightness window are skipped
    /// and those under the cheap upper bound are accepted without the full
    /// formula. Neither shortcut changes the answer.
    fn matches(&self, entries: &[ColorEntry], lab: Lab, limits: &Limits) -> bool {
        let in_window =
            |&(m, i): &(f64, usize)| ((m - lab.l).abs() <= limits.window).then_some((m, i));
        let mid = self.by_lightness.partition_point(|&(m, _)| m < lab.l);
        let (mut below, mut above) = (mid, mid);
        loop {
            let down = below
                .checked_sub(1)
                .and_then(|i| in_window(&self.by_lightness[i]));
            let up = self.by_lightness.get(above).and_then(in_window);
            let i = match (down, up) {
                (None, None) => return false,
                (Some((dm, di)), Some((um, _))) if lab.l - dm <= um - lab.l => {
                    below -= 1;
                    di
                }
                (Some((_, di)), None) => {
                    below -= 1;
                    di
                }
                (_, Some((_, ui))) => {
                    above += 1;
                    ui
                }
            };
            let other = entries[i].lab;
            if color::ciede2000_upper_bound_sq(lab, other) < limits.accept_sq
                || color::distance_ciede2000(lab, other) < limits.tolerance
            {
                return true;
            }
        }
    }
}

struct Limits {
    tolerance: f64,
    window: f64,
    accept_sq: f64,
}

/// Groups entries greedily: each entry joins the first group (in creation
/// order) holding any member within `tolerance` CIEDE2000, or starts a new
/// group. Members whose lightness alone puts them out of range are skipped,
/// which never changes the result.
pub fn group_colors(
    entries: &[ColorEntry],
    bound: &LightnessBound,
    tolerance: f64,
) -> Vec<Vec<usize>> {
    let limits = Limits {
        tolerance,
        window: bound.window(tolerance),
        accept_sq: color::sq(tolerance) * (1.0 - 1e-9),
    };
    let mut groups: Vec<Group> = Vec::new();
    for (p, entry) in entries.iter().enumerate() {
        match groups
            .iter_mut()
            .find(|g| g.matches(entries, entry.lab, &limits))
        {
            Some(g) => g.push(p, entry.lab.l),
            None => groups.push(Group::new(p, entry.lab.l)),
        }
    }
    groups.into_iter().map(|g| g.members).collect()
}

fn weighted_average(members: &[&ColorEntry], f: impl Fn(Rgb) -> [f64; 3]) -> [f64; 3] {
    let mut total = [0.0; 3];
    for e in members {
        let v = f(e.color);
        let w = f64::from(e.weight);
        for (t, x) in total.iter_mut().zip(v) {
            *t += x * w;
        }
    }
    total
}

fn pick_sorted(members: &[&ColorEntry], shift: f64, key: impl Fn(Rgb) -> (f64, f64)) -> Rgb {
    let mut keyed: Vec<(Rgb, (f64, f64))> =
        members.iter().map(|e| (e.color, key(e.color))).collect();
    keyed.sort_by(|a, b| hsluv_sat_cmp(a.1, b.1));
    #[allow(
        clippy::cast_precision_loss,
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss
    )]
    let idx = ((keyed.len() - 1) as f64 * shift) as usize;
    keyed[idx].0
}

fn representative(members: &[&ColorEntry], total_weight: u32, method: PaletteMethod) -> Rgb {
    let tw = f64::from(total_weight);
    match method {
        PaletteMethod::Weight => {
            let [r, g, b] = weighted_average(members, |c| [c.r, c.g, c.b]);
            Rgb {
                r: r / tw,
                g: g / tw,
                b: b / tw,
            }
        }
        PaletteMethod::SquareWeight => {
            let sq = |v: f64| color::split_pow(v, 2.0);
            let [r, g, b] = weighted_average(members, |c| [sq(c.r), sq(c.g), sq(c.b)]);
            Rgb {
                r: (r / tw).sqrt(),
                g: (g / tw).sqrt(),
                b: (b / tw).sqrt(),
            }
        }
        PaletteMethod::Lab => {
            let [l, a, b] = weighted_average(members, |c| {
                let lab = c.lab();
                [lab.l, (lab.a + 1.0) / 2.0, (lab.b + 1.0) / 2.0]
            });
            color::lab_to_rgb(Lab {
                l: l / tw,
                a: a / tw * 2.0 - 1.0,
                b: b / tw * 2.0 - 1.0,
            })
        }
        PaletteMethod::HclDist(shift) => pick_sorted(members, shift, |c| {
            let (ch, l) = c.hcl_cl();
            (sort_key(((ch + 1.0) / 2.0 + l).abs()), 0.0)
        }),
        PaletteMethod::HsluvSat(shift) => pick_sorted(members, shift, hsluv_sat_key),
        PaletteMethod::HsluvSatDist(shift) => pick_sorted(members, shift, |c| {
            let (s, l) = c.hsluv_sl();
            (sort_key((s + l).abs()), 0.0)
        }),
    }
}

/// One representative color per group, deduplicated by exact value (the
/// later group's weight wins), sorted by weight.
pub fn extract_palette(
    entries: &[ColorEntry],
    groups: &[Vec<usize>],
    method: PaletteMethod,
) -> Vec<PaletteColor> {
    let mut positions: HashMap<[u64; 3], usize> = HashMap::new();
    let mut palette: Vec<PaletteColor> = Vec::new();
    for group in groups {
        let members: Vec<&ColorEntry> = group.iter().map(|&i| &entries[i]).collect();
        let weight = members.iter().map(|e| e.weight).sum();
        let color = representative(&members, weight, method);
        match positions.get(&color_key(color)) {
            Some(&i) => palette[i].weight = weight,
            None => {
                positions.insert(color_key(color), palette.len());
                palette.push(PaletteColor { color, weight });
            }
        }
    }
    palette.sort_by_key(|p| p.weight);
    palette
}

/// One representative color per group, sorted by weight. Unlike
/// [`extract_palette`] it never merges equal colors, so the palette has
/// exactly one color per group.
pub fn group_palette(
    entries: &[ColorEntry],
    groups: &[Vec<usize>],
    method: PaletteMethod,
) -> Vec<PaletteColor> {
    let mut palette: Vec<PaletteColor> = groups
        .iter()
        .map(|group| {
            let members: Vec<&ColorEntry> = group.iter().map(|&i| &entries[i]).collect();
            let weight = members.iter().map(|e| e.weight).sum();
            PaletteColor {
                color: representative(&members, weight, method),
                weight,
            }
        })
        .collect();
    palette.sort_by_key(|p| p.weight);
    palette
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entries_from(colors: &[Rgb]) -> Vec<ColorEntry> {
        colors
            .iter()
            .map(|&color| ColorEntry {
                color,
                lab: color.lab(),
                weight: 1,
            })
            .collect()
    }

    /// The reference algorithm without the lightness index.
    fn group_colors_naive(entries: &[ColorEntry], tolerance: f64) -> Vec<Vec<usize>> {
        let mut groups: Vec<Vec<usize>> = Vec::new();
        for (p, e) in entries.iter().enumerate() {
            let found = groups.iter().position(|g| {
                g.iter()
                    .any(|&m| color::distance_ciede2000(e.lab, entries[m].lab) < tolerance)
            });
            match found {
                Some(g) => groups[g].push(p),
                None => groups.push(vec![p]),
            }
        }
        groups
    }

    #[test]
    fn indexed_grouping_matches_naive_grouping() {
        let colors: Vec<Rgb> = (0..600_u32)
            .map(|i| {
                let f = f64::from(i);
                Rgb {
                    r: (f * 0.618_034) % 1.0,
                    g: (f * 0.414_213) % 1.0,
                    b: (f * 0.732_050) % 1.0,
                }
            })
            .collect();
        let entries = entries_from(&colors);
        let bound = LightnessBound::new(&entries);
        let mut distinct_counts = Vec::new();
        for tolerance in [0.0, 0.01, 0.05, 0.1, 0.2, 0.4] {
            let fast = group_colors(&entries, &bound, tolerance);
            assert_eq!(
                fast,
                group_colors_naive(&entries, tolerance),
                "tolerance {tolerance}"
            );
            distinct_counts.push(fast.len());
        }
        distinct_counts.dedup();
        assert!(
            distinct_counts.len() >= 4,
            "tolerances must exercise different groupings"
        );
    }

    #[test]
    fn parse_rejects_unknown_methods_and_bad_thresholds() {
        assert_eq!(
            PaletteMethod::parse("lsd", 0.6),
            Ok(PaletteMethod::HsluvSatDist(0.6))
        );
        assert_eq!(PaletteMethod::parse("w", 7.0), Ok(PaletteMethod::Weight));
        assert!(PaletteMethod::parse("lsd", 1.5).is_err());
        assert!(PaletteMethod::parse("nope", 0.0).is_err());
    }
}

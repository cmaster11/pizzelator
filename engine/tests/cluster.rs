//! The cluster search on the sample image in `assets/`.

use std::fs;
use std::path::Path;

use pizzelator_engine::color;
use pizzelator_engine::decode::decode_png;
use pizzelator_engine::optimizer::SearchParams;
use pizzelator_engine::palette::{PaletteColor, PaletteMethod};
use pizzelator_engine::redraw::RedrawMethod;
use pizzelator_engine::{Session, palette_colors, redraw_with};

const IMAGE: &str = "pizza.png";
/// Small to large, so the colors to cluster range from about 1700 to 6000.
const TARGETS: [usize; 3] = [48, 64, 100];

fn session(image: &str, target: usize) -> Session {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../assets")
        .join(image);
    let decoded = decode_png(&fs::read(path).unwrap()).unwrap();
    Session::new(&decoded.rgba, decoded.width, decoded.height, target).unwrap()
}

/// Mean CIEDE2000 between each downsampled pixel and its redraw.
fn mean_error(session: &Session, palette: &[PaletteColor]) -> f64 {
    let src = session.pixels();
    let out = redraw_with(src, &palette_colors(palette), RedrawMethod::Cie94).unwrap();
    let total: f64 = src
        .data
        .iter()
        .zip(&out.data)
        .map(|(a, b)| color::distance_ciede2000(a.lab(), b.lab()))
        .sum();
    #[allow(clippy::cast_precision_loss)]
    let n = src.data.len() as f64;
    total / n
}

/// FNV-1a 64 over row-major RGB bytes.
fn rgb_hash(rgba: &[u8]) -> String {
    let mut h: u64 = 14_695_981_039_346_656_037;
    for px in rgba.as_chunks::<4>().0 {
        for &v in &px[..3] {
            h ^= u64::from(v);
            h = h.wrapping_mul(1_099_511_628_211);
        }
    }
    format!("{h:016x}")
}

#[test]
fn gives_exactly_the_requested_colors_every_time() {
    for target in TARGETS {
        let mut s = session(IMAGE, target);
        for count in [8, 16, 24, 32] {
            for threshold in [0.0, 0.8, 1.0] {
                let palette = s
                    .cluster_palette(PaletteMethod::HsluvSatDist(threshold), count)
                    .unwrap();
                assert_eq!(palette.len(), count, "{target} {count} {threshold}");
            }
            // A fresh session computes the clusters again from scratch.
            let method = PaletteMethod::Weight;
            assert_eq!(
                s.cluster_palette(method, count).unwrap(),
                session(IMAGE, target)
                    .cluster_palette(method, count)
                    .unwrap(),
                "{target} {count}"
            );
        }
    }
}

#[test]
fn redraws_closer_to_the_image_than_the_tolerance_search() {
    // The reason the cluster search exists: the tolerance search spends most
    // palette colors on rare outliers.
    // fails-when: the clusters ignore pixel weights or stop before converging.
    for target in TARGETS {
        for count in [16, 24] {
            let mut s = session(IMAGE, target);
            let clustered = s.cluster_palette(PaletteMethod::Weight, count).unwrap();
            let params = SearchParams {
                palette_count: count,
                max_results: 1,
                tolerance: 0.02,
                increment: 0.01,
            };
            let searched = s.find_palettes(PaletteMethod::Weight, &params).unwrap();
            let (c, t) = (
                mean_error(&s, &clustered),
                mean_error(&s, &searched[0].colors),
            );
            assert!(c < t, "{target} {count}: clusters {c} vs tolerance {t}");
        }
    }
}

#[test]
fn matches_the_pinned_redraw() {
    // breaks-if-wrong: any change to the clustering's arithmetic or order
    // changes these pixels; a deliberate change updates the hash.
    let mut s = session(IMAGE, 64);
    let palette = s
        .cluster_palette(PaletteMethod::HsluvSatDist(0.8), 24)
        .unwrap();
    let out = redraw_with(s.pixels(), &palette_colors(&palette), RedrawMethod::Cie94).unwrap();
    assert_eq!(rgb_hash(&out.to_rgba8()), "26204cbdfb4e6ce3");
}

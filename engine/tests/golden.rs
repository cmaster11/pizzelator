//! The golden fixtures under `tests/golden/`: the engine must reproduce each
//! one exactly on the images in `assets/`.

use std::fs;
use std::path::{Path, PathBuf};

use pizzelator_engine::decode::decode_png;
use pizzelator_engine::optimizer::SearchParams;
use pizzelator_engine::palette::PaletteMethod;
use pizzelator_engine::redraw::RedrawMethod;
use pizzelator_engine::{RedrawDeduper, Session, palette_colors, redraw_with};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Case {
    name: String,
    image: String,
    target_size: usize,
    palette_count: usize,
    palette_method: String,
    threshold: f64,
    redraw_method: String,
    tolerance: f64,
    increment: f64,
    max_images: usize,
}

#[derive(Deserialize)]
struct Color {
    r: f64,
    g: f64,
    b: f64,
    weight: u32,
}

#[derive(Deserialize)]
struct Iteration {
    tolerance: f64,
    colors: Vec<Color>,
}

#[derive(Deserialize)]
struct Redraw {
    tolerance: f64,
    hash: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Golden {
    case: Case,
    step: usize,
    width: usize,
    height: usize,
    quantized_hash: String,
    unique_colors: usize,
    iterations: Vec<Iteration>,
    redraws: Vec<Redraw>,
}

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("..")
}

/// FNV-1a 64 over row-major RGB bytes, as the fixture generator computes it.
fn rgba_hash(rgba: &[u8]) -> String {
    let mut h: u64 = 14695981039346656037;
    for px in rgba.as_chunks::<4>().0 {
        for &v in &px[..3] {
            h ^= u64::from(v);
            h = h.wrapping_mul(1099511628211);
        }
    }
    format!("{h:016x}")
}

fn check(golden: &Golden) {
    let c = &golden.case;
    let bytes = fs::read(repo_root().join("assets").join(&c.image)).unwrap();
    let image = decode_png(&bytes).unwrap();
    let mut session = Session::new(&image.rgba, image.width, image.height, c.target_size).unwrap();
    assert_eq!(session.step(), golden.step, "step");
    let px = session.pixels();
    assert_eq!((px.width, px.height), (golden.width, golden.height), "size");
    assert_eq!(
        rgba_hash(&px.to_rgba8()),
        golden.quantized_hash,
        "quantized pixels"
    );
    assert_eq!(
        session.unique_colors(),
        golden.unique_colors,
        "unique colors"
    );

    let method = PaletteMethod::parse(&c.palette_method, c.threshold).unwrap();
    let params = SearchParams {
        palette_count: c.palette_count,
        max_results: c.max_images,
        tolerance: c.tolerance,
        increment: c.increment,
    };
    let iterations = session.find_palettes(method, &params).unwrap();
    assert_eq!(iterations.len(), golden.iterations.len(), "iteration count");
    for (got, want) in iterations.iter().zip(&golden.iterations) {
        assert_eq!(got.tolerance, want.tolerance, "tolerance");
        assert_eq!(
            got.colors.len(),
            want.colors.len(),
            "palette size at {}",
            want.tolerance
        );
        for (g, e) in got.colors.iter().zip(&want.colors) {
            assert_eq!(g.weight, e.weight, "weight at tolerance {}", want.tolerance);
            let diff = (g.color.r - e.r).abs() + (g.color.g - e.g).abs() + (g.color.b - e.b).abs();
            assert!(
                diff < 1e-12,
                "color {:?} vs ({}, {}, {})",
                g.color,
                e.r,
                e.g,
                e.b
            );
        }
    }

    let redraw_method = RedrawMethod::parse(&c.redraw_method).unwrap();
    let mut dedupe = RedrawDeduper::default();
    let mut redraws = Vec::new();
    for it in &iterations {
        let out =
            redraw_with(session.pixels(), &palette_colors(&it.colors), redraw_method).unwrap();
        if dedupe.insert(&out) {
            redraws.push((it.tolerance, rgba_hash(&out.to_rgba8())));
        }
    }
    let want: Vec<(f64, String)> = golden
        .redraws
        .iter()
        .map(|r| (r.tolerance, r.hash.clone()))
        .collect();
    assert_eq!(redraws, want, "redraws");
}

#[test]
fn matches_the_golden_fixtures() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/golden");
    let mut paths: Vec<PathBuf> = fs::read_dir(&dir)
        .unwrap()
        .map(|e| e.unwrap().path())
        .filter(|p| p.extension().is_some_and(|e| e == "json"))
        .collect();
    paths.sort();
    assert!(
        paths.len() >= 7,
        "expected the golden fixtures in {}",
        dir.display()
    );
    for path in paths {
        let golden: Golden = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        let start = std::time::Instant::now();
        check(&golden);
        eprintln!("{}: ok in {:?}", golden.case.name, start.elapsed());
    }
}

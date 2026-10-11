//! A session rebuilt from a downsampled image handed over as `f64` values,
//! as the browser's run workers receive it, against one built from the image.

use std::fs;
use std::path::Path;

use pizzelator_engine::decode::decode_png;
use pizzelator_engine::image::Pixels;
use pizzelator_engine::optimizer::SearchParams;
use pizzelator_engine::palette::PaletteMethod;
use pizzelator_engine::{Session, downsample};

#[test]
fn a_session_from_handed_over_values_finds_the_same_palettes() {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../assets/pizza.png");
    let img = decode_png(&fs::read(path).unwrap()).unwrap();
    for target in [32, 64] {
        let mut direct = Session::new(&img.rgba, img.width, img.height, target).unwrap();
        let (step, pixels) = downsample(&img.rgba, img.width, img.height, target).unwrap();
        let handed = Pixels::from_rgb(pixels.width, pixels.height, &pixels.to_rgb()).unwrap();
        let mut rebuilt = Session::from_downsampled(step, handed);
        assert_eq!(rebuilt.step(), direct.step());

        // fails-when: the handover changes any value or the step.
        let method = PaletteMethod::HsluvSatDist(0.6);
        let params = SearchParams {
            palette_count: 8,
            max_results: 8,
            tolerance: 0.02,
            increment: 0.01,
        };
        let a = direct.find_palettes(method, &params).unwrap();
        let b = rebuilt.find_palettes(method, &params).unwrap();
        assert_eq!(a.len(), b.len(), "target {target}");
        for (x, y) in a.iter().zip(&b) {
            assert_eq!(x.tolerance.to_bits(), y.tolerance.to_bits());
            assert_eq!(x.colors, y.colors, "target {target}");
        }
        assert_eq!(
            direct.cluster_palette(method, 24).unwrap(),
            rebuilt.cluster_palette(method, 24).unwrap(),
            "target {target}"
        );
    }
}

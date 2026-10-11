//! Color math ported from go-colorful v1.2.0 and, through it, hsluv-go; both
//! MIT-licensed (`THIRD_PARTY_NOTICES.md`).
//!
//! Every formula keeps go-colorful's operation order, and constants it folds
//! at arbitrary precision are written as their folded `f64` values, so results
//! match the golden fixtures bit for bit wherever the platform's
//! transcendental functions agree.

// Constants are copied verbatim from go-colorful; they parse to the same f64.
#![allow(clippy::excessive_precision, clippy::unreadable_literal)]

/// An sRGB color with channels in `[0, 1]`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rgb {
    pub r: f64,
    pub g: f64,
    pub b: f64,
}

/// A CIE L*a*b* color in go-colorful's scale (L in `[0, 1]`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Lab {
    pub l: f64,
    pub a: f64,
    pub b: f64,
}

/// A CIE L*u*v* color in go-colorful's scale (L in `[0, 1]`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Luv {
    pub l: f64,
    pub u: f64,
    pub v: f64,
}

pub const WHITE: Rgb = Rgb {
    r: 1.0,
    g: 1.0,
    b: 1.0,
};

const D65: [f64; 3] = [0.95047, 1.00000, 1.08883];
const HSLUV_D65: [f64; 3] = [0.95045592705167, 1.0, 1.089057750759878];

const LAB_EPS: f64 = 0.008856451679035631;
const LAB_FINV_K: f64 = 0.12841854934601665;
const SIX_29: f64 = 0.20689655172413793;
const FOUR_29: f64 = 0.13793103448275862;
const LUV_K: f64 = 903.2962962962963;
const RAD2DEG: f64 = 57.29577951308232;
const INV_2_4: f64 = 0.4166666666666667;
const ALMOST_EQUAL_RGB: f64 = 1.0 / 85.0;

const HSLUV_M: [[f64; 3]; 3] = [
    [
        3.2409699419045214,
        -1.5373831775700935,
        -0.49861076029300328,
    ],
    [
        -0.96924363628087983,
        1.8759675015077207,
        0.041555057407175613,
    ],
    [
        0.055630079696993609,
        -0.20397695888897657,
        1.0569715142428786,
    ],
];
const HSLUV_KAPPA: f64 = 903.2962962962963;
const HSLUV_EPSILON: f64 = 0.0088564516790356308;

const PI: f64 = std::f64::consts::PI;

#[inline]
pub fn sq(v: f64) -> f64 {
    v * v
}

fn clamp01(v: f64) -> f64 {
    0.0_f64.max(v.min(1.0))
}

/// `x` to the `y` for the positive bases this engine uses: the fractional
/// exponent goes through `exp(yf * log(x))` and the integer part through
/// repeated squaring, which is not the same rounding as `powf`.
pub fn split_pow(x: f64, y: f64) -> f64 {
    if y == 0.0 || x == 1.0 {
        return 1.0;
    }
    if y == 1.0 {
        return x;
    }
    if x == 0.0 {
        return 0.0;
    }
    if y == 0.5 {
        return x.sqrt();
    }
    let mut yi = y.trunc();
    let mut yf = y - yi;
    let mut a1 = 1.0;
    let mut ae: i32 = 0;
    if yf != 0.0 {
        if yf > 0.5 {
            yf -= 1.0;
            yi += 1.0;
        }
        a1 = libm::exp(yf * libm::log(x));
    }
    let (mut x1, mut xe) = libm::frexp(x);
    #[allow(clippy::cast_possible_truncation)]
    let mut i = yi as i64;
    while i != 0 {
        if i & 1 == 1 {
            a1 *= x1;
            ae += xe;
        }
        x1 *= x1;
        xe <<= 1;
        if x1 < 0.5 {
            x1 += x1;
            xe -= 1;
        }
        i >>= 1;
    }
    libm::ldexp(a1, ae)
}

impl Rgb {
    /// Converts straight-alpha 16-bit RGBA: premultiply, then divide by alpha
    /// again, in integers. Fully transparent pixels become white. 8-bit input
    /// scaled by 257 gives the same result as the 8-bit path written out in
    /// the tests (`from_nrgba8`).
    pub fn from_rgba16(r: u16, g: u16, b: u16, a: u16) -> Rgb {
        if a == 0 {
            return WHITE;
        }
        let a = u32::from(a);
        let channel = |c: u16| {
            let premultiplied = u32::from(c) * a / 0xffff;
            f64::from(premultiplied * 0xffff / a) / 65535.0
        };
        Rgb {
            r: channel(r),
            g: channel(g),
            b: channel(b),
        }
    }

    /// 8-bit channels: each value scaled to 16 bits, rounded down after adding
    /// a half, and its high byte kept.
    pub fn to_rgb8(self) -> [u8; 3] {
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        let conv = |v: f64| ((v * 65535.0 + 0.5) as u32 >> 8) as u8;
        [conv(self.r), conv(self.g), conv(self.b)]
    }

    /// go-colorful's `RGB255`, used for duplicate detection.
    pub fn rgb255(self) -> [u8; 3] {
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        let conv = |v: f64| (v * 255.0 + 0.5) as u8;
        [conv(self.r), conv(self.g), conv(self.b)]
    }

    pub fn almost_equal_rgb(self, other: Rgb) -> bool {
        (self.r - other.r).abs() + (self.g - other.g).abs() + (self.b - other.b).abs()
            < ALMOST_EQUAL_RGB
    }

    pub fn xyz(self) -> [f64; 3] {
        let r = linearize(self.r);
        let g = linearize(self.g);
        let b = linearize(self.b);
        [
            0.41239079926595948 * r + 0.35758433938387796 * g + 0.18048078840183429 * b,
            0.21263900587151036 * r + 0.71516867876775593 * g + 0.072192315360733715 * b,
            0.019330818715591851 * r + 0.11919477979462599 * g + 0.95053215224966058 * b,
        ]
    }

    pub fn lab(self) -> Lab {
        xyz_to_lab(self.xyz(), D65)
    }

    pub fn luv(self) -> Luv {
        xyz_to_luv(self.xyz(), D65)
    }

    /// HSLuv saturation and luminance, both in `[0, 1]`.
    pub fn hsluv_sl(self) -> (f64, f64) {
        let luv = xyz_to_luv(self.xyz(), HSLUV_D65);
        let (l, c, h) = luv_to_lch(luv);
        let c = c * 100.0;
        let l = l * 100.0;
        let s = if l > 99.9999999 || l < 0.00000001 {
            0.0
        } else {
            c / max_chroma_for_lh(l, h) * 100.0
        };
        (clamp01(s / 100.0), clamp01(l / 100.0))
    }

    /// HCL chroma and luminance.
    pub fn hcl_cl(self) -> (f64, f64) {
        let lab = self.lab();
        ((sq(lab.a) + sq(lab.b)).sqrt(), lab.l)
    }
}

fn linearize(v: f64) -> f64 {
    if v <= 0.04045 {
        return v / 12.92;
    }
    split_pow((v + 0.055) / 1.055, 2.4)
}

fn delinearize(v: f64) -> f64 {
    if v <= 0.0031308 {
        return 12.92 * v;
    }
    1.055 * split_pow(v, INV_2_4) - 0.055
}

fn lab_f(t: f64) -> f64 {
    if t > LAB_EPS {
        return libm::cbrt(t);
    }
    t / 3.0 * 29.0 / 6.0 * 29.0 / 6.0 + FOUR_29
}

fn lab_finv(t: f64) -> f64 {
    if t > SIX_29 {
        return t * t * t;
    }
    LAB_FINV_K * (t - FOUR_29)
}

fn xyz_to_lab([x, y, z]: [f64; 3], wref: [f64; 3]) -> Lab {
    let fy = lab_f(y / wref[1]);
    Lab {
        l: 1.16 * fy - 0.16,
        a: 5.0 * (lab_f(x / wref[0]) - fy),
        b: 2.0 * (fy - lab_f(z / wref[2])),
    }
}

/// go-colorful's `Lab(l, a, b)` constructor: Lab to sRGB with D65 white.
pub fn lab_to_rgb(lab: Lab) -> Rgb {
    let l2 = (lab.l + 0.16) / 1.16;
    let x = D65[0] * lab_finv(l2 + lab.a / 5.0);
    let y = D65[1] * lab_finv(l2);
    let z = D65[2] * lab_finv(l2 - lab.b / 2.0);
    Rgb {
        r: delinearize(3.2409699419045214 * x - 1.5373831775700935 * y - 0.49861076029300328 * z),
        g: delinearize(
            -0.96924363628087983 * x + 1.8759675015077207 * y + 0.041555057407175613 * z,
        ),
        b: delinearize(0.055630079696993609 * x - 0.20397695888897657 * y + 1.0569715142428786 * z),
    }
}

fn xyz_to_uv(x: f64, y: f64, z: f64) -> (f64, f64) {
    let denom = x + 15.0 * y + 3.0 * z;
    if denom == 0.0 {
        return (0.0, 0.0);
    }
    (4.0 * x / denom, 9.0 * y / denom)
}

fn xyz_to_luv([x, y, z]: [f64; 3], wref: [f64; 3]) -> Luv {
    let l = if y / wref[1] <= LAB_EPS {
        y / wref[1] * LUV_K / 100.0
    } else {
        1.16 * libm::cbrt(y / wref[1]) - 0.16
    };
    let (ubis, vbis) = xyz_to_uv(x, y, z);
    let (un, vn) = xyz_to_uv(wref[0], wref[1], wref[2]);
    Luv {
        l,
        u: 13.0 * l * (ubis - un),
        v: 13.0 * l * (vbis - vn),
    }
}

fn luv_to_lch(luv: Luv) -> (f64, f64, f64) {
    let h = if (luv.v - luv.u).abs() > 1e-4 && luv.u.abs() > 1e-4 {
        (RAD2DEG * libm::atan2(luv.v, luv.u) + 360.0) % 360.0
    } else {
        0.0
    };
    (luv.l, (sq(luv.u) + sq(luv.v)).sqrt(), h)
}

fn max_chroma_for_lh(l: f64, h: f64) -> f64 {
    let h_rad = h / 360.0 * PI * 2.0;
    let mut min_length = f64::MAX;
    for [x, y] in hsluv_bounds(l) {
        let length = y / (libm::sin(h_rad) - x * libm::cos(h_rad));
        if length > 0.0 && length < min_length {
            min_length = length;
        }
    }
    min_length
}

fn hsluv_bounds(l: f64) -> [[f64; 2]; 6] {
    let sub1 = split_pow(l + 16.0, 3.0) / 1560896.0;
    let sub2 = if sub1 > HSLUV_EPSILON {
        sub1
    } else {
        l / HSLUV_KAPPA
    };
    let mut ret = [[0.0; 2]; 6];
    for (i, m) in HSLUV_M.iter().enumerate() {
        for k in 0..2_u8 {
            let k = f64::from(k);
            let top1 = (284517.0 * m[0] - 94839.0 * m[2]) * sub2;
            let top2 =
                (838422.0 * m[2] + 769860.0 * m[1] + 731718.0 * m[0]) * l * sub2 - 769860.0 * k * l;
            let bottom = (632260.0 * m[2] - 126452.0 * m[1]) * sub2 + 126452.0 * k;
            #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
            let idx = i * 2 + k as usize;
            ret[idx] = [top1 / bottom, top2 / bottom];
        }
    }
    ret
}

pub fn distance_rgb(c1: Rgb, c2: Rgb) -> f64 {
    (sq(c1.r - c2.r) + sq(c1.g - c2.g) + sq(c1.b - c2.b)).sqrt()
}

pub fn distance_lab(c1: Lab, c2: Lab) -> f64 {
    (sq(c1.l - c2.l) + sq(c1.a - c2.a) + sq(c1.b - c2.b)).sqrt()
}

pub fn distance_luv(c1: Luv, c2: Luv) -> f64 {
    (sq(c1.l - c2.l) + sq(c1.u - c2.u) + sq(c1.v - c2.v)).sqrt()
}

pub fn distance_cie94(cl: Lab, cr: Lab) -> f64 {
    let (l1, a1, b1) = (cl.l * 100.0, cl.a * 100.0, cl.b * 100.0);
    let (l2, a2, b2) = (cr.l * 100.0, cr.a * 100.0, cr.b * 100.0);
    let k1 = 0.045;
    let k2 = 0.015;

    let delta_l = l1 - l2;
    let c1 = (sq(a1) + sq(b1)).sqrt();
    let c2 = (sq(a2) + sq(b2)).sqrt();
    let delta_cab = c1 - c2;
    let delta_hab2 = sq(a1 - a2) + sq(b1 - b2) - sq(delta_cab);
    let sc = 1.0 + k1 * c1;
    let sh = 1.0 + k2 * c1;

    let v_l2 = sq(delta_l);
    let v_c2 = sq(delta_cab / sc);
    let v_h2 = delta_hab2 / sq(sh);
    (v_l2 + v_c2 + v_h2).sqrt() * 0.01
}

fn hue_deg(b: f64, ap: f64) -> f64 {
    if b == ap && ap == 0.0 {
        return 0.0;
    }
    let mut h = libm::atan2(b, ap);
    if h < 0.0 {
        h += PI * 2.0;
    }
    h * RAD2DEG
}

/// CIEDE2000 with kL = kC = kH = 1.
pub fn distance_ciede2000(cl: Lab, cr: Lab) -> f64 {
    let (l1, a1, b1) = (cl.l * 100.0, cl.a * 100.0, cl.b * 100.0);
    let (l2, a2, b2) = (cr.l * 100.0, cr.a * 100.0, cr.b * 100.0);
    let pow25_7 = split_pow(25.0, 7.0);

    let cab1 = (sq(a1) + sq(b1)).sqrt();
    let cab2 = (sq(a2) + sq(b2)).sqrt();
    let cabmean = (cab1 + cab2) / 2.0;
    let cabmean7 = split_pow(cabmean, 7.0);

    let g = 0.5 * (1.0 - (cabmean7 / (cabmean7 + pow25_7)).sqrt());
    let ap1 = (1.0 + g) * a1;
    let ap2 = (1.0 + g) * a2;
    let cp1 = (sq(ap1) + sq(b1)).sqrt();
    let cp2 = (sq(ap2) + sq(b2)).sqrt();
    let hp1 = hue_deg(b1, ap1);
    let hp2 = hue_deg(b2, ap2);

    let delta_lp = l2 - l1;
    let delta_cp = cp2 - cp1;
    let cp_product = cp1 * cp2;
    let mut dhp = 0.0;
    if cp_product != 0.0 {
        dhp = hp2 - hp1;
        if dhp > 180.0 {
            dhp -= 360.0;
        } else if dhp < -180.0 {
            dhp += 360.0;
        }
    }
    let delta_hp = 2.0 * cp_product.sqrt() * libm::sin(dhp / 2.0 * PI / 180.0);

    let lpmean = (l1 + l2) / 2.0;
    let cpmean = (cp1 + cp2) / 2.0;
    let mut hpmean = hp1 + hp2;
    if cp_product != 0.0 {
        hpmean /= 2.0;
        if (hp1 - hp2).abs() > 180.0 {
            if hp1 + hp2 < 360.0 {
                hpmean += 180.0;
            } else {
                hpmean -= 180.0;
            }
        }
    }

    let t = 1.0 - 0.17 * libm::cos((hpmean - 30.0) * PI / 180.0)
        + 0.24 * libm::cos(2.0 * hpmean * PI / 180.0)
        + 0.32 * libm::cos((3.0 * hpmean + 6.0) * PI / 180.0)
        - 0.2 * libm::cos((4.0 * hpmean - 63.0) * PI / 180.0);
    let delta_theta = 30.0 * libm::exp(-sq((hpmean - 275.0) / 25.0));
    let cpmean7 = split_pow(cpmean, 7.0);
    let rc = 2.0 * (cpmean7 / (cpmean7 + pow25_7)).sqrt();
    let sl = 1.0 + (0.015 * sq(lpmean - 50.0)) / (20.0 + sq(lpmean - 50.0)).sqrt();
    let sc = 1.0 + 0.045 * cpmean;
    let sh = 1.0 + 0.015 * cpmean * t;
    let rt = -libm::sin(2.0 * delta_theta * PI / 180.0) * rc;

    (sq(delta_lp / sl)
        + sq(delta_cp / sc)
        + sq(delta_hp / sh)
        + rt * (delta_cp / sc) * (delta_hp / sh))
        .sqrt()
        * 0.01
}

/// Cheap upper bound on the square of [`distance_ciede2000`]. With
/// S_L, S_C, S_H ≥ 1, |R_T| ≤ √3 and a′ ≤ 1.5·a, the distance satisfies
/// ΔE00² ≤ ΔL² + (1 + √3/2)·(2.25·Δa² + Δb²); the coefficients below round
/// those constants up.
pub fn ciede2000_upper_bound_sq(c1: Lab, c2: Lab) -> f64 {
    sq(c1.l - c2.l) + 4.2 * sq(c1.a - c2.a) + 1.87 * sq(c1.b - c2.b)
}

/// Largest CIEDE2000 lightness weight `S_L` for two colors whose L values
/// (go-colorful scale) lie within `max_dist_from_mid` of 0.5. Because the
/// CIEDE2000 chroma/hue block is never negative, `|ΔL| * 0.01 * 100 / S_L`
/// is a lower bound on the distance.
pub fn ciede2000_max_sl(max_dist_from_mid: f64) -> f64 {
    let d = max_dist_from_mid * 100.0;
    1.0 + (0.015 * sq(d)) / (20.0 + sq(d)).sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn go_pow_matches_exact_integer_powers() {
        assert_eq!(split_pow(25.0, 7.0), 6103515625.0);
        assert_eq!(split_pow(3.0, 3.0), 27.0);
        assert_eq!(split_pow(0.0, 7.0), 0.0);
    }

    fn from8(r: u8, g: u8, b: u8, a: u8) -> Rgb {
        let w = |v: u8| u16::from(v) * 257;
        Rgb::from_rgba16(w(r), w(g), w(b), w(a))
    }

    /// 8-bit straight alpha widened by byte replication, premultiplied and
    /// divided by alpha again, written out.
    fn from_nrgba8(c: u8, a: u8) -> f64 {
        let (c, a) = (u32::from(c), u32::from(a));
        let premultiplied = (c | (c << 8)) * a / 0xff;
        f64::from(premultiplied * 0xffff / (a | (a << 8))) / 65535.0
    }

    #[test]
    fn opaque_rgba8_maps_to_exact_fractions() {
        let c = from8(255, 0, 128, 255);
        assert_eq!(c.r, 1.0);
        assert_eq!(c.g, 0.0);
        assert_eq!(c.b, f64::from(128_u32 * 257) / 65535.0);
        assert_eq!(from8(10, 20, 30, 0), WHITE);
    }

    #[test]
    fn widened_8bit_matches_go_8bit_path_for_every_alpha() {
        for a in 1..=255_u8 {
            for c in 0..=255_u8 {
                assert_eq!(from8(c, c, c, a).r, from_nrgba8(c, a), "c={c} a={a}");
            }
        }
    }

    #[test]
    fn rgb8_roundtrip_is_identity_for_opaque_input() {
        for v in 0..=255_u8 {
            let c = from8(v, v, v, 255);
            assert_eq!(c.to_rgb8(), [v, v, v]);
            assert_eq!(c.rgb255(), [v, v, v]);
        }
    }

    fn sample_colors() -> Vec<Rgb> {
        (0..40)
            .map(|i| {
                let f = f64::from(i) / 39.0;
                Rgb {
                    r: f,
                    g: (f * 7.3) % 1.0,
                    b: 1.0 - f * f,
                }
            })
            .chain((0..64).map(|i| {
                let c = |k: u32| f64::from((i * k) % 8) / 7.0;
                Rgb {
                    r: c(1),
                    g: c(3),
                    b: c(5),
                }
            }))
            .collect()
    }

    #[test]
    fn ciede2000_upper_bound_holds() {
        let colors = sample_colors();
        for a in &colors {
            for b in &colors {
                let (la, lb) = (a.lab(), b.lab());
                let d = distance_ciede2000(la, lb);
                assert!(
                    sq(d) <= ciede2000_upper_bound_sq(la, lb) * (1.0 + 1e-12),
                    "{a:?} {b:?}"
                );
            }
        }
    }

    #[test]
    fn ciede2000_lower_bound_holds() {
        let colors = sample_colors();
        let max_sl = ciede2000_max_sl(0.5);
        for a in &colors {
            for b in &colors {
                let (la, lb) = (a.lab(), b.lab());
                let bound = (la.l - lb.l).abs() / max_sl;
                assert!(distance_ciede2000(la, lb) >= bound * (1.0 - 1e-12));
            }
        }
    }
}

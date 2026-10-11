//! Cluster search: weighted k-means in CIE Lab, grouping the colors into
//! exactly the requested number of clusters. Each color counts by its pixels,
//! so clusters go where the image has the most pixels, not to rare outliers.
//!
//! Every step has a defined order (entries in their given order, ties to the
//! lowest index) and uses only `+`, `-`, `*` and `/`, so it gives the same
//! clusters natively and in every browser.

use crate::color::{Lab, sq};
use crate::error::EngineError;
use crate::palette::ColorEntry;

/// Lloyd iterations stop here even if assignments still change.
const MAX_ITERATIONS: usize = 100;

fn dist_sq(a: Lab, b: Lab) -> f64 {
    sq(a.l - b.l) + sq(a.a - b.a) + sq(a.b - b.b)
}

/// Index of the nearest centroid, the lowest index on ties.
fn nearest(lab: Lab, centroids: &[Lab]) -> usize {
    let mut best = 0;
    let mut best_d = f64::INFINITY;
    for (i, &c) in centroids.iter().enumerate() {
        let d = dist_sq(lab, c);
        if d < best_d {
            best = i;
            best_d = d;
        }
    }
    best
}

/// Index of the largest score, the lowest index on ties.
fn argmax(scores: impl Iterator<Item = f64>) -> usize {
    let mut best = 0;
    let mut best_score = f64::NEG_INFINITY;
    for (i, s) in scores.enumerate() {
        if s > best_score {
            best = i;
            best_score = s;
        }
    }
    best
}

/// The heaviest color, then repeatedly the color with the largest weight ×
/// squared distance to its nearest chosen centroid. Entries are distinct
/// colors, so each pick is a new one while `count <= entries.len()`.
fn initial_centroids(entries: &[ColorEntry], count: usize) -> Vec<Lab> {
    let first = entries[argmax(entries.iter().map(|e| f64::from(e.weight)))].lab;
    let mut centroids = vec![first];
    let mut nearest_sq: Vec<f64> = entries.iter().map(|e| dist_sq(e.lab, first)).collect();
    while centroids.len() < count {
        let pick = argmax(
            entries
                .iter()
                .zip(&nearest_sq)
                .map(|(e, d)| f64::from(e.weight) * d),
        );
        let c = entries[pick].lab;
        centroids.push(c);
        for (d, e) in nearest_sq.iter_mut().zip(entries) {
            *d = d.min(dist_sq(e.lab, c));
        }
    }
    centroids
}

fn cluster_sizes(assignment: &[usize], count: usize) -> Vec<usize> {
    let mut sizes = vec![0; count];
    for &a in assignment {
        sizes[a] += 1;
    }
    sizes
}

/// Gives each empty cluster the color its own cluster represents worst
/// (largest weight × squared distance), taken from a cluster that keeps at
/// least one member.
fn fill_empty(entries: &[ColorEntry], assignment: &mut [usize], centroids: &mut [Lab]) {
    let mut sizes = cluster_sizes(assignment, centroids.len());
    for k in 0..centroids.len() {
        if sizes[k] > 0 {
            continue;
        }
        let pick = argmax(entries.iter().zip(assignment.iter()).map(|(e, &a)| {
            if sizes[a] > 1 {
                f64::from(e.weight) * dist_sq(e.lab, centroids[a])
            } else {
                f64::NEG_INFINITY
            }
        }));
        sizes[assignment[pick]] -= 1;
        sizes[k] = 1;
        assignment[pick] = k;
        centroids[k] = entries[pick].lab;
    }
}

/// Moves every centroid to the weighted mean of its members.
fn update_centroids(entries: &[ColorEntry], assignment: &[usize], centroids: &mut [Lab]) {
    let mut sums = vec![(0.0, 0.0, 0.0, 0.0); centroids.len()];
    for (e, &a) in entries.iter().zip(assignment) {
        let w = f64::from(e.weight);
        let s = &mut sums[a];
        s.0 += e.lab.l * w;
        s.1 += e.lab.a * w;
        s.2 += e.lab.b * w;
        s.3 += w;
    }
    for (c, s) in centroids.iter_mut().zip(&sums) {
        if s.3 > 0.0 {
            *c = Lab {
                l: s.0 / s.3,
                a: s.1 / s.3,
                b: s.2 / s.3,
            };
        }
    }
}

/// The cluster of each entry.
fn kmeans(entries: &[ColorEntry], count: usize) -> Vec<usize> {
    let mut centroids = initial_centroids(entries, count);
    let mut assignment = vec![usize::MAX; entries.len()];
    for _ in 0..MAX_ITERATIONS {
        let mut changed = false;
        for (a, e) in assignment.iter_mut().zip(entries) {
            let k = nearest(e.lab, &centroids);
            if *a != k {
                *a = k;
                changed = true;
            }
        }
        if !changed {
            break;
        }
        fill_empty(entries, &mut assignment, &mut centroids);
        update_centroids(entries, &assignment, &mut centroids);
    }
    assignment
}

/// Groups `entries` into exactly `count` non-empty clusters, each listing its
/// entry indices in ascending order.
pub fn cluster_colors(
    entries: &[ColorEntry],
    count: usize,
) -> Result<Vec<Vec<usize>>, EngineError> {
    if count == 0 {
        return Err(EngineError::InvalidParameter(
            "palette count must be at least 1",
        ));
    }
    if entries.len() < count {
        return Err(EngineError::NotEnoughColors {
            unique: entries.len(),
            requested: count,
        });
    }
    let mut groups = vec![Vec::new(); count];
    for (i, a) in kmeans(entries, count).into_iter().enumerate() {
        groups[a].push(i);
    }
    Ok(groups)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::color::Rgb;

    fn entries(n: u32) -> Vec<ColorEntry> {
        (0..n)
            .map(|i| {
                let f = f64::from(i);
                let color = Rgb {
                    r: (f * 0.618_034) % 1.0,
                    g: (f * 0.414_213) % 1.0,
                    b: (f * 0.732_050) % 1.0,
                };
                ColorEntry {
                    color,
                    lab: color.lab(),
                    weight: 1 + (i * 7919) % 50,
                }
            })
            .collect()
    }

    #[test]
    fn makes_exactly_count_non_empty_clusters_covering_every_entry() {
        let e = entries(500);
        for count in [1, 2, 16, 24, 64, 499, 500] {
            let groups = cluster_colors(&e, count).unwrap();
            assert_eq!(groups.len(), count);
            assert!(groups.iter().all(|g| !g.is_empty()), "count {count}");
            let mut all: Vec<usize> = groups.concat();
            all.sort_unstable();
            assert_eq!(all, (0..e.len()).collect::<Vec<_>>(), "count {count}");
        }
    }

    #[test]
    fn converges_to_a_fixed_point() {
        // At convergence every entry is nearest to the weighted mean of its
        // own cluster, computed here from the groups alone.
        // fails-when: the loop stops before the assignments settle.
        let e = entries(800);
        for count in [8, 24, 32] {
            let groups = cluster_colors(&e, count).unwrap();
            let means: Vec<Lab> = groups
                .iter()
                .map(|g| {
                    let w: f64 = g.iter().map(|&i| f64::from(e[i].weight)).sum();
                    let avg = |f: fn(Lab) -> f64| {
                        g.iter()
                            .map(|&i| f(e[i].lab) * f64::from(e[i].weight))
                            .sum::<f64>()
                            / w
                    };
                    Lab {
                        l: avg(|x| x.l),
                        a: avg(|x| x.a),
                        b: avg(|x| x.b),
                    }
                })
                .collect();
            for (k, g) in groups.iter().enumerate() {
                for &i in g {
                    let d = dist_sq(e[i].lab, means[k]);
                    // A tiny margin: the means here sum in a different order.
                    assert!(
                        means.iter().all(|&m| d <= dist_sq(e[i].lab, m) + 1e-12),
                        "count {count}: entry {i} is nearer another cluster"
                    );
                }
            }
        }
    }

    #[test]
    fn heavy_colors_get_their_own_cluster() {
        // Two big areas of near-identical blues and one pixel each of many
        // reds: the blues must not share a cluster, while a single cluster
        // holds every red.
        let mut e: Vec<ColorEntry> = Vec::new();
        let mut push = |r: f64, g: f64, b: f64, weight: u32| {
            let color = Rgb { r, g, b };
            e.push(ColorEntry {
                color,
                lab: color.lab(),
                weight,
            });
        };
        push(0.1, 0.2, 0.8, 1000);
        push(0.1, 0.25, 0.8, 1000);
        for i in 0..10 {
            push(0.9, f64::from(i) * 0.02, 0.0, 1);
        }
        let groups = cluster_colors(&e, 3).unwrap();
        let of = |i: usize| groups.iter().position(|g| g.contains(&i)).unwrap();
        assert_ne!(of(0), of(1));
        assert!((2..12).all(|i| of(i) == of(2)));
    }

    #[test]
    fn rejects_too_few_colors_and_zero() {
        let e = entries(5);
        assert_eq!(
            cluster_colors(&e, 6),
            Err(EngineError::NotEnoughColors {
                unique: 5,
                requested: 6
            })
        );
        assert!(cluster_colors(&e, 0).is_err());
    }
}

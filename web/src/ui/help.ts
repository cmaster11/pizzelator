/** Longer explanations of each setting, shown in a collapsible block under it. */
import { DEFAULT_ADJUSTMENTS } from '../lib/adjust';
import { DEFAULT_PARAMS } from '../lib/params';

export interface HelpTopic {
  /** Completes "Learn more about …" in the toggle's accessible name. */
  about: string;
  paragraphs: string[];
}

const thresholdCount = DEFAULT_PARAMS.thresholds.length;

export const HELP = {
  targetSizes: {
    about: 'target sizes',
    paragraphs: [
      'The image shrinks until its shorter side is at most this many pixels. Each result pixel is the blurred average of a square block of the original, so the result can come out a few pixels under the size you asked for.',
      'Small sizes (16 to 48) give chunky pixel art that keeps only the main shapes. Large sizes (96 and up) keep more detail, look less like pixel art and make the search slower.',
      'Enter several sizes, separated by commas or spaces, to compare them in one run. Every size repeats every search.',
      'With an area selected, the size applies to that area: a small area keeps more of its detail.',
    ],
  },
  paletteColors: {
    about: 'palette colors',
    paragraphs: [
      'Every palette the search keeps has exactly this many colors.',
      'Few colors (8 to 16) give flat, poster-like images with visible bands. More colors (32 and up) give smoother shading, closer to the original.',
      'The shrunk image needs at least this many distinct colors. The cluster search reaches any count up to that. The tolerance search cannot reach some counts exactly and then fails with "no tolerance yields exactly N colors": try a nearby count, a larger target size or a smaller increment.',
    ],
  },
  paletteSearch: {
    about: 'palette search',
    paragraphs: [
      'Both searches group similar colors of the image into exactly the palette size, and each group becomes one palette color. They differ in how they group.',
      'Clusters (v2) weighs every color by how many pixels have it, so the palette spends most of its colors on the large areas of the image and shades them finely. Small specks merge into their nearest area. Expect results closer to the original, with smoother shading and fewer stray accent colors. It gives one palette per method and threshold, and runs in a fraction of a second.',
      'Tolerance (classic) is the classic search. Two colors share a group when they are closer than a tolerance, however few pixels they cover, so rare colors keep their own palette slots while large smooth areas merge. Expect bolder accents and flatter large areas. It often keeps several palettes that differ only slightly.',
      'With both selected, the results of one method and threshold sit side by side, clusters first.',
    ],
  },
  maxImages: {
    about: 'max images',
    paragraphs: [
      'Tolerance search only. The search raises the tolerance step by step and keeps up to this many palettes in a row that have the right number of colors. Neighboring palettes differ a little: a few colors merge or shift.',
      'Raise it for more variations to pick from, lower it for a faster run. Identical redraws are shown once, so a run usually shows fewer images than the Paint button counts.',
    ],
  },
  paletteMethods: {
    about: 'palette methods',
    paragraphs: [
      'The palette search groups similar colors of the image, and each group becomes one palette color. The palette method decides how.',
      'The averages blend each group into a new color, which tends to come out duller than the image. The squared average weighs strong channels more and comes out a little lighter; the Lab average blends the way the eye sees.',
      'The HSLuv and HCL methods keep a color the image really has. They order each group from dull and dark to vivid and light, and take the color at each threshold.',
      'Every selected method runs its own searches, adding images and time.',
    ],
  },
  thresholds: {
    about: 'thresholds',
    paragraphs: [
      'Where the HSLuv and HCL methods pick within each ordered group: 0 takes the dullest, darkest color, 1 the most vivid and lightest, 0.5 the one in the middle.',
      'Low thresholds give dark, muted palettes; high thresholds give bright, saturated ones.',
      `Every threshold is a search of its own, for each size, method and palette search: the default list of ${String(thresholdCount)} thresholds sweeps the whole range in ${String(thresholdCount)} searches of each kind. Remove values for a faster run.`,
      'The average methods ignore thresholds, so the field is disabled when only averages are selected.',
    ],
  },
  redrawMethods: {
    about: 'redraw methods',
    paragraphs: [
      'Once a palette is found, every pixel takes the palette color nearest to it. The redraw method decides how nearness is measured.',
      'CIE94 and CIEDE2000 follow how the eye judges color differences; CIEDE2000 is the newer, more refined formula. Lab and Luv measure straight-line distance in a perceptual color space. RGB compares raw channel values, which can match colors the eye sees as different.',
      'The methods mostly agree and differ at edges and in gradients. Every selected method redraws every palette, adding images; identical redraws are shown once.',
    ],
  },
  tolerance: {
    about: 'tolerance',
    paragraphs: [
      'Tolerance search only. Two colors join the same group when their CIEDE2000 distance, divided by 100, is under the tolerance. 0.01 is about the smallest difference the eye can see.',
      'The search starts at the initial tolerance and raises it by the increment until the groups give exactly the requested number of colors. When it overshoots, it steps back and halves the increment.',
      'A smaller increment finds palettes closer to each other and searches longer. A larger one is faster and spaces the palettes further apart.',
      'The search only moves up. An initial tolerance that already merges the image into fewer colors than requested finds nothing: lower it.',
    ],
  },
  forcedPalette: {
    about: 'forced palette',
    paragraphs: [
      'Skips the search and redraws the image with the colors you give it: every size and redraw method gives one image.',
      'Load a palette JSON downloaded with an earlier result to reuse its colors on another image or size. Or load an image, such as a palette strip, and its distinct colors become the palette.',
      'The search settings are disabled while a forced palette is loaded.',
    ],
  },
  output: {
    about: 'output options',
    paragraphs: [
      `Brightness and saturation change the finished images and their palettes without painting again. Averaged colors come out dull, so they start at +${String(DEFAULT_ADJUSTMENTS.brightness)}% and +${String(DEFAULT_ADJUSTMENTS.saturation)}%. High brightness turns light colors white; set both to 0% to keep the colors the search found.`,
      'Download size scales each pixel up into a square, keeping edges sharp. 1× is the result at its own size; original size scales it back to about the input image’s size.',
    ],
  },
} as const satisfies Record<string, HelpTopic>;

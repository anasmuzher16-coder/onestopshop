"""Make the shop's hookah photos shop-ready: clear glass that reads as glass on any tile colour, with no mat seen through it.

  python store/tools/catalog/clear_glass2.py SRC_DIR CUT_DIR OUT_DIR [--method ratio|rebuild|lama|matting] [NAME ...]

SRC_DIR holds the photos (NAME.jpg, upright, 2600 px tall: the owner's HEIC decoded with ffmpeg, which applies the
rotation itself, resized with Lanczos, JPEG q95). CUT_DIR holds rembg's cut-out of each at the same size
(rembg p -m birefnet-general-lite SRC_DIR CUT_DIR). OUT_DIR gets NAME.png, an RGBA cut-out whose clear glass is
semi-transparent, so the site's tile colour shows through it. With no NAME, every photo in SRC_DIR is done; a photo
with no entry in PHOTOS gets the cut-out as it is.

The problem. The hookahs stand on a black-and-pale-cyan printed mat (MOZE in the middle) on a marble table. Clear glass
shows the mat and marble through it, and a cut-out keeps them. A matting model (BiRefNet-matting) keeps the mat;
inpainting (LaMa) erases the glass's own texture with it (methods sheet and METHODS.md, 2026-11-27).

The method (--method ratio, the default) is a backdrop division, the way a clean plate works in film compositing:
what the camera saw through the glass is the backdrop B changed by the glass, so photo / B is the glass alone.
  - Over the marble and wall, B is a clean plate: LaMa (big-lama, ONNX) paints the backdrop in behind the glass, then
    it is blurred, keeping only the backdrop's broad tone.
  - Over the mat, B is the mat's own two inks: each pixel gets a soft weight of light or dark ink from a median-filtered
    copy of the photo, and B is the local level of that ink. Where the weight is in between (the print's edges) nothing
    is read. The two backdrops are cross-faded over 50 px where the mat zone begins.
From photo / B comes the glass's feature map f (bubbles, drips, ridges): darker than the backdrop over light ink and
over the plate, brighter than it over dark ink. Broad shading in f is taken out (only detail under ~15 px is texture),
so a misread patch of print cannot become a blotch. f is drawn the way a bubble looks on a plain backdrop: a thin
cool-dark part and a softer white part. Real specular highlights (near-white, neutral) are kept as they are. The
outline gets a darker rim with a thin inner highlight, where glass is seen at a slant. Everything is merged into one
RGBA pixel over the tile: a dark layer (alpha a_d) under a white layer (alpha h).
Opaque parts stay as cut: the downstem (a tight mask with a round end, edges feathered), rubber rings and bands (their
dark pixels only), logo plates. The base's outline below its widest row is a fitted superellipse, so the mat's teeth
round the foot are cut off on a smooth curve.
--method rebuild draws only the outline, body tint and speculars (no texture); lama fills the see-through glass with
the tile colour by inpainting (baked on --tile, opaque); matting uses BiRefNet-matting's alpha with a pymatting
foreground (outline trimmed by the foot, but retouch and erase not applied; a photo with no entry gets the model's
matte). lama and matting are kept only for the methods comparison. A photo with an entry must be 2600 px tall and its
cut-out the same size; otherwise the run stops with a message.

Each PHOTOS entry (pixels of the 2600 px tall photo):
  foot     [cx, cy, rx, ry, k, side, blend] (with fill, rx is read off the photo unless given as [left, right],
           and the curve eases in over `blend` rows, default 60): the base's outline below its widest row cy, a superellipse
           |dx/rx|^k + |dy/ry|^k = 1; for `side` rows above cy (default 0) the base is also held to |x - cx| <= rx.
           Read off the photo with an overlay.
  fill     true when the cut-out is unsure of the base (clear glass, a glossy foot): below row cy the silhouette is the fitted curve itself,
           eased over 60 rows from the cut-out's own (smoothed) outline above it.
  disc     [cx, cy, rx, ry, t(, d)]: a wide round dish or flared foot under the base (its outline an ellipse): the silhouette is the base's
           united with the ellipse (the cut-out took the mat round it), and the base's outline, the dish's and its wall's
           inner edge t px in (optional) are each drawn, so the base reads as standing in the dish. d (0..1): the wall
           between the two edges drawn as thick glass (denser, with a light sheen), not as two thin lines.
  glass    [y_top, y_bot]: rows holding clear glass; the glass is the cut-out within them, minus the opaque parts.
           glass_extra: more [y_top, y_bot] runs (a clear tube above the base; drawn in their own window, no mat).
           glass_x: [x0, x1], the only columns that hold glass (tongs hung beside the hookah stay as cut).
  keep     list of [x0, y0, x1, y1]: boxes kept opaque (a rod inside a clear tube).
  tube     list of [y0, y1, xl0, xl1, xr0, xr1]: over rows y0..y1 the silhouette is a straight-walled tube, left wall
           from xl0 to xl1, right wall from xr0 to xr1 (a clear tube the cut-out traced with a wobble).
  fade     rows over which the drawn glass fades in at y_top and out at y_bot (default 16; a few rows where the glass
           starts right under a metal fitting, so the fitting keeps a crisp edge).
  edge_clear  px: over the mat, texture fades out within this distance of the outline (the mat's rings seen through
           the walls run parallel to them and read as a doubled edge). rim_from: row from which the bottom rim's texture
           is borrowed from further in (set by itself for a `fill` foot).
  notex    list of [x0, y0, x1, y1]: no texture and no highlight read there (a speck left in the photo, a highlight
           crossing the outline). stem_glass: weight of the glass's highlights drawn over the opaque downstem; stem_seen:
           how much of the downstem's own pixels show (below 1 the drawn glass, its rim and drips, pass over it).
  spec_mat weight of the highlights read over the mat (default 1): lower where the print's pale ink sparkles through.
  tex_mat  weight of the texture read over the mat (default 1): lower where the mat's print edges still read as lines.
  stem     [x0, y0, x1, y1]: the downstem seen through the glass, kept opaque (round end at y1).
  band     [cx, cy, rx, ry, t, k]: a band between a superellipse's lower arc (exponent k, default 2) and the same arc
           t px lower, kept opaque; its light pixels (the glass's rim, a mat tooth) take the band's own dark colour. band2: a second band. plate [x0, y0, x1, y1]:
           a logo plate kept opaque.
  dark     [L, y0, y1]: pixels darker than L in rows y0..y1, in pieces at least 150 px wide, stay opaque (a black
           rubber ring round the neck).
  mat      list of [cx, cy, rx, ry]: ellipses of glass that look onto the mat. mat_fine: ellipses over the mat's thin
           printed lettering, classed with a 3 px median instead of 9 px.
  holes    true: gaps the cut-out left inside the outline are filled. free_slope: true: a `fill` foot's eased edge keeps
           the trace's own start slope (no limit on it), as before the limit was added.
  erase    list of [x0, y0, x1, y1]: cleared (a mat tooth's smear just outside the glass). erase_light: list of
           [L, x0, y0, x1, y1]: only pixels lighter than L cleared, softly (the wall seen through a gap in the metal).
  bridge   list of [y0, y1, "left"|"right"(, "fill")]: that side of the outline over rows y0..y1 replaced by a cubic that
           meets the edge's own line and slope at both ends (cuts in: a mat tooth or tip on the edge is skipped; with
           "fill" it also fills a dent up to the line, within 60 px of the edge, where the cut-out lost the glass).
  profile  {"pts": [[y, x_left, x_right], ...], "bottom": [cx, cy, rx, ry]}: a hand-read outline for a base no curve fits
           (a globe over a band). From the first row down the silhouette is this shape, filled: each side a smooth
           (monotone cubic) line through its points, closed by the lower arc of the bottom ellipse between the last
           points. Rows above the first point keep the cut-out.
  inset    list of [y0, y1, px, "left"|"right"]: that side of the outline moved in by up to px on a smooth bump
           over rows y0..y1 (a mat tooth's tip stuck to the edge).
  frost    alpha of an etched (frosted) pattern on clear glass: the etching is read against the local clear level
           (whatever is behind it) and drawn white at this alpha; the clear glass between gets the outline only.
  tint     [r, g, b, body(, body_edge)]: coloured glass (body_edge: the alpha where the walls are seen edge-on): the glass's dark layer is this colour (the glass's own colour, darkened, as it
           reads at its edges) and covers the body at alpha `body` (clear glass: the cool grey DARK at 0.05).
  retouch  list of [x0, y0, x1, y1]: small areas LaMa paints over from their surround (mat print seen through a rim).
           retouch_sat: list of [S, x0, y0, x1, y1]: only the pixels more saturated than S (a coloured tie on grey metal).
           retouch_dark: list of [L, x0, y0, x1, y1]: only the pixels darker than L in the box, widened 5 px (a cord or
           rubber band round the neck that is not part of the product).
  tex      [sigma, gain]: the texture band (detail finer than sigma px is texture) and its strength; default [7, 2.2].
           Cut glass with broad facets wants a wider band.
  borrow   [y, dy]: from row y down, the glass's texture is copied from dy rows higher (faded in over 40 rows): for a
           thick cut-glass foot over the mat, where the print and the facets cannot be told apart, the same cut
           pattern from the shoulder above, which stands over the plain wall.
  texture  false: smooth glass with no texture of its own: only outline, body tint and speculars are drawn (as
           --method rebuild), so nothing of the mat can be read into it.
  keep_dark list of [x0, y0, x1, y1, L]: in that box, pixels darker than L stay as cut (a black grommet seen through
           the neck), softened by 1 px; the rest is glass.
  keep_colour list of [x0, y0, x1, y1, C(, cx, cy, rx, ry)]: in that box, the coloured glass (one channel C above the
           other two) stays as cut, as one solid smooth piece (holes filled; below cy only inside the ellipse); the clear
           glass round it is drawn.
  keep_band list of [cx, cy, rx, ry, t, x0, x1]: between the ellipse's lower arc and the same arc t px lower, in
           columns x0..x1 (its ends rounded), stays as cut (a rubber ring seen through the neck: one clean band, its own
           highlights kept).
  rim      [a, d(, b)]: the outline's darker rim, a * exp(-dist / d) + b * exp(-dist / 20) (default [0.50, 3.5, 0.12];
           smooth thin glass wants far less, or it reads as an inked line).
  tex_to   y: with texture off, the texture is still read above row y (the wall behind the upper glass) and fades out
           over 80 rows above it, so the mat below gives none.
  arcs     list of [cx, cy, rx, ry, a0, a1, s, w]: a glass edge the photo shows but the method cannot read over the mat
           (a thick foot's inner ring), measured off the photo: an elliptical arc from angle a0 to a1 (degrees, 0 right,
           90 front; a1 - a0 >= 360 for the whole ring) drawn as a soft dark line of strength s and width w with a
           highlight just inside it where the photo shows the ring bright; the ends fade over 18 degrees.
           A ninth value is the angle the light comes from: the edge is strongest there, a third as strong opposite.
  inner    the thin highlight just inside the outline (default 0.18). body [dark, white]: the even tint of the glass
           (default [0.05, 0]; clear glass reads clearer a touch lighter than the tile than darker).
  streaks  [y0, y1, t]: in rows y0..y1 (over the plain wall), thin vertical streaks brighter than their surround by
           more than t are kept as highlights (the glass's own reflections, fainter than a specular).
  spec_off list of [x0, y0, x1, y1]: no highlight or texture kept there (one that reads as a printed mark).
  spec_min px: highlights in pieces smaller than this are dropped (lone specks read as noise, not as glass).
  tex_median px: the median that takes noise out of the texture before its band is read (default 3); cut glass wants
           about 7, so its facets read as flat planes with crisp edges, not crinkled cellophane.
  mat_gain the strength of the texture read over the mat (default 1): below 1 where the print still shows as blotches.
  thick    list of [cx, cy, rx, ry, y0, s]: glass outside the ellipse and below row y0 (eased over 30 rows) gets s more
           body (the thick foot's front face); a negative s makes it that much lighter instead.
  stem_collar [x0, y0, x1, y1, a]: the stem behind a thick clear collar (the photo shows only the collar's glint there):
           the tube's own colour across its width (its median a little below y1) eased into the box and 20 rows below, fading from strength a at y1 to nothing at
           y0, the sides tapered (the glass drawn over the rest), so the stem runs up to the metal without a pasted-in block.
  keep_above [cx, cy, rx, ry]: above this ellipse's lower arc (a metal flange's curved lower edge) stays as cut.
  keep_below [cx, cy, rx, ry(, ease)]: below this ellipse's upper arc (a water line, a base seen through the glass) the
           glass stays as cut, and beside the ellipse everything below cy - ry - 60 does; the change eases over `ease` px
           (default 10).
  outline  list of [y, cx, hw]: the outline over rows y_first..y_last is this one, read off the photo's visible edges
           (and its mirror where the mat hides one side): centre cx and half-width hw at each knot, joined by a
           monotone cubic (PCHIP), so the glass keeps its real curve where the cut-out guessed one. Below y_last the
           foot (if any) takes over; give its rx the profile's last half-width.
  retouch_in px: the retouch boxes stay this far inside the outline (the rim keeps its own pixels).
  see_through [L0, amax, wall]: tinted glass kept as cut: pixels brighter than L0 (thin glass, the wall seen through it)
           let up to amax of the tile through, their colour solved so that over a wall of grey level `wall` they are the photo.
           It acts on every opaque pixel, glass or not: only for a photo whose bright opaque parts are all tinted glass.
  edge_ease [n, a]: the outer n px of the outline eased to alpha a (tinted glass kept as cut, so its thin rim is not a sticker).
  iris     [s, a(, s0)]: an iridescent coating (see iris()): the drawn glass takes the photo's own hue, raised to power s, and
           the coloured sheen brighter than s0 saturation is laid over it at alpha a.
  glass_profile list of [y, cx, hw]: in those rows the glass is only the part within |x - cx| <= hw (PCHIP between
           knots): a clear bulb standing in an opaque base whose outline the cut-out joins to the bulb's.
  rim      [strength, decay(, broad, broad_decay, inner)]: the outline's dark rim, default [0.50, 3.5, 0.12, 20, 0.18]: a
           thin line, a broad shade inward (glass seen at a slant) and a thin light line 6 px in; smooth glass wants the
           lines lighter.
  texture  "wall": texture read only where the glass stands over the wall or marble (the clean plate); over the mat
           zones only outline, tint and speculars are drawn.
  recolour list of [x0, y0, x1, y1, C, depth]: in that box, the pixels within `depth` px of the outline that are not the
           coloured glass (one channel C above the other two: mat, dish or shadow seen at a coloured base's edge) take the
           colour of the nearest pixel that is, softened over 2 px: the base's own colour carried out to its outline.
  unmat    [cx, cy, rx, ry, y_top(, k)]: tinted see-through glass kept as shot (photo_rgb) over the two-ink mat: inside
           this superellipse (exponent k, default 2) and below y_top, the dark-ink parts of the print are lifted to the
           pale-ink level read locally through the glass (two passes, windows unmat_win, default [81, 45]), so the
           print goes and the glass's reflections stay. unmat_skip: boxes left alone (a downstem). unmat_lift: the
           share of the lift (default 1). unmat_tint [r, g, b]: the region recoloured to the glass's own colour at each
           pixel's level (near-white speculars kept); unmat_gain: that level scaled (below 1: darker glass). With
           unmat_lift 0 only the tint is applied (a pale ink's cast taken out of clear crystal).
  keep_quad list of [y0, y1, xl0, xl1, xr0, xr1]: kept opaque between two straight lines, the format of `tube` (a
           slanted rod inside a clear tube).
  see_through takes an optional fourth value y0: it acts only from that row down (eased over 12 rows).
  photo_rgb true: opaque parts take the photo's own pixels (not the cut-out's), so an `outline` or `foot` that reaches
           a little past rembg's edge shows the product there, not black (a mirrored or iridescent base kept as shot).
  smooth   [x0, x1, depth, sigma]: a coloured (opaque-drawn) base's bottom rim, the `depth` rows above its outline in
           columns x0..x1, blurred along the rim (sigma px) row by row, so the mat print bent through the thick rim goes
           and the rim's own shading (darker edge, the thin pale lip) stays. Near-white speculars are kept.
  add_poly list of polygons [[x, y], ...]: opaque inside, with the photo's own pixels (a pale part the cut-out took for wall).
  tex_light alpha of the glass's own bright detail (finer than tex's sigma, brighter than its surround), drawn white,
           and its bright part left out of the dark texture: bubble glass, whose seeds read white on any tile.
Needs numpy, scipy, pillow, onnxruntime (rembg's venv at C:\\dev\\_tools\\rembg-venv has them) and, for ratio, lama and
any photo with a retouch, the LaMa model (Carve/LaMa-ONNX lama_fp32.onnx, Apache-2.0; --lama PATH).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as nd

LAMA = r"C:\dev\_tools\glass-models\lama_fp32.onnx"
MATTING = r"C:\dev\_tools\glass-models\birefnet-matting.onnx"
H = 2600                                  # PHOTOS entries are in pixels of a photo this tall

PHOTOS = {
    # Panda, drip-textured clear glass on the mat; the downstem runs down to the mat
    "IMG_0689": {"foot": [1013, 2310, 314, 205, 2.6, 40], "fill": True,
                 "bridge": [[2060, 2180, "left", "fill"], [2230, 2370, "left", "fill"], [2200, 2320, "right", "fill"]],
                 "notex": [[1265, 2420, 1300, 2452]], "retouch": [[936, 470, 1030, 532]], "stem_glass": 1.0, "stem_seen": 1.0, "fade": 3, "tex_mat": 0.6, "edge_clear": 45, "glass": [1612, 2600], "stem": [984, 1612, 1035, 2228],
                 "mat": [[1015, 2330, 335, 225]], "mat_fine": [[1010, 2305, 140, 45]]},
    # crew 1 (2026-11-28), the Drive batch: shot upright on the marble table against the wall, no mat. Mirrored, smoked or
    # iridescent glass is kept as photographed (photo_rgb), only its outline read off the photo (the cut-out took marble and
    # shadow round the foot)
    "PXL_20261128_000402468": {"photo_rgb": True, "foot": [985, 2110, [237, 237], 165, 2.0, 0, 60], "fill": True},
    "PXL_20261128_000920111": {"photo_rgb": True, "fade": 3, "foot": [1033, 2290, [241, 241], 212, 2.4, 0, 60], "fill": True,
                               "outline": [[1650, 1028, 83], [1700, 1028, 83], [1750, 1027.5, 82.5], [1800, 1028.5, 82.5], [1900, 1029.5, 82.5],
                                           [1930, 1030.5, 84.5], [1960, 1031, 90], [1990, 1031, 98], [2020, 1031, 109], [2050, 1031.5, 123.5],
                                           [2080, 1031.5, 146], [2110, 1031.5, 173.5], [2140, 1032, 195], [2170, 1032, 212], [2200, 1032.5, 225.5],
                                           [2230, 1033, 235], [2260, 1033, 239.5], [2290, 1033, 241]]},
    # clear bubble glass (drawn by the ratio method over the wall/marble plate); a lip ring under the black cone; the foot
    # a thick flat disc (its ellipse read off the photo); two highlight drips through the foot not read as texture
    "PXL_20261128_000711649": {"glass": [1572, 2600], "fade": 3, "foot": [991, 2215, [253, 253], 125, 2.0, 0, 60], "fill": True, "stem": [980, 1612, 1010, 2040], "outline": [[1575, 993, 89], [1592, 993, 89], [1625, 991.5, 88], [1640, 991, 82], [1660, 991, 75], [1690, 991, 73], [1720, 990.5, 70], [1750, 990.5, 66.5], [1780, 990.5, 64.5], [1840, 991, 64], [1870, 991, 67], [1900, 991, 73], [1930, 990.5, 86], [1960, 990, 113], [1990, 990, 160], [2020, 989.5, 203], [2050, 989.5, 231], [2080, 989, 247.5], [2110, 988.5, 256], [2140, 988, 258], [2170, 990, 256], [2200, 990, 253], [2215, 991, 253]], "keep_above": [991, 1590, 91, 22], "tex": [9, 4.5], "stem_seen": 0.6, "arcs": [[991, 1622, 88, 10, 0, 180, 0.18, 3.0]], "notex": [[995, 2295, 1042, 2348], [1112, 2262, 1152, 2328]], "rim": [0.25, 2.5, 0.1]},
    # champagne mirrored glass base kept as shot; the tray's clear disc drawn as glass inside its steel ring (the ring kept)
    "PXL_20261128_001048012": {"foot": [1030, 2390, [287, 287], 168, 2.0, 0, 60], "fill": True, "outline": [[2200, 1029.5, 231], [2230, 1030, 256], [2260, 1030, 272], [2290, 1030, 281], [2320, 1030, 285.5], [2350, 1030, 287], [2390, 1030, 287]], "photo_rgb": True, "glass_extra": [[1104, 1168]], "keep": [[995, 1104, 1060, 1168]], "glass_profile": [[1104, 1033, 0.0], [1108, 1033, 169.4], [1112, 1033, 231.5], [1116, 1033, 273.2], [1120, 1033, 303.1], [1124, 1033, 324.5], [1128, 1033, 338.9], [1132, 1033, 347.3], [1136, 1033, 350.0], [1140, 1033, 347.3], [1144, 1033, 338.9], [1148, 1033, 324.5], [1152, 1033, 303.1], [1156, 1033, 273.2], [1160, 1033, 231.5], [1164, 1033, 169.4], [1168, 1033, 0.0]], "fade": 3},
    # stone mosaic stem and base, kept as shot; the foot's outline read off the photo
    "PXL_20261128_001542699": {"photo_rgb": True, "foot": [968, 2420, [168, 168], 134, 2.3, 0, 60], "fill": True},
    # painted opaque base, off the mat
    "IMG_0670": {"foot": [1028, 2400, [174, 176], 112, 2.0], "fill": True},
    # clear glass on marble, black rubber ring round the neck
    # (the black cord tied round the neck, with its clip, is the shop's, not the hookah's: painted out)
    "IMG_0679": {"glass": [1752, 2530], "fade": 3,
                 "profile": {"pts": [[2070, 874, 1143], [2090, 827, 1187], [2110, 797, 1217], [2130, 775, 1238], [2150, 759, 1255],
                                     [2170, 746, 1267], [2190, 737, 1276], [2210, 733, 1281], [2240, 729, 1283], [2270, 728, 1282],
                                     [2300, 731, 1276], [2330, 736, 1263], [2380, 745, 1249]], "bottom": [997, 2380, 252, 128]},
                 "retouch": [[893, 2033, 927, 2068]], "notex": [[888, 2035, 925, 2072]], "stem": [982, 1752, 1035, 2243], "retouch_dark": [[80, 880, 1995, 1150, 2110]],
                 "bridge": [[1990, 2095, "right", "fill"], [2015, 2095, "left", "fill"]]},
    # yellow frit base (opaque) on the mat
    "IMG_0697": {"foot": [1022, 2295, [333, 327], 245, 2.0, 60, 170], "fill": True, "bridge": [[2118, 2215, "left"], [2118, 2190, "right"]], "inset": [[2300, 2490, 7, "left"]]},
    # smooth clear glass on the mat, black base band with a logo plate (both part of the hookah)
    "IMG_0701": {"foot": [997.5, 2415, [296, 296], 125, 2.0, 0, 60], "fill": True, "glass": [1664, 2560], "stem": [962, 1745, 1010, 2180],
                 # outline read off the photo: the neck (over the wall), the fillet into the flattened dome, both shoulders
                 # (the right one over the marble, the left one beside the table's edge), the sides at 299 px
                 "outline": [[1684, 977, 89], [1700, 978, 87], [1720, 980, 84], [1760, 980, 82], [1800, 981, 80], [1840, 981, 75], [1880, 982, 70],
                             [1920, 984, 68], [1960, 985, 67], [2000, 986, 66], [2025, 987, 67], [2040, 988, 74], [2052, 990, 100],
                             [2062, 992, 140], [2081, 994, 195], [2106, 996, 232], [2125, 997, 254], [2156, 997.5, 276],
                             [2185, 997.5, 289], [2212, 997.5, 295], [2250, 997.5, 298.5], [2300, 997.5, 299], [2360, 997.5, 298], [2415, 997.5, 296]],
                 "band": [997.5, 2340, 297, 118, 52, 2.0], "plate": [917, 2464, 1027, 2524],
                 # the metal's curved lower edge, and the black grommet seen through the neck's top
                 "keep_above": [978, 1652, 112, 32], "keep_dark": [[900, 1684, 1062, 1752, 95]],
                 "texture": "wall", "rim": [0.20, 2.5, 0.16, 30, 0.05],
                 "mat": [[998, 2290, 320, 250], [998, 2470, 320, 95]], "mat_fine": [[1015, 2335, 170, 55]]},
    # cut-glass (faceted) clear base on the mat, clear collar under the stem's metal
    "IMG_0687": {"foot": [993, 2320, [308, 312], 205, 3.2, 60, 60], "fill": True, "glass": [1650, 2600], "stem": [972, 1768, 1012, 2290],
                 "keep_above": [995, 1656, 130, 43], "mat": [[993, 2490, 330, 110]], "tex": [20, 2.6], "tex_to": 2410, "mat_gain": 0.0,
                 "stem_collar": [972, 1700, 1012, 1768, 1.0], "spec_off": [[955, 1692, 1035, 1714], [955, 1735, 1035, 1770]],
                 "bridge": [[2040, 2140, "left"], [2040, 2140, "right"]],
                 "rim": [0.0, 2.0, 0.08], "inner": 0.14, "body": [0.0, 0.03], "spec_min": 25},
    # smooth clear bulb standing in a wide clear dish, both on the mat
    "IMG_0690": {"foot": [1046, 2140, [207, 207], 115, 2.5, 0, 60], "fill": True, "glass": [1698, 2600], "stem": [1017, 1735, 1078, 2185],
                 # Smokah Professional: neck and bulb read off the photo (over the wall); the bulb's round bottom where it meets the
                 # flared foot; the foot a thick glass disc (its rim ellipse and wall read off the photo; the maker's photo shows
                 # the same foot)
                 "outline": [[1712, 1048, 76], [1722, 1048, 73.5], [1760, 1047, 73], [1800, 1047, 70], [1840, 1046, 70], [1880, 1045.5, 76.5],
                             [1920, 1045, 89], [1960, 1043.5, 111], [2000, 1043, 152], [2040, 1044, 188], [2080, 1045, 203],
                             [2110, 1046, 206.5], [2140, 1046, 207]],
                 "disc": [1046, 2295, 300, 208, 22, 0.4], "keep_above": [1047, 1700, 86, 33],
                 "texture": "wall", "rim": [0.28, 3.0, 0.16, 30], "mat": [[1046, 2295, 330, 232]]},
    # smooth clear vase on the mat (MOZE seen through its bottom)
    "IMG_0695": {"foot": [1000, 2320, [269, 271], 210, 2.2, 60, 60], "fill": True, "glass": [1700, 2600], "stem": [958, 1745, 1018, 2188],
                 "keep_above": [988, 1703, 100, 42], "texture": False, "tex_to": 2030, "rim": [0.0, 2.0, 0.06], "inner": 0.14, "body": [0.0, 0.04], "spec_min": 80, "tex": [20, 2.4], "streaks": [1750, 2250, 10],
                 "spec_off": [[955, 2190, 1000, 2255]],
                 "arcs": [[997, 2396, 163, 116, 350, 550, 0.07, 3.2], [997, 2396, 163, 116, 170, 370, 0.04, 3.2]],
                 "thick": [[997, 2396, 163, 116, 2470, 0.12]]},
    # smooth clear bell base on the mat (MOZE seen through it); thick glass lip and a black grommet under the gold top
    "IMG_0700": {"foot": [940, 2340, [355, 352], 197, 2.0, 0, 60], "fill": True, "glass": [1520, 2600], "stem": [912, 1600, 965, 2185],
                 "keep_above": [958, 1530, 140, 38], "keep_band": [[958, 1560, 150, 36, 41, 848, 1062]], "texture": False,
                 "tex_to": 2080, "rim": [0.0, 2.0, 0.06], "inner": 0.14, "body": [0.0, 0.04], "spec_min": 80, "tex": [20, 2.4], "streaks": [1650, 2080, 10], "spec_off": [[945, 2200, 970, 2240], [955, 2415, 1005, 2455]],
                 "arcs": [[940, 2340, 343, 187, 15, 165, 0.0, 3.0], [940, 2340, 349, 193, 140, 200, 0.05, 2.5, 180]],
                 "thick": [[940, 2340, 343, 187, 2460, -0.10]],
                 "bridge": [[1990, 2100, "left"], [2140, 2300, "right"], [2245, 2310, "left"]]},
    # blue swirl glass bell on a wide clear foot, on the mat
    "IMG_0698": {"foot": [1010, 2280, [207, 207], 132, 2.0, 0, 60], "fill": True,
                 "recolour": [[780, 2080, 1240, 2430, 30, 18]],
                 # the clear dish under the bell is left off, as on the yellow one (IMG_0699): the blue bell's own outline, read
                 # off the photo (the waist and shoulders where they meet the dish; the bottom an ellipse fitted to the blue's edge)
                 "outline": [[2040, 1010, 112], [2060, 1011, 108], [2080, 1012, 103], [2095, 1012, 102], [2120, 1012, 104],
                             [2135, 1012, 125], [2150, 1012, 158], [2170, 1011, 177], [2200, 1011, 192], [2230, 1010, 201],
                             [2260, 1010, 206], [2280, 1010, 207]]},
    # smoked textured glass, off the mat: the cut-out took some of the counter's shadow along the foot
    "IMG_0674": {"foot": [976, 2331, [325, 327], 236, 2.0, 0, 60], "fill": True},
    "IMG_0678": {"foot": [955, 2342, [293, 295], 207, 2.0, 0, 60], "fill": True},
    # yellow frit base on the mat: two mat-tooth stubs on the shoulders
    "IMG_0699": {"foot": [977, 2293, [204, 205], 133, 2.0, 0, 60], "fill": True,
                 "bridge": [[2128, 2200, "right"], [2122, 2190, "left"], [2205, 2292, "left"]],
                 "inset": [[2300, 2425, 3, "left"]]},
    # green moulded glass base on the mat; white ceramic-look base on the mat (teeth round both feet)
    "IMG_0683": {"foot": [1015, 2345, [282, 274], 183, 2.3, 60, 60], "fill": True, "smooth": [700, 1340, 70, 30]},
    "IMG_0688": {"foot": [1018, 2255, [376, 378], 245, 2.0, 0, 60], "fill": True, "glass": [1684, 2100], "stem": [987, 1700, 1043, 2050],
                 # the gold band's curved lower edge; the white base's back rim seen through the bulb, meeting the base's outline at both
                 # bulb edges (y 2004 left, 2019 right, read off the cut-out)
                 "keep_above": [1012, 1700, 104, 42], "keep_below": [990, 2043, 240, 52, 6],
                 # the bulb's outline (over the wall, from the cut-out; it holds its width down into the base's well): the white
                 # base's top beside it is not glass
                 "glass_profile": [[1700, 1012.5, 102.5], [1740, 1015.5, 90.5], [1780, 1016.5, 96.5], [1820, 1017, 112],
                                   [1860, 1018, 135], [1900, 1019, 157], [1940, 1019, 173], [1980, 1019, 181], [2000, 1018.5, 182.5],
                                   [2040, 1018, 183], [2100, 1018, 183]],
                 "inset": [[2240, 2440, 2, "left"]],
                 "retouch": [[1322, 2252, 1352, 2282]]},
    # blue frit base (opaque) on the mat; mat print shows through its rim at the front
    "IMG_0715": {"foot": [990, 2330, 286, 170, 2.6, 60], "retouch": [[1120, 2410, 1230, 2480], [705, 2420, 805, 2500], [1180, 2395, 1275, 2490]]},
    # group B (2026-11-28): clear or blue glass standing on the mat
    "IMG_0705": {"profile": {"pts": [[1790, 875, 1064], [1850, 866, 1069], [1912, 851, 1091], [1969, 826, 1120], [2012, 795, 1148],
                                     [2056, 757, 1178], [2100, 726, 1200], [2150, 705, 1216], [2200, 692, 1225], [2250, 689, 1229],
                                     [2300, 692, 1226], [2350, 701, 1216], [2390, 717, 1200]],
                             "bottom": [958.5, 2390, 241.5, 62]}, "fade": 3, "tex_mat": 0.35, "glass": [1715, 2600], "stem": [950, 1715, 990, 2140],
                 "mat": [[960, 2350, 310, 250]], "tint": [15, 85, 205, 0.30, 0.70], "edge_clear": 50},
    "IMG_0706": {"foot": [1017, 2310, [322, 324], 255, 2.5, 60], "fill": True, "glass": [1650, 2600], "stem": [965, 1650, 1025, 2240],
                 "mat": [[1015, 2350, 345, 250]], "mat_fine": [[1015, 2330, 180, 45]], "tex_mat": 0.4,
                 "retouch": [[1022, 1835, 1068, 1945]]},          # a price sticker on the back of the neck
    "IMG_0709": {"foot": [948, 2360, [288, 291], 125, 2.6, 250], "fill": True, "free_slope": True, "glass_x": [600, 1300], "fade": 3, "tex_mat": 0.3, "edge_clear": 50,
                 "bridge": [[2245, 2415, "right", "fill"]], "erase_light": [[150, 1120, 903, 1245, 934]],
                 "retouch_sat": [[60, 1370, 1540, 1460, 1680]], "spec_mat": 0.35, "glass": [1705, 2600], "stem": [918, 1705, 987, 2262],
                 "mat": [[950, 2330, 320, 230]], "mat_fine": [[950, 2300, 120, 70]]},
    "IMG_0712": {"profile": {"pts": [[1700, 907, 1087], [1800, 925, 1081], [1900, 931, 1080], [1975, 927, 1092], [2000, 920, 1099],
                                     [2025, 912, 1109], [2050, 900, 1124], [2075, 884, 1145], [2100, 862, 1172], [2125, 826, 1210],
                                     [2150, 790, 1240], [2200, 758, 1272], [2250, 738, 1290], [2300, 728, 1300], [2350, 728, 1297],
                                     [2400, 740, 1282], [2430, 760, 1262], [2455, 795, 1228]], "bottom": [1012, 2440, 218, 40]},
                 "fade": 3, "tex_mat": 0.3, "edge_clear": 50, "rim_from": 2390, "glass": [1612, 2600],
                 "glass_extra": [[795, 1500]], "keep": [[935, 795, 1010, 1500]], "tube": [[805, 1495, 858, 893, 1071, 1089]], "stem": [985, 1612, 1035, 2225],
                 "mat": [[1015, 2330, 330, 230]], "mat_fine": [[1015, 2310, 170, 50]]},
    # black glass hookah: an etched (frosted) clear globe over a black band, on the mat; the globe is drawn, the band kept
    "IMG_0710": {"profile": {"pts": [[2000, 889, 1136], [2040, 848, 1179], [2080, 819, 1206], [2100, 809, 1216], [2130, 800, 1226],
                                     [2160, 795, 1231], [2200, 792, 1233], [2250, 795, 1232], [2300, 802, 1225], [2350, 817, 1212],
                                     [2380, 831, 1200], [2400, 842, 1190], [2440, 845, 1186], [2470, 853, 1176], [2490, 870, 1158]],
                             "bottom": [1013, 2440, 172, 75]},
                 "glass": [1995, 2600], "band": [1013, 1850, 160, 90, 200], "band2": [1013, 2380, 176, 52, 150],
                 "stem": [1015, 2125, 1042, 2265], "frost": 0.6, "band_print": True},
    "IMG_0714": {"profile": {"pts": [[1658, 921, 1081], [1800, 921, 1082], [1900, 922, 1083], [1950, 917, 1087], [1980, 908, 1097], [2000, 892, 1112], [2015, 862, 1140], [2030, 822, 1185],
                                     [2045, 785, 1228], [2060, 755, 1262], [2080, 730, 1287], [2105, 707, 1310], [2140, 692, 1327], [2180, 683, 1337], [2250, 679, 1341],
                                     [2350, 679, 1340], [2420, 686, 1334], [2450, 698, 1322], [2475, 725, 1295]], "bottom": [1009, 2455, 300, 62]},
                 "fade": 3, "tex_mat": 0.25, "edge_clear": 60, "glass": [1655, 2600], "stem": [965, 1655, 1035, 2195],
                 "mat": [[1005, 2300, 350, 280]], "mat_fine": [[1005, 2280, 160, 90]]},
}

# Crew 2 (2026-11-28): the second batch's shop hookahs (Drive photos, 1958 x 2600 after the resize), OSS-140065 upward.
PHOTOS_CREW2 = {
    # OSS-140065 champagne mirrored teardrop (opaque: it reflects the shop, nothing seen through it), on the mat
    "PXL_20261128_010247337": {"foot": [1000, 2400, [202, 202], 178, 2.1, 0, 60], "fill": True,
                               "bridge": [[2200, 2360, "left"], [2200, 2360, "right"]], "inset": [[2370, 2560, 9, "left"]]},
}
PHOTOS.update(PHOTOS_CREW2)
PHOTOS_CREW6 = {
    # OSS-140080 Smokah, bubble-glass base on the marble
    "IMG_0734": {"foot": [1050, 2300, [306, 307], 237, 3.0, 0, 60], "fill": True, "glass": [1795, 2560], "stem": [1012, 1800, 1084, 2215], "keep_dark": [[960, 1785, 1140, 1825, 60]], "notex": [[925, 1790, 1125, 1860]],
                 "glass_extra": [[812, 880]], "fade": 3, "tex": [12, 5.0], "tex_median": 1, "tex_light": 0.8},
    # OSS-140081 clear teardrop base standing in a clear dish, black stem with a clear tube, on the marble
    "IMG_0725": {"foot": [1033, 2160, [242, 242], 160, 2.2, 0, 60], "fill": True, "disc": [1039, 2350, 305, 160, 18, 0.5],
                 "glass": [1615, 2560], "stem": [998, 1615, 1054, 2089], "keep_dark": [[925, 1600, 1115, 1655, 70]], "notex": [[955, 1612, 1080, 1672]], "glass_extra": [[812, 1095]],
                 "keep": [[956, 800, 1022, 1105]], "fade": 3, "tex_light": 0.6, "rim": [0.3, 3.0, 0.08],
                 # the table's back edge seen through the bulb, and the shop's gold foil sticker on its shoulder, painted out
                 "retouch": [[880, 1995, 997, 2020], [1055, 1995, 1290, 2020], [895, 1860, 990, 1970]]},
    # OSS-140083 gold trophy stem on a mirrored gold football base: opaque, kept as shot; the pale plate under the tray
    # arm (seen edge-on, with its small third lobe at the right) is put back, the cut-out took it for wall
    "IMG_0727": {"photo_rgb": True, "erase": [[632, 1054, 955, 1068]],
                 "add_poly": [[[628, 1046], [800, 1043], [1100, 1040], [1330, 1037], [1327, 1041], [1100, 1046], [800, 1049], [628, 1052]],
                                                 [[1240, 1037], [1290, 1025], [1318, 1012], [1328, 1016], [1322, 1030], [1300, 1038]]]},
    # OSS-140085 clear acrylic tube on a lit black base: straight walls, the black downstem kept, the frosted foot ring as shot
    "IMG_0737": {"glass": [1058, 1900], "tube": [[1060, 1900, 846, 871, 1140, 1149]], "stem": [961, 1058, 1030, 1628], "erase_light": [[175, 1029, 1560, 1046, 1632]], "photo_rgb": True, "streaks": [1120, 1880, 8], "tex_light": 0.6,
                 "fade": 3, "rim": [0.3, 3.0, 0.08]},
    # OSS-140084 deep red glass base (kept as shot: the marble barely shows through it), rifle-rail stem with scope and
    # light; the marble vein bent through the base's front painted out
    "IMG_0728": {"photo_rgb": True, "retouch": [[1095, 2350, 1180, 2505]],
                 # the wall seen through the rail's diamond holes (both side columns; the engraved labels in the middle stay)
                 "erase_light": [[180, 880, 780, 940, 1450], [180, 1005, 780, 1085, 1450], [180, 700, 1295, 725, 1375]]},
}
PHOTOS.update(PHOTOS_CREW6)

# Crew 5 (2026-11-28): Drive-batch shop hookahs, OSS-140035 upward (1958 x 2600 after the resize).
PHOTOS_CREW5 = {
    # OSS-140038 MISHAISMYSHISHA blue: smoked black embossed glass, opaque as shot, on the mat: the foot cuts the mat off
    "PXL_20261128_003327263": {"photo_rgb": True, "foot": [1021, 2336, [256, 256], 146, 2.6, 0, 60], "fill": True,
                               "inset": [[2340, 2440, 10, "right"]], "erase_light": [[150, 1225, 2380, 1290, 2450],
                               # the mask charm's eye and mouth holes and the gap between tray and charm show the wall
                               [175, 1054, 1017, 1072, 1034], [175, 1078, 1017, 1096, 1034], [175, 1064, 1040, 1087, 1056],
                               [185, 1052, 986, 1106, 995], [140, 1052, 984, 1067, 997], [140, 1078, 984, 1106, 997]]},
    # OSS-140039 MISHAISMYSHISHA pink: black and white swirl glass, opaque, on the mat
    "PXL_20261128_003758009": {"photo_rgb": True, "foot": [975, 2400, [252, 246], 185, 2.1, 0, 60], "fill": True,
                               "bridge": [[2170, 2390, "left"]],
                               # the charm's ring and its eye and mouth holes show the wall
                               "erase_light": [[180, 1169, 1067, 1178, 1079], [180, 1157, 1108, 1170, 1123],
                                               [180, 1176, 1106, 1189, 1122], [180, 1164, 1127, 1181, 1145],
                                               [180, 1145, 1066, 1167, 1085], [180, 1179, 1066, 1196, 1082]]},
    # OSS-140040 MYA green: deep green moulded glass kept as shot, on the mat: outline read off the photo (two tiers), mat cut off
    "PXL_20261128_004255952": {"photo_rgb": True, "foot": [996, 2330, [256, 256], 182, 2.2, 0, 60], "fill": True,
                               "outline": [[2060, 997, 190], [2100, 998, 204], [2130, 998, 202], [2165, 998, 186], [2200, 998, 199],
                                           [2240, 998, 234], [2280, 997, 253], [2330, 996, 256]]},
    # OSS-140043 Contraband: black embossed glass, opaque as shot, on the mat
    "PXL_20261128_004629722": {"photo_rgb": True, "foot": [970, 2330, [261, 261], 161, 2.1, 0, 60], "fill": True,
                               "outline": [[2140, 972, 160], [2160, 971, 176], [2200, 972, 210], [2240, 968, 240], [2280, 968, 253],
                                           [2330, 970, 261]]},
}
PHOTOS.update(PHOTOS_CREW5)

# crew 3 (2026-11-28): the standing batch, on the marble table (no mat)
PHOTOS.update({
    # iridescent clear glass on marble, chrome neck (OSS-140102)
    "IMG_0759": {"foot": [942, 2315, [283, 283], 205, 2.6, 0, 60], "fill": True, "glass": [1826, 2530], "fade": 3,
                 "stem": [905, 1838, 948, 2283], "iris": [1.4, 0.9, 0.05], "thick": [[942, 2315, 255, 168, 2290, 0.25]],
                 "keep_above": [928, 1825, 80, 14], "rim": [0.10, 3.0, 0.02], "inner": 0.3, "tex": [7, 1.4], "bridge": [[2230, 2345, "left"]],
                 "tint": [55, 105, 115, 0.06, 0.5], "notex": [[950, 1840, 1010, 2030], [880, 1840, 905, 1880]]},
    # smooth clear glass on marble, gold collar (OSS-140100)
    "IMG_0757": {"foot": [970, 2330, [280, 280], 182, 2.4, 0, 60], "fill": True, "glass": [1765, 2520], "fade": 3,
                 "stem": [963, 1800, 992, 2268], "keep_above": [970, 1792, 100, 28], "rim": [0.3, 3.0, 0.06], "thick": [[970, 2330, 258, 152, 2300, 0.10]],
                 "bridge": [[2030, 2130, "right"]],
                 "erase_light": [[140, 872, 1745, 906, 1826], [140, 1056, 1745, 1088, 1826]]},
    # smoky olive moulded lion-head glass, kept as photographed (OSS-140101): the marble seen through its lower left
    # painted out from the glass round it, the thin bright glass letting some tile through, the outer 6 px eased to 65%
    "IMG_0758": {"retouch": [[640, 2195, 790, 2335]], "retouch_in": 6, "edge_ease": [6, 0.65], "see_through": [120, 0.35, 225]},
})

# Crew 7 (2026-11-28): Drive-batch shop hookahs, OSS-140041 upward (1958 x 2600 after the resize).
PHOTOS_CREW7 = {
    # OSS-140041 smoked see-through base on the mat, clear tube column with a steel rod inside
    # (the smoked glass kept as shot, the print seen through it lifted out by unmat; the tube drawn as clear glass)
    "PXL_20261128_004355270": {"photo_rgb": True, "foot": [956, 2350, [279, 279], 198, 1.8, 0, 60], "fill": True,
                               "unmat": [956, 2350, 272, 182, 2160, 1.8], "unmat_gain": 0.7, "unmat_tint": [87, 82, 66], "see_through": [70, 0.2, 110, 1845], "unmat_skip": [[934, 2160, 975, 2280], [935, 2280, 968, 2292], [941, 2292, 962, 2300]],
                               "glass_extra": [[1035, 1695]], "fade": 3, "tube": [[1035, 1650, 826, 846, 1020, 1031]],
                               "keep_quad": [[1035, 1650, 897, 911, 949, 962]], "keep_below": [940, 1668, 105, 32, 3]},
    # OSS-140042 cut-crystal base on the mat's pale ink, kept as shot: the mat ring cut off by the foot, the pale ink's
    # cyan cast taken out (unmat with no lift: tint only), the bright crystal letting some tile through
    "PXL_20261128_004452376": {"photo_rgb": True, "foot": [1023, 2370, [245, 245], 164, 2.0, 170, 60], "fill": True, "bridge": [[2215, 2345, "right"], [2215, 2345, "left"]],
                               "unmat": [1020, 2370, 262, 190, 2190], "unmat_lift": 0, "unmat_tint": [1, 1, 1],
                               "see_through": [150, 0.35, 205, 1890]},
}
PHOTOS.update(PHOTOS_CREW7)

# Crew 9 (2026-11-28): Drive-batch shop hookahs, OSS-140044 upward (1958 x 2600 after the resize).
PHOTOS_CREW9 = {
    # OSS-140058 black faceted glass base, opaque as shot, on the mat's black ring: the outline (read off the glass's grey
    # lip) cuts the ring off; the clear bowl on top drawn as glass, its green swirl's hue kept (iris)
    "PXL_20261128_011030855": {"photo_rgb": True, "foot": [955, 2320, [310, 310], 212, 2.6, 0, 60], "fill": True, "glass_extra": [[478, 657]], "fade": 3, "iris": [1.0, 1.0, 0.06], "rim": [0.3, 3.0, 0.08], "body": [0.12, 0.10], "tex": [7, 3.2],
                               "outline": [[2100, 962.5, 204.5], [2120, 962.5, 221.5], [2140, 963.5, 241], [2160, 962, 259], [2200, 960, 285], [2240, 959.5, 302.5], [2280, 960.5, 309.5], [2320, 960.5, 310.5],
                                           [2360, 960, 305], [2400, 961, 294], [2430, 963, 283], [2463, 967.5, 252.5], [2480, 970, 235], [2497, 965, 205], [2513, 961, 164], [2525, 955, 116]]},
    # OSS-140060 MattPear black crackle base, opaque as shot, on the mat's black ring
    "PXL_20261128_005851370": {"photo_rgb": True, "foot": [950, 2320, [258, 258], 185, 2.3, 0, 60], "fill": True,
                               "outline": [[2120, 961, 137], [2140, 961, 154], [2160, 959, 176], [2180, 958, 198], [2200, 957, 221],
                                           [2230, 959.5, 237.5], [2260, 960, 247], [2280, 960.5, 252.5], [2320, 957, 256], [2360, 955.5, 255.5], [2400, 955, 247], [2420, 953, 230], [2440, 953, 214], [2460, 953, 189.4], [2480, 953, 152.2], [2495, 951.5, 104.1]]},
    # OSS-140061 MattPear, smooth clear base on the marble (no mat): drawn by the ratio method over the clean plate
    "IMG_0745": {"foot": [1022, 2310, [304, 304], 211, 2.4, 0, 60], "fill": True, "glass": [1640, 2560], "fade": 3,
                 # the grey rubber grommet in the mouth, the steel downstem and its diffuser kept as shot
                 "keep_quad": [[1666, 1737, 941, 943, 1077, 1075], [1733, 1742, 943, 955, 1075, 1066], [1738, 1748, 955, 985, 1066, 1042], [1744, 2200, 989, 1003, 1043, 1058], [2193, 2203, 1003, 997, 1067, 1073], [2197, 2256, 997, 997, 1073, 1073], [2252, 2257, 997, 998, 1073, 1072], [2254, 2259, 997, 1000, 1073, 1070], [2256, 2261, 998, 1002, 1072, 1068], [2258, 2263, 1000, 1005, 1070, 1065], [2260, 2265, 1002, 1010, 1068, 1060], [2262, 2267, 1005, 1017, 1065, 1053], [2264, 2269, 1010, 1035, 1060, 1035], [2266, 2271, 1017, 1035, 1053, 1035]],
                 "keep_above": [1005, 1640, 110, 40], "rim": [0.4, 3.0, 0.12], "body": [0.10, 0.05],
                 "thick": [[1022, 2300, 268, 182, 2380, 0.25]], "spec_min": 30},
    # OSS-140064 clear bulb standing in a black dish stand (on the mat): bulb drawn as glass over the wall, the dish seen
    # through its lower part kept as cut, the stand's outline a superellipse that cuts the mat ring off
    "PXL_20261128_010217372": {"foot": [972, 2275, [351, 351], 239, 2.2, 120, 60], "fill": True, "glass": [1805, 2240], "fade": 3,
                               "stem": [948, 1805, 990, 2075], "keep_below": [972, 2241, 351, 235, 5], "rim": [0.3, 3.0, 0.06]},
    # OSS-140051 quilted cut-crystal base on the mat, kept as shot (HELD: the mat's black ring shows through its edges and
    # foot; unmat's lift turns the cut pattern milky, so only the cyan cast is taken out here)
    "PXL_20261128_005254462": {"photo_rgb": True, "foot": [970, 2290, [308, 308], 243, 2.7, 0, 60], "fill": True,
                               "outline": [[2110, 968, 220], [2140, 965, 258], [2170, 967, 280], [2200, 969.5, 291.5], [2250, 969.5, 306], [2290, 970, 308]],
                               "unmat": [970, 2290, 300, 236, 2120, 2.7], "unmat_lift": 0, "unmat_tint": [1, 1, 1],
                               "see_through": [150, 0.35, 205, 1820]},
}
PHOTOS.update(PHOTOS_CREW9)

DARK = np.array([36, 44, 50], float)     # the glass's dark layer: a cool grey, as clear soda glass reads at a slant


def lum(rgb):
    return rgb @ np.array([0.2126, 0.7152, 0.0722])


def ell(h, w, cx, cy, rx, ry):
    y, x = np.mgrid[0:h, 0:w]
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def foot_alpha(h, w, f):
    """Soft (anti-aliased) mask of the base's outline: 1 inside, 0 outside, only below row cy - side."""
    cx, cy, rx, ry, k = f[:5]
    if isinstance(rx, (list, tuple)):
        raise ValueError("foot: rx as [left, right] needs \"fill\": true")
    side = f[5] if len(f) > 5 else 0
    y, x = np.mgrid[0:h, 0:w].astype(float)
    dx = np.abs(x - cx)
    t = np.clip((y - cy) / ry, 0, 1)
    hw = np.where(y <= cy, rx, rx * np.clip(1 - t ** k, 0, 1) ** (1 / k))
    a = np.clip(hw - dx + 0.5, 0, 1)
    u = np.clip(dx / rx, 0, 1)
    bottom = cy + ry * np.clip(1 - u ** k, 0, 1) ** (1 / k)
    a = np.minimum(a, np.clip(bottom - y + 0.5, 0, 1))
    return np.where(y < cy - side, 1.0, a)


def fill_alpha(cut_a, f, blend=60, clamp=True):
    """For a base the cut-out is unsure of: above row cy - blend the cut-out's own outline; below cy the fitted curve,
    filled; in between, the traced edges ease into the curve. The traced edges are median-smoothed (a mat tooth does
    not count), and the curve's half-width on each side is read off the smoothed trace just above cy (unless the foot
    gives rx as [left, right]), so the two meet without a kink. For `side` rows above the blend the cut-out is also
    held inside its own smoothed trace, which takes off a tooth or nub there."""
    cx, cy, rx, ry, k = f[:5]
    side = f[5] if len(f) > 5 else 0
    blend = f[6] if len(f) > 6 else blend
    h, w = cut_a.shape
    sil = cut_a.astype(float) / 255
    m = cut_a > 127
    if isinstance(rx, (list, tuple)):      # the trace looks only near the base: tongs or a hose beside it do not count
        xx_ = np.arange(w)
        m = m & ((xx_ > cx - rx[0] - 80) & (xx_ < cx + rx[1] + 80))[None, :]
    y0 = int(cy - blend)
    ys = max(0, int(cy - blend - max(side, 30)))
    rows = np.arange(ys, min(int(cy), h - 1) + 1)
    tl = np.array([np.flatnonzero(m[r]).min() if m[r].any() else cx - 1 for r in rows], float)
    tr = np.array([np.flatnonzero(m[r]).max() if m[r].any() else cx + 1 for r in rows], float)
    tl, tr = nd.median_filter(tl, 41, mode="nearest"), nd.median_filter(tr, 41, mode="nearest")
    if isinstance(rx, (list, tuple)):
        rxl, rxr = rx
    else:
        rxl, rxr = cx - np.median(tl[-12:]), np.median(tr[-12:]) - cx
    # above its widest row the base is no wider than that: from the first row where the trace runs out past it (a mat
    # tooth or the mat itself), the edge eases from its last good point to the full width at cy instead of being clipped
    for t_, lim, out_ in ((tl, cx - rxl, lambda v, l: v < l), (tr, cx + rxr, lambda v, l: v > l)):
        bad = np.flatnonzero(out_(t_, lim))
        if len(bad) and bad[0] > 0:
            # a cubic that leaves the trace 40 rows before it runs out, with the trace's own slope, and lands on the full
            # width at cy with zero slope: no corner at either end
            c0 = max(1, bad[0] - 40)
            m0 = t_[c0] - t_[c0 - 1]
            n = len(t_) - 1 - c0
            if n > 0:
                u = np.arange(n + 1) / n
                p0, p1 = t_[c0], lim
                d = p1 - p0
                if clamp and d * m0 > 0 and abs(m0 * n) > 3 * abs(d):
                    m0 = 3 * d / n                  # a steeper start would swing the curve past the full width
                t_[c0:] = ((2 * u ** 3 - 3 * u ** 2 + 1) * p0 + (u ** 3 - 2 * u ** 2 + u) * m0 * n + (-2 * u ** 3 + 3 * u ** 2) * p1)
        elif len(bad):
            t_[:] = lim
    y, x = np.mgrid[0:h, 0:w].astype(float)
    t = np.clip((y - cy) / ry, 0, 1)
    g = np.clip(1 - t ** k, 0, 1) ** (1 / k)
    xl, xr = cx - rxl * g, cx + rxr * g
    for i, r in enumerate(rows):
        if r < y0:
            xl[r], xr[r] = tl[i], tr[i]
            continue
        s_ = (r - y0) / blend
        s_ = s_ * s_ * (3 - 2 * s_)
        xl[r] = tl[i] + (cx - rxl - tl[i]) * s_
        xr[r] = tr[i] + (cx + rxr - tr[i]) * s_
    a = np.clip(x - xl + 0.5, 0, 1) * np.clip(xr - x + 0.5, 0, 1)
    rxs = np.where(x < cx, rxl, rxr)
    u = np.clip(np.abs(x - cx) / rxs, 0, 1)
    bottom = cy + ry * np.clip(1 - u ** k, 0, 1) ** (1 / k)
    a = np.minimum(a, np.clip(bottom - y + 0.5, 0, 1))
    a = np.where(y < y0, sil * a, a)          # above the blend: the cut-out, held inside its smoothed trace
    return np.where(y < ys, sil, a)


def profile_alpha(h, w, pr):
    """Anti-aliased mask of a hand-read outline (see `profile`), drawn at 4x and averaged down."""
    from PIL import ImageDraw
    from scipy.interpolate import PchipInterpolator
    pts = np.array(pr["pts"], float)
    ys = np.linspace(pts[0, 0], pts[-1, 0], int(pts[-1, 0] - pts[0, 0]) * 2 + 2)
    xl, xr = PchipInterpolator(pts[:, 0], pts[:, 1])(ys), PchipInterpolator(pts[:, 0], pts[:, 2])(ys)
    poly = list(zip(xl, ys))
    if "bottom" in pr:
        bx, by, brx, bry = pr["bottom"]
        a0 = np.arccos(np.clip((xl[-1] - bx) / brx, -1, 1)); a1 = np.arccos(np.clip((xr[-1] - bx) / brx, -1, 1))
        for t in np.linspace(a0, a1, 200):
            poly.append((bx + brx * np.cos(t), max(ys[-1], by + bry * np.sin(t))))
    poly += list(zip(xr[::-1], ys[::-1]))
    S = 4
    im = Image.new("L", (w * S, h * S), 0)
    ImageDraw.Draw(im).polygon([(x * S, y * S) for x, y in poly], fill=255)
    a = np.asarray(im.resize((w, h), Image.BOX), float) / 255
    return a, int(pts[0, 0])


def stem_alpha(h, w, s):
    x0, y0, x1, y1 = s
    y, x = np.mgrid[0:h, 0:w].astype(float)
    cx, r = (x0 + x1) / 2, (x1 - x0) / 2
    side = np.clip(r - np.abs(x - cx) + 0.5, 0, 1)
    end = 10.0
    yy = np.clip((y - (y1 - end)) / end, 0, None)          # round end: an ellipse cap of height `end`
    cap = np.clip(r * np.sqrt(np.clip(1 - yy ** 2, 0, 1)) - np.abs(x - cx) + 0.5, 0, 1)
    a = np.where(y < y1 - end, side, cap) * (y >= y0) * (y <= y1)       # nothing below the round end
    return nd.gaussian_filter(a, 0.8)


def band_alpha(h, w, b):
    """A band round a cylindrical base: between an ellipse's lower arc and the same arc t px lower (soft edges).
    Drawn from geometry, not from dark pixels: the mat's black ink touches the band and is just as dark."""
    cx, cy, rx, ry, t = b[:5]
    k = b[5] if len(b) > 5 else 2.0
    y, x = np.mgrid[0:h, 0:w].astype(float)
    u = np.clip(np.abs(x - cx) / rx, 0, 1)
    arc = cy + ry * (1 - u ** k) ** (1 / k)
    return np.clip(y - arc + 0.5, 0, 1) * np.clip(arc + t - y + 0.5, 0, 1) * np.clip((rx - np.abs(x - cx)) / 5 + 0.5, 0, 1)


def smooth_rim(rgb, sil, sm):
    """Blur a base's bottom rim along the outline: rows are counted up from the outline's lowest pixel per column."""
    x0, x1, depth, sig = sm
    h, w = sil.shape
    inside = sil > 0.5
    bottom = np.where(inside.any(0), h - 1 - np.argmax(inside[::-1], 0), -10 ** 6)
    y = np.arange(h)[:, None]
    v = bottom[None, :] - y
    xs = np.arange(w)[None, :]
    band = inside & (v >= 0) & (v < depth) & (xs >= x0) & (xs < x1)
    acc = np.zeros((depth, w, 3)); cnt = np.zeros((depth, w))
    vv, xx = v[band], np.broadcast_to(xs, (h, w))[band]
    np.add.at(acc, (vv, xx), rgb[band]); np.add.at(cnt, (vv, xx), 1)
    acc = nd.gaussian_filter1d(acc, sig, axis=1, mode="nearest"); cnt = nd.gaussian_filter1d(cnt, sig, axis=1, mode="nearest")
    sm_rgb = acc / np.maximum(cnt, 1e-6)[..., None]
    out = rgb.astype(float).copy()
    L = lum(rgb.astype(float)); sat = rgb.max(2).astype(float) - rgb.min(2)
    spec = np.clip((L - 205) / 25, 0, 1) * np.clip((60 - sat) / 20, 0, 1)
    wv = np.clip((depth - v) / 15, 0, 1)                      # eased in over the band's top 15 rows
    wx = np.clip(np.minimum(xs - x0, x1 - xs) / 25, 0, 1)     # and over 25 columns at each end
    wgt = (wv * wx * (1 - spec)) * band
    out[band] = sm_rgb[vv, xx] * wgt[band][:, None] + out[band] * (1 - wgt[band][:, None])
    return out


def unmat_pass(rgb, m, win, lift=1.0):
    """One pass of `unmat` over a crop: lift the dark-ink parts of the print to the pale-ink level seen through the glass."""
    Lb = nd.gaussian_filter(rgb.mean(2), 1.2)
    hi = nd.gaussian_filter(nd.percentile_filter(Lb, 85, size=win), win / 3)    # the local pale-ink level through the glass
    lo = nd.gaussian_filter(nd.percentile_filter(Lb, 12, size=win), win / 3)    # the local dark-ink level
    wgt = np.clip((Lb - lo) / np.maximum(hi - lo, 8), 0, 1)                      # 1 over pale ink, 0 over dark, between at edges
    pale, dark = wgt > 0.8, wgt < 0.2
    D = np.zeros_like(rgb)
    for c in range(3):                     # per channel: pale ink's colour through the glass minus dark ink's, smoothed
        ch = nd.gaussian_filter(rgb[..., c], 1.2)
        mp = nd.gaussian_filter(np.where(pale, ch, 0), win / 2) / (nd.gaussian_filter(pale * 1.0, win / 2) + 1e-3)
        md = nd.gaussian_filter(np.where(dark, ch, 0), win / 2) / (nd.gaussian_filter(dark * 1.0, win / 2) + 1e-3)
        D[..., c] = np.clip(mp - md, 0, None)
    ease = nd.gaussian_filter(m * 1.0, 6)[..., None]
    res = rgb + lift * (1 - wgt)[..., None] * D * ease
    gy, gx = np.gradient(nd.gaussian_filter(wgt, 1))     # what is left of the print's edges: fine detail along them damped
    gw = nd.gaussian_filter(np.hypot(gx, gy), 2)
    RL = res.mean(2); hp = RL - nd.gaussian_filter(RL, 4)
    return res - hp[..., None] * ((np.clip(gw * 6, 0, 1) * (RL < 170))[..., None] * ease)


def unmat(photo, cfg):
    """`unmat`: tinted see-through glass kept as shot over the two-ink mat: inside the ellipse (below y_top, minus the
    unmat_skip boxes) the photo is the glass over pale ink everywhere, so the print goes and the glass's own reflections
    and speculars stay (photo = t * ink + reflection; the dark-ink pixels get t * (pale - dark) added, read locally)."""
    cx, cy, rx, ry, ytop = cfg["unmat"][:5]; k = cfg["unmat"][5] if len(cfg["unmat"]) > 5 else 2.0
    h, w = photo.shape[:2]
    y, x = np.mgrid[0:h, 0:w].astype(float)
    reg = (np.abs((x - cx) / rx) ** k + np.abs((y - cy) / ry) ** k <= 1) & (y >= ytop)
    for x0, y0, x1, y1 in cfg.get("unmat_skip", []):
        reg[y0:y1, x0:x1] = False
    ys, xs = np.where(reg)
    if not len(ys):                         # nothing inside the region: the photo as it is
        return photo
    pad = 40                                # past the 6 px ease every change is weighted by, so no seam at the box edge
    Y0, Y1, X0, X1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, h), max(xs.min() - pad, 0), min(xs.max() + pad + 1, w)
    rgb = photo[Y0:Y1, X0:X1].astype(float); m = reg[Y0:Y1, X0:X1]
    for win in (cfg.get("unmat_win", [81, 45]) if cfg.get("unmat_lift", 1.0) > 0 else []):   # lift 0: only the tint
        rgb = unmat_pass(rgb, m, win, cfg.get("unmat_lift", 1.0))
    if "unmat_tint" in cfg:                 # the pale ink's cool cast taken out: the glass's own colour (read off the glass
        tint = np.maximum(np.array(cfg["unmat_tint"], float), 1.0)   # over the wall) at each pixel's level; speculars kept
        L = rgb.mean(2); spec = np.clip((L - 170) / 50, 0, 1)[..., None]
        e = nd.gaussian_filter(m * 1.0, 6)[..., None] * (1 - spec)
        rgb = rgb * (1 - e) + L[..., None] * cfg.get("unmat_gain", 1.0) * (tint / tint.mean()) * e   # gain: the glass darker
    out = photo.astype(float).copy(); out[Y0:Y1, X0:X1] = rgb
    return out.clip(0, 255)


def lama_fill(img, mask, sess):
    """Inpaint img (H,W,3 uint8) under mask (bool) with LaMa at 512x512 over the mask's box; returns a float image."""
    ys, xs = np.where(mask)
    if not len(ys):
        return img.astype(float)
    pad = 60
    y0, y1 = max(0, ys.min() - pad), min(img.shape[0], ys.max() + pad)
    x0, x1 = max(0, xs.min() - pad), min(img.shape[1], xs.max() + pad)
    crop = Image.fromarray(img[y0:y1, x0:x1]); m = Image.fromarray((mask[y0:y1, x0:x1] * 255).astype(np.uint8))
    a = np.asarray(crop.resize((512, 512), Image.BICUBIC), np.float32) / 255
    b = (np.asarray(m.resize((512, 512), Image.NEAREST), np.float32) > 127).astype(np.float32)
    out = sess.run(None, {"image": a.transpose(2, 0, 1)[None], "mask": b[None, None]})[0][0].transpose(1, 2, 0)
    if out.max() <= 1.5:
        out = out * 255
    out = np.asarray(Image.fromarray(out.clip(0, 255).astype(np.uint8)).resize(crop.size, Image.BICUBIC), float)
    res = img.astype(float).copy()
    sub = res[y0:y1, x0:x1]
    mm = mask[y0:y1, x0:x1]
    sub[mm] = out[mm]
    return res


def plates(cfg):
    p = cfg.get("plate", [])
    return [p] if p and not isinstance(p[0], (list, tuple)) else p


def masks(photo, cut_a, cfg):
    """Returns (silhouette alpha 0..1, glass mask, opaque-kept alpha 0..1, mat zone, fine-lettering zone, parts): parts
    are the separate glass pieces whose outlines show inside the silhouette (a base standing in a dish), or []."""
    h, w = cut_a.shape
    sil = cut_a.astype(float) / 255
    parts = []
    if "foot" in cfg:
        if cfg.get("fill"):
            sil = fill_alpha(cut_a, cfg["foot"], clamp=not cfg.get("free_slope"))   # free_slope: the start slope as traced
        else:
            sil = sil * foot_alpha(h, w, cfg["foot"])
    if "profile" in cfg:
        pa, py0 = profile_alpha(h, w, cfg["profile"])
        sil = np.where(np.arange(h)[:, None] >= py0, pa, sil)
    for y0, y1, xl0, xl1, xr0, xr1 in cfg.get("tube", []):   # a straight-walled clear tube: its two walls as lines
        xx = np.arange(w, dtype=float)
        for r in range(y0, y1):
            t_ = (r - y0) / max(y1 - y0, 1)
            l_, r_ = xl0 + (xl1 - xl0) * t_, xr0 + (xr1 - xr0) * t_
            sil[r] = np.clip(xx - l_ + 0.5, 0, 1) * np.clip(r_ - xx + 0.5, 0, 1)
    if "outline" in cfg:                                 # the outline over its rows, read off the photo
        from scipy.interpolate import PchipInterpolator
        k = np.array(cfg["outline"], float)
        ys = np.arange(int(k[0, 0]), int(k[-1, 0]) + 1)
        cxs, hws = PchipInterpolator(k[:, 0], k[:, 1])(ys), PchipInterpolator(k[:, 0], k[:, 2])(ys)
        xx = np.arange(w, dtype=float)
        for r, c_, hw in zip(ys, cxs, hws):
            sil[r] = np.clip(hw - np.abs(xx - c_) + 0.5, 0, 1)
    if "disc" in cfg:
        cx, cy, rx, ry = cfg["disc"][:4]
        y, x = np.mgrid[0:h, 0:w].astype(float)

        def ellipse(rx, ry):
            r = np.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2)
            return np.clip((1 - r) * min(rx, ry) + 0.5, 0, 1)    # soft 1 px edge
        e = ellipse(rx, ry)
        parts = [sil.copy(), e]                                  # the base (its outline seen through the dish) and the dish
        if len(cfg["disc"]) > 4:                                 # the dish's wall: its inner edge, t px in
            t = cfg["disc"][4]
            parts.append(ellipse(rx - t, ry - t * ry / rx))
        sil = np.maximum(sil, e)
    if cfg.get("holes"):                                # gaps the cut-out left inside the glass are glass
        sil = np.maximum(sil, nd.binary_fill_holes(sil > 0.5).astype(float))
    for x0, y0, x1, y1 in cfg.get("erase", []):
        sil[y0:y1, x0:x1] = 0
    for lv, x0, y0, x1, y1 in cfg.get("erase_light", []):   # backdrop caught in a gap (wall between tray and hanger)
        sil[y0:y1, x0:x1] *= np.clip((lv + 12 - lum(photo[y0:y1, x0:x1])) / 24, 0, 1)
    for y0, y1, px, side in cfg.get("inset", []):      # move one side of the outline in by up to px, on a smooth bump
        xx = np.arange(w, dtype=float)
        rr = np.arange(y0 - 20, y1 + 20)
        edge = np.array([(np.flatnonzero(sil[r] > 0.5)[[0, -1]] if (sil[r] > 0.5).any() else (0, w - 1)) for r in rr], float)
        edge = nd.gaussian_filter1d(nd.median_filter(edge, (21, 1), mode="nearest"), 4, axis=0)   # the edge's own smooth line
        for i, r in enumerate(rr):
            if not y0 <= r < y1:
                continue
            d = px * np.sin(np.pi * (r - y0) / (y1 - y0)) ** 2     # zero slope at both ends: no corner where it starts or stops
            if side == "left":
                sil[r] *= np.clip(xx - (edge[i, 0] + d) + 0.5, 0, 1)
            else:
                sil[r] *= np.clip((edge[i, 1] - d) - xx + 0.5, 0, 1)
    for br in cfg.get("bridge", []):                    # an edge bridged over rows y0..y1 by a cubic from its own line
        y0, y1, side = br[:3]
        both = len(br) > 3 and br[3] == "fill"          # "fill": the line also fills a dent (the cut-out lost the edge)
        xx = np.arange(w, dtype=float)                  # and slope at both ends (a mat tooth on the edge is skipped)
        rr = np.arange(y0 - 30, y1 + 31)
        e = np.array([(np.flatnonzero(sil[r] > 0.5)[[0, -1]] if (sil[r] > 0.5).any() else (0, w - 1)) for r in rr], float)
        k = 0 if side == "left" else 1
        e = nd.gaussian_filter1d(e[:, k], 3)
        i0, i1 = 30, 30 + (y1 - y0)
        m0, m1 = (e[i0] - e[i0 - 10]) / 10, (e[i1 + 10] - e[i1]) / 10
        n = i1 - i0
        u = np.arange(n + 1) / n
        line = (2 * u ** 3 - 3 * u ** 2 + 1) * e[i0] + (u ** 3 - 2 * u ** 2 + u) * m0 * n +                (-2 * u ** 3 + 3 * u ** 2) * e[i1] + (u ** 3 - u ** 2) * m1 * n
        mid = (e[i0] + e[i1]) / 2 + (60 if side == "left" else -60)
        for j, r in enumerate(range(y0, y1 + 1)):
            if side == "left":
                cutl = np.clip(xx - line[j] + 0.5, 0, 1)
                sil[r] = np.maximum(sil[r] * cutl, cutl * (xx < mid)) if both else sil[r] * cutl
            else:
                cutl = np.clip(line[j] - xx + 0.5, 0, 1)
                sil[r] = np.maximum(sil[r] * cutl, cutl * (xx > mid)) if both else sil[r] * cutl
    fg = sil > 0.5
    opaque = np.zeros((h, w))
    if "stem" in cfg:                    # stem_seen: the stem seen through the glass keeps this much of its own pixels
        st_ = stem_alpha(h, w, cfg["stem"])
        if "stem_seen" in cfg:
            st_ = nd.gaussian_filter(st_, 1.2) * cfg["stem_seen"]
        opaque = np.maximum(opaque, st_)
    for k_ in ("band", "band2"):          # band2: a second band (a collar above the glass and a foot band below it)
        if k_ in cfg:
            opaque = np.maximum(opaque, band_alpha(h, w, cfg[k_]))
    if "stem_collar" in cfg:                 # the stem seen through a thick collar: the photo's own pixels, half covered
        x0, y0, x1, y1, a = cfg["stem_collar"]
        p = np.zeros((h, w))                 # fading up into the collar, the sides tapered into the glass
        ramp = np.concatenate([np.linspace(0, 1, y1 + 1 - y0) ** 1.5, np.ones(10)])         # held 10 rows into the tube: no dip
        p[y0:y1 + 11, x0:x1] = a * ramp[:, None] * np.sin(np.linspace(0.15, np.pi - 0.15, x1 - x0))[None, :] ** 0.5
        opaque = np.maximum(opaque, nd.gaussian_filter(p, 1.5))
    if "keep_below" in cfg:
        cx, cy, rx, ry = cfg["keep_below"][:4]
        ease = cfg["keep_below"][4] if len(cfg["keep_below"]) > 4 else 10
        y, x = np.mgrid[0:h, 0:w].astype(float)
        arc = np.where(np.abs(x - cx) < rx, cy - ry * np.sqrt(np.clip(1 - ((x - cx) / rx) ** 2, 0, 1)), cy - ry - 60)
        opaque = np.maximum(opaque, np.clip((y - arc) / ease + 0.5, 0, 1))
    for x0, y0, x1, y1, lv in cfg.get("keep_dark", []):
        d = np.zeros((h, w), bool); d[y0:y1, x0:x1] = lum(photo[y0:y1, x0:x1]) < lv
        d = nd.binary_opening(nd.binary_closing(d, iterations=4), iterations=2)   # one solid piece, no loose strokes
        d = nd.gaussian_filter(d.astype(float), 3) > 0.5                          # with a smooth outline
        opaque = np.maximum(opaque, nd.gaussian_filter(d.astype(float), 1.0))
    for kc in cfg.get("keep_colour", []):
        x0, y0, x1, y1, cv = kc[:5]
        d = np.zeros((h, w), bool)
        box = photo[y0:y1, x0:x1]
        d[y0:y1, x0:x1] = (box.max(2) - np.median(box, 2)) > cv     # one channel well above the other two
        d = nd.binary_opening(d, iterations=3)
        d = nd.binary_fill_holes(nd.binary_closing(d, iterations=8))
        if len(kc) > 5:                             # and above the lower arc of [cx, cy, rx, ry] (a dome's round bottom)
            cx, cy, rx, ry = kc[5:9]
            y, x = np.mgrid[0:h, 0:w].astype(float)
            d &= (y < cy) | (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1)
        d = nd.gaussian_filter(nd.binary_opening(d, iterations=6).astype(float), 6) > 0.5   # a smooth outline
        lab, k = nd.label(d)
        if k > 1:                                   # the one big piece: loose bits of coloured reflection are glass
            sizes = nd.sum(d, lab, range(1, k + 1)); d = lab == (1 + int(np.argmax(sizes)))
        opaque = np.maximum(opaque, nd.gaussian_filter(d.astype(float), 1.2))
    for cx, cy, rx, ry, t, x0, x1 in cfg.get("keep_band", []):   # a rubber ring seen through the neck, as one clean band
        y, x = np.mgrid[0:h, 0:w].astype(float)
        arc = cy + ry * np.sqrt(np.clip(1 - ((x - cx) / rx) ** 2, 0, 1))
        xm, hw = (x0 + x1) / 2, (x1 - x0) / 2          # rounded ends, the way a ring bends away round the neck
        r = np.abs((x - xm) / hw) ** 8 + np.abs((y - arc - t / 2) / (t / 2)) ** 2
        b = np.clip((1 - r) * t / 4 + 0.5, 0, 1)
        opaque = np.maximum(opaque, b)
    if "keep_above" in cfg:
        cx, cy, rx, ry = cfg["keep_above"]
        y, x = np.mgrid[0:h, 0:w].astype(float)
        arc = cy + ry * np.sqrt(np.clip(1 - ((x - cx) / rx) ** 2, 0, 1))
        opaque = np.maximum(opaque, np.clip((arc - y) + 0.5, 0, 1))
    for x0, y0, x1, y1 in plates(cfg) + cfg.get("keep", []):
        p = np.zeros((h, w)); p[y0:y1, x0:x1] = 1
        opaque = np.maximum(opaque, nd.gaussian_filter(p, 0.8))
    for y0, y1, xl0, xl1, xr0, xr1 in cfg.get("keep_quad", []):   # a slanted rod in a clear tube: kept between two lines
        p = np.zeros((h, w)); xx = np.arange(w, dtype=float)
        for r in range(max(y0, 0), min(y1, h)):
            t_ = (r - y0) / max(y1 - y0, 1)
            p[r] = np.clip(xx - (xl0 + (xl1 - xl0) * t_) + 0.5, 0, 1) * np.clip(xr0 + (xr1 - xr0) * t_ - xx + 0.5, 0, 1)
        opaque = np.maximum(opaque, nd.gaussian_filter(p, 0.6))
    if "dark" in cfg:
        lv, y0, y1 = cfg["dark"]
        d = lum(photo) < lv
        d[:y0] = False; d[y1:] = False
        lab, k = nd.label(d)                 # the ring runs right round the neck; shadows seen through glass do not
        for i, sl in enumerate(nd.find_objects(lab), 1):
            if sl[1].stop - sl[1].start < 150:
                d[lab == i] = False
        cols = np.flatnonzero(d.any(0))      # and it is thin: keep only what lies within 6 px of its own centre line
        if len(cols):
            yy = np.arange(h)[:, None]
            centre = np.full(w, np.nan)
            centre[cols] = (d[:, cols] * yy).sum(0) / d[:, cols].sum(0)
            centre[cols] = nd.median_filter(centre[cols], 31, mode="nearest")
            near = np.abs(yy - centre[None, :]) <= 6
            d &= np.nan_to_num(near, nan=False).astype(bool)
        opaque = np.maximum(opaque, nd.gaussian_filter(nd.binary_dilation(d, iterations=2).astype(float), 0.8))
    glass = np.zeros((h, w), bool)
    for y0, y1 in ([cfg["glass"]] if "glass" in cfg else []) + cfg.get("glass_extra", []):
        g_ = np.zeros((h, w), bool)
        g_[y0:y1] = True
        if "glass_x" in cfg:                 # only these columns hold glass (tongs hung beside it stay as cut)
            g_[:, :cfg["glass_x"][0]] = False; g_[:, cfg["glass_x"][1]:] = False
        g_ &= fg
        g_ = nd.binary_opening(g_, iterations=2)
        edge = nd.binary_dilation(g_, iterations=3) & (sil > 0.02)   # the outline's soft pixels are glass too
        edge[:y0] = False; edge[y1:] = False
        if "glass_x" in cfg:
            edge[:, :cfg["glass_x"][0]] = False; edge[:, cfg["glass_x"][1]:] = False
        glass |= g_ | edge
        if "glass_profile" in cfg:                       # only the bulb is glass in these rows; the base beside it stays as cut
            from scipy.interpolate import PchipInterpolator
            k = np.array(cfg["glass_profile"], float)
            ys = np.arange(int(k[0, 0]), int(k[-1, 0]) + 1)
            cxs, hws = PchipInterpolator(k[:, 0], k[:, 1])(ys), PchipInterpolator(k[:, 0], k[:, 2])(ys)
            xx = np.arange(w, dtype=float)
            for r, c_, hw in zip(ys, cxs, hws):
                glass[r] &= np.abs(xx - c_) <= hw + 1
    mat = np.zeros((h, w), bool)
    for e in cfg.get("mat", []):
        mat |= ell(h, w, *e)
    mat &= glass
    fine = np.zeros((h, w), bool)
    for e in cfg.get("mat_fine", []):
        fine |= ell(h, w, *e)
    return sil, glass, opaque, mat, fine, parts


def glass_layers(photo, glass, sil, mat, fine, lama, texture=True, rim_from=None, body=0.05, frost=None, tex_mat=1.0,
                 edge_clear=0, body_edge=None, spec_mat=1.0, notex=None, tex=(7, 2.2), borrow=None, parts=(),
                 rim_k=(0.50, 3.5, 0.12, 20.0, 0.18), ring=0.0, tex_to=None, inner_s=None, body_w=0.0, spec_min=0,
                 streaks=None, spec_off=(), tex_median=3, mat_gain=1.0, tex_light=0.0):
    """Returns (dark alpha, highlight alpha) for the glass pixels of a window of the photo."""
    L = lum(photo)
    h, w = L.shape
    sat = photo.max(2) - photo.min(2)
    spec = np.clip((L - 228) / 22, 0, 1) * np.clip((45 - sat) / 15, 0, 1)
    for x0, y0, x1, y1 in spec_off:    # a highlight that reads as a printed mark, not a reflection
        spec[max(y0, 0):max(y1, 0), max(x0, 0):max(x1, 0)] = 0
    if spec_min:                       # lone specks are not highlights: keep only pieces of spec_min px or more, the rest
        lab, k = nd.label(spec > 0.25)  # blurred along with their surround into nothing
        if k:
            sizes = nd.sum(np.ones_like(spec), lab, range(1, k + 1))
            keep = np.concatenate([[False], sizes >= spec_min])[lab]
            spec = spec * nd.gaussian_filter(nd.binary_dilation(keep, iterations=2).astype(float), 1.0)
    if streaks is not None:            # the glass's own thin bright streaks over the plain wall (fainter than a specular)
        y0s, y1s, thr = streaks
        th = L - nd.grey_opening(L, size=(1, 11))       # thin along x: the streaks run down the glass
        st = np.clip((th - thr) / 30, 0, 1) * np.clip((45 - sat) / 15, 0, 1)
        rows = np.arange(h)[:, None]
        st = st * np.clip((rows - y0s) / 30, 0, 1) * np.clip((y1s - rows) / 60, 0, 1)
        lab, n_ = nd.label(nd.binary_closing(st > 0.15, structure=np.ones((15, 3))))   # only long streaks (40 px or more
        # down the glass, gaps under 15 px bridged): short fragments read as scratches
        if n_:
            tall = np.array([0] + [sl[0].stop - sl[0].start for sl in nd.find_objects(lab)])
            st = st * nd.gaussian_filter((tall[lab] >= 40).astype(float), 1.0)
        spec = np.maximum(spec, 0.8 * nd.gaussian_filter(st, 0.8))
    f = np.zeros((h, w))
    if frost is not None:
        # etched (frosted) pattern on clear glass: the etching is the bright part against the local clear level
        # (whatever backdrop is behind), so it is read relative to local lower and upper envelopes, not to a plate
        Bl = nd.gaussian_filter(nd.minimum_filter(L, 41), 12)
        Bu = nd.gaussian_filter(nd.maximum_filter(L, 41), 12)
        e = np.clip((L - Bl - 10) / np.maximum(Bu - Bl, 45), 0, 1)
        e = nd.gaussian_filter(np.clip((e - 0.45) / 0.35, 0, 1), 0.8)   # clear glass between the etching stays clear
        dist = nd.distance_transform_edt(sil > 0.5)
        rim = 0.50 * np.exp(-dist / 3.5) + 0.12 * np.exp(-dist / 20.0)
        inner = 0.18 * np.exp(-((dist - 6.0) ** 2) / 5.0)
        a_d = 1 - (1 - rim) * (1 - body)
        hi = 1 - (1 - spec) * (1 - frost * e) * (1 - inner)
        return np.where(glass, a_d, 0), np.where(glass, hi, 0)
    wm = 0.0
    if texture:
        # backdrop over the marble and wall: a LaMa clean plate, broad tone only
        hole = nd.binary_dilation(glass, iterations=6)
        plate = nd.gaussian_filter(lum(lama_fill(photo.astype(np.uint8), hole, lama)), 6)
        f_plate = np.clip(1 - L / np.maximum(plate, 1), 0, 1) + (0.0 if tex_light else 0.6) * np.clip((L - plate) / np.maximum(255 - plate, 20), 0, 1)
        f = f_plate
        if mat.any():
            Lm = nd.median_filter(L, size=9)
            if fine.any():                 # printed lettering is thinner than the 9 px median: class it with a 3 px one
                Lm = np.where(fine, nd.median_filter(L, size=3), Lm)
            c = np.clip((Lm - 85) / 50, 0, 1)                      # soft light-ink weight
            c = nd.gaussian_filter(c, 1.0)
            z = nd.binary_dilation(mat, iterations=40)
            sure_l, sure_d = z & (c > 0.95), z & (c < 0.05)

            def level(m):
                wgt = nd.gaussian_filter(m.astype(float), 30)
                return nd.gaussian_filter(np.where(m, Lm, 0), 30) / np.maximum(wgt, 1e-3)
            Bl, Bd = level(sure_l), level(sure_d)
            f_l = np.clip(1 - L / np.maximum(Bl, 1), 0, 1)
            f_d = np.clip((L - Bd) / np.maximum(Bl - Bd, 40), 0, 1) * 0.8
            rel = np.clip(1 - 4.5 * c * (1 - c), 0, 1) ** 2           # zero where the ink weight is in between
            f_mat = (c * f_l + (1 - c) * f_d) * rel * (texture != "wall")
            # (with texture "wall" the silhouette's outside counts as mat: the rim over the mat is not read off the plate)
            inside = nd.distance_transform_edt(mat | ~glass if texture == "wall" else mat)
            wm = np.clip(inside / 50, 0, 1)
            wm = wm * wm * (3 - 2 * wm)
            f = wm * f_mat * tex_mat + (1 - wm) * f_plate
            # a highlight is only one where it is brighter than the ink behind it (the pale ink is near-white)
            spec = spec * np.where(mat, np.clip((L - Bl - 18) / 15, 0, 1) * spec_mat, 1)
        f = np.clip(f - 0.04, 0, None)
        f = nd.median_filter(f, size=tex_median)                    # single-pixel noise is not texture (cut glass: crinkle)
        # detail only: broad patches are misread backdrop. Over the mat the band stays narrow (7 px) whatever `tex` says
        narrow = np.clip(f - nd.gaussian_filter(f, 7) - 0.02, 0, None) * 2.2 * mat_gain
        f = narrow if tuple(tex) == (7, 2.2) else (1 - wm) * np.clip(f - nd.gaussian_filter(f, tex[0]) - 0.02, 0, None) * tex[1] + wm * narrow
        f = np.clip(f, 0, 1)
        if tex_to is not None:             # texture read only above this row (the wall behind); below it the mat: none
            f = f * np.clip((tex_to - np.arange(h)) / 80, 0, 1)[:, None]
        for x0, y0, x1, y1 in spec_off:    # nor any texture there
            f[max(y0, 0):max(y1, 0), max(x0, 0):max(x1, 0)] = 0
        if borrow is not None:
            yb, dy = borrow
            assert dy > 0, "borrow: dy must be at least 1"
            src = np.zeros_like(f); src[dy:] = f[:-dy]
            ok = np.zeros_like(glass); ok[dy:] = glass[:-dy]
            q = np.clip((np.arange(h) - yb) / 40, 0, 1)[:, None]
            q = q * q * (3 - 2 * q) * ok
            f = np.where(glass, q * src + (1 - q) * f, f)
        if rim_from is not None:
            # the thick bottom rim shows the mat's teeth bent through it, so its texture is not read there: it is
            # borrowed from the same glass 70 px further in along the (smoothed) normal, faded in over 55 px
            dd = nd.distance_transform_edt(sil > 0.5)
            yy, xx = np.mgrid[0:h, 0:w]
            ny, nx = np.gradient(nd.gaussian_filter(dd, 10))   # a smooth inward normal: the copy is a local shift, no streaks
            nn = np.maximum(np.hypot(ny, nx), 1e-3)
            sy = np.clip(np.round(yy + ny / nn * 70), 0, h - 1).astype(int)
            sx = np.clip(np.round(xx + nx / nn * 70), 0, w - 1).astype(int)
            borrowed = f[sy, sx]
            q = np.clip(dd / 55, 0, 1)
            q = q * q * (3 - 2 * q)
            low = (np.arange(h) >= rim_from)[:, None]
            f = np.where(low, q * f + (1 - q) * borrowed, f)
    if notex is not None:                # a speck or a stray highlight in the photo: no texture and no highlight there
        f = f * (1 - notex)
        spec = spec * (1 - notex)
    # outline: a darker rim where the glass is seen at a slant, a thin inner highlight just inside it
    d0 = nd.distance_transform_edt(sil > 0.5)
    if edge_clear:                       # the mat's rings seen through the walls run parallel to them: no texture there
        q_ = np.clip((d0 - edge_clear * 0.5) / (edge_clear * 0.5), 0, 1)
        f = f * np.where(nd.binary_dilation(mat, iterations=60), q_ * q_ * (3 - 2 * q_), 1)
    rim, inner = np.zeros((h, w)), np.zeros((h, w))
    for k_, m in enumerate([sil] + list(parts)):      # each piece's outline, also where it lies inside another
        inside = m > 0.5
        dist = nd.distance_transform_edt(inside)
        rim = np.maximum(rim, np.where(inside | (k_ == 0), rim_k[0] * np.exp(-dist / rim_k[1]) + rim_k[2] * np.exp(-dist / rim_k[3]), 0))
        inner = np.maximum(inner, np.where(inside | (k_ == 0), (rim_k[4] if inner_s is None else inner_s) * np.exp(-((dist - 6.0) ** 2) / 5.0), 0))
    if body_edge is not None:            # coloured glass: thin in the middle of the bowl, deeper where the walls are seen edge-on
        body = body + (body_edge - body) * np.exp(-d0 / 45.0)
    if ring and len(parts) > 2:                       # a thick dish wall: denser glass between its outer and inner edge
        r_ = nd.gaussian_filter(np.clip(parts[1] - parts[2], 0, 1), 1.5)
        ys_ = np.flatnonzero((parts[1] > 0.5).any(1))         # the wall shows its thickness at the front, not at the back
        if len(ys_):
            q_ = np.clip((np.arange(h) - (ys_[0] + 0.35 * (ys_[-1] - ys_[0]))) / (0.4 * (ys_[-1] - ys_[0])), 0, 1)
            r_ = r_ * (0.25 + 0.75 * q_ * q_ * (3 - 2 * q_))[:, None]
        body = body + 0.6 * ring * r_
        inner = 1 - (1 - inner) * (1 - ring * r_)
    a_d = 1 - (1 - 0.55 * f) * (1 - rim) * (1 - body)
    hi = 1 - (1 - spec) * (1 - 0.22 * nd.gaussian_filter(f, 1.0)) * (1 - inner) * (1 - body_w)
    if tex_light and texture:          # the glass's own bright detail (white seeds in bubble glass) drawn white, not dark
        Lb = nd.median_filter(L, size=tex_median)
        gm = glass.astype(float)              # the surround is the glass only: a dark collar or stem beside it is no halo
        loc = nd.gaussian_filter(Lb * gm, tex[0]) / np.maximum(nd.gaussian_filter(gm, tex[0]), 1e-3)
        fb = np.clip((Lb - loc - 4) / 40, 0, 1) * nd.binary_erosion(glass, iterations=2)
        for x0, y0, x1, y1 in spec_off:
            fb[max(y0, 0):max(y1, 0), max(x0, 0):max(x1, 0)] = 0
        if notex is not None:
            fb = fb * (1 - notex)
        hi = 1 - (1 - hi) * (1 - tex_light * nd.gaussian_filter(fb, 0.7))
    if spec_min:                       # and on the finished layer: any bright piece still under spec_min px is toned down
        lab, k = nd.label((hi > 0.45) & glass)
        if k:
            small = np.concatenate([[False], nd.sum(np.ones_like(hi), lab, range(1, k + 1)) < spec_min])[lab]
            small = nd.gaussian_filter(nd.binary_dilation(small, iterations=2).astype(float), 1.0)
            hi = hi * (1 - small) + np.minimum(hi, 0.25) * small
    return np.where(glass, a_d, 0), np.where(glass, hi, 0)


def ell_dist(h, w, cx, cy, rx, ry):
    """Signed distance in px to the ellipse (negative inside) and the angle round it (degrees, 0 right, 90 front)."""
    y, x = np.mgrid[0:h, 0:w].astype(float)
    dx, dy = x - cx, y - cy
    r = np.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
    g = np.sqrt((dx / rx ** 2) ** 2 + (dy / ry ** 2) ** 2) / np.maximum(r, 1e-6)
    return (r - 1) / np.maximum(g, 1e-6), np.degrees(np.arctan2(dy / ry, dx / rx)) % 360


def drawn_edges(h, w, cfg, photo=None):
    """Glass edges the photo shows but the method cannot read over the mat (the thick foot's inner ring, read off the
    photo where it crosses plain ink): `arcs` drawn like the outline, `thick` glass given more body."""
    d_, h_ = np.zeros((h, w)), np.zeros((h, w))
    for arc in cfg.get("arcs", []):
        cx, cy, rx, ry, a0, a1, s, wd = arc[:8]
        dist, ang = ell_dist(h, w, cx, cy, rx, ry)
        if len(arc) > 8:                                 # lit from angle arc[8]: strongest there, a third as strong opposite
            s = s * (0.67 + 0.33 * np.cos(np.radians(ang - arc[8])))
        span = (ang - a0) % 360
        len_ = a1 - a0                                   # 360 or more: the whole ring, no ends
        fade = np.ones((h, w)) if len_ >= 360 else np.clip(np.minimum(span, len_ - span) / 18, 0, 1) * (span <= len_)
        fade = fade * fade * (3 - 2 * fade)
        d_ = 1 - (1 - d_) * (1 - s * fade * np.exp(-(dist / wd) ** 2))
        if photo is not None:            # the ring's highlight only where the photo shows it bright (near-white, not the ink)
            Lm = nd.gaussian_filter(nd.grey_dilation(lum(photo), size=5), 2)
            lit = np.clip((Lm - 205) / 40, 0, 1) * np.clip(1 - np.abs(dist) / (3 * wd), 0, 1)
            h_ = 1 - (1 - h_) * (1 - 0.7 * fade * lit * np.exp(-((dist + 1.2 * wd) / wd) ** 2))
        else:
            h_ = 1 - (1 - h_) * (1 - 0.6 * s * fade * np.exp(-((dist + 1.6 * wd) / (0.7 * wd)) ** 2))
    for cx, cy, rx, ry, y0, s in cfg.get("thick", []):
        dist, _ = ell_dist(h, w, cx, cy, rx, ry)
        q = np.clip((np.arange(h) - y0) / 30, 0, 1)[:, None] * np.clip(dist / 3, 0, 1)
        if s < 0:                                        # negative: the face reads lighter (white body), never darker
            h_ = 1 - (1 - h_) * (1 + s * q)
        else:
            d_ = 1 - (1 - d_) * (1 - s * q)
    return d_, h_


def compose(cut, sil, glass, opaque, a_d, hi, rows=None, dark=DARK, fade_px=16, stem_glass=0.0):
    rgb = cut[..., :3].astype(float)
    A = 1 - (1 - a_d) * (1 - hi)
    C = (np.asarray(dark, float)[None, None] * (a_d * (1 - hi))[..., None] + 255 * hi[..., None]) / np.maximum(A, 1e-4)[..., None]
    g = glass.astype(float) * (1 - opaque)                   # weight of the drawn glass; opaque parts stay as cut
    if rows:                                                 # fade the drawn glass in and out over 16 rows at y_top, y_bot
        yy = np.arange(g.shape[0], dtype=float)[:, None]     # (rows: a list of [y_top, y_bot] runs)
        fade = np.zeros_like(yy)
        for r0, r1 in rows:
            top = np.clip((yy - r0) / fade_px, 0, 1)
            bot = 1.0 if r1 >= cut.shape[0] else np.clip((r1 - yy) / fade_px, 0, 1)
            fade = np.maximum(fade, top * bot)
        g = g * fade
    g = np.maximum(g, 0)
    if stem_glass:                       # the glass's highlights also pass over the opaque downstem seen through it
        hs = stem_glass * hi * glass * opaque
        rgb = rgb * (1 - hs[..., None]) + 255 * hs[..., None]
    out_rgb = C * g[..., None] + rgb * (1 - g[..., None])
    out_a = (A * g + (1 - g)) * sil
    return np.dstack([out_rgb.clip(0, 255), (out_a * 255).clip(0, 255)]).astype(np.uint8)


def run_one(src, cut_p, cfg, method, lama, tile=None, matting=None):
    photo = np.asarray(Image.open(src).convert("RGB"), float)
    cut = np.asarray(Image.open(cut_p).convert("RGBA")).copy()
    if cut.shape[:2] != photo.shape[:2]:
        raise ValueError(f"{cut_p.name}: cut-out {cut.shape[1]}x{cut.shape[0]} is not the photo's size "
                         f"{photo.shape[1]}x{photo.shape[0]}")
    if cfg and photo.shape[0] != H:
        raise ValueError(f"{src.name}: {photo.shape[0]} px tall; its PHOTOS entry is in pixels of a {H} px tall photo")
    if not cfg and method != "matting":
        return cut                                            # nothing known about this photo: the cut-out as it is
    if (cfg.get("retouch") or cfg.get("retouch_dark") or cfg.get("retouch_sat")) and lama is not None:
        m = np.zeros(photo.shape[:2], bool)
        for x0, y0, x1, y1 in cfg.get("retouch", []):
            m[y0:y1, x0:x1] = True
        for sv, x0, y0, x1, y1 in cfg.get("retouch_sat", []):      # only the coloured pixels in the box (a twist tie), widened
            d = np.zeros(photo.shape[:2], bool)
            d[y0:y1, x0:x1] = (photo[y0:y1, x0:x1].max(2) - photo[y0:y1, x0:x1].min(2)) > sv
            m |= nd.binary_dilation(d, iterations=4)
        for lv, x0, y0, x1, y1 in cfg.get("retouch_dark", []):     # only the dark pixels in the box (a cord), widened
            d = np.zeros(photo.shape[:2], bool)
            d[y0:y1, x0:x1] = lum(photo[y0:y1, x0:x1]) < lv
            m |= nd.binary_dilation(d, iterations=5)
        m &= cut[..., 3] > 127
        if cfg.get("retouch_in"):           # keep the outline's own rim: the retouch stays this many px inside it
            m &= nd.binary_erosion(cut[..., 3] > 127, iterations=cfg["retouch_in"])
        fill = lama_fill(photo.astype(np.uint8), m, lama)
        photo = fill
        cut[..., :3] = np.where(m[..., None], fill, cut[..., :3]).astype(np.uint8)
    if "unmat" in cfg:                      # tinted glass kept as shot over the mat: the print seen through it lifted out
        photo = unmat(photo, cfg)
    if cfg.get("photo_rgb"):                # opaque parts take the photo's own pixels: an `outline` or foot that reaches past
        cut[..., :3] = photo.clip(0, 255).astype(np.uint8)   # the cut-out shows the product there, not the cut-out's black
    if cfg.get("add_poly"):                 # a pale part the cut-out took for wall: opaque inside the polygon, the photo's pixels
        from PIL import ImageDraw
        pm = Image.new("L", (cut.shape[1], cut.shape[0]), 0)
        for poly in cfg["add_poly"]:
            ImageDraw.Draw(pm).polygon([tuple(p_) for p_ in poly], fill=255)
        pa = nd.gaussian_filter(np.asarray(pm, float), 0.7)
        cut[..., :3] = np.where(pa[..., None] > 0, photo.clip(0, 255), cut[..., :3]).astype(np.uint8)
        cut[..., 3] = np.maximum(cut[..., 3], pa.clip(0, 255)).astype(np.uint8)
    sil, glass, opaque, mat, fine, parts = masks(photo, cut[..., 3], cfg)
    if "stem_collar" in cfg:                # the collar's pixels are its glint, not the stem: the stem's own pixels from just
        x0, y0, x1, y1, _ = cfg["stem_collar"]   # below the collar, cloned upward (mirrored, so the seam at y1 matches)
        tone = np.median(cut[y1 + 30:y1 + 130, x0:x1, :3].astype(float), axis=0)          # the tube's own cross-section
        wgt = np.clip((y1 + 20 - np.arange(y0, y1 + 20)) / 20, 0, 1)[:, None, None]          # eased into the tube below
        cut[y0:y1 + 20, x0:x1, :3] = (wgt * tone[None] + (1 - wgt) * cut[y0:y1 + 20, x0:x1, :3]).astype(np.uint8)
    if "band" in cfg and not cfg.get("band_print"):   # band_print: the band carries a light print of its own (kept). The band is black rubber: light bits caught in its outline (the glass's rim,
        h, w = sil.shape                    # a mat tooth) take the band's own dark colour
        ba = band_alpha(h, w, cfg["band"]) > 0.5
        for x0, y0, x1, y1 in plates(cfg):
            ba[y0 - 2:y1 + 2, x0 - 2:x1 + 2] = False
        rgb = cut[..., :3].astype(float); L = lum(rgb)
        dark = ba & (L < 60)
        if dark.any():
            col = np.median(rgb[dark], 0)
            wgt = np.clip((L - 60) / 40, 0, 1) * ba
            cut[..., :3] = (rgb * (1 - wgt[..., None]) + col * wgt[..., None]).clip(0, 255).astype(np.uint8)
    for x0, y0, x1, y1, cv, depth in cfg.get("recolour", []):
        box = cut[y0:y1, x0:x1, :3].astype(float)
        good = (box.max(2) - np.median(box, 2)) > cv
        near = nd.distance_transform_edt(sil[y0:y1, x0:x1] > 0.5) <= depth
        bad = near & ~good & (sil[y0:y1, x0:x1] > 0.02)
        _, (iy, ix) = nd.distance_transform_edt(~good, return_indices=True)
        wgt = nd.gaussian_filter(bad.astype(float), 2.0)[..., None]
        cut[y0:y1, x0:x1, :3] = (box * (1 - wgt) + box[iy, ix] * wgt).clip(0, 255).astype(np.uint8)
    if "smooth" in cfg:
        cut[..., :3] = smooth_rim(cut[..., :3].astype(float), sil, cfg["smooth"]).clip(0, 255).astype(np.uint8)
    if method == "matting":                                   # comparison only: retouch and erase are not applied
        return matting_cut(photo, cfg, matting)
    if method == "lama":
        return lama_tile(photo, cut, sil, glass, opaque, lama, tile)
    a_d = np.zeros(glass.shape); hi = np.zeros(glass.shape)
    notex = np.zeros(glass.shape)
    for x0, y0, x1, y1 in cfg.get("notex", []):
        notex[y0:y1, x0:x1] = 1
    notex = nd.gaussian_filter(notex, 4)
    for i, (gy0, gy1) in enumerate(([cfg["glass"]] if "glass" in cfg else []) + cfg.get("glass_extra", [])):
        part = glass.copy()                  # each run of glass rows in its own window (the clean plate stays sharp)
        part[:gy0] = False; part[gy1:] = False
        if not part.any():
            continue
        ys, xs = np.where(part)
        y0, y1 = max(0, ys.min() - 90), min(glass.shape[0], ys.max() + 90)
        x0, x1 = max(0, xs.min() - 90), min(glass.shape[1], xs.max() + 90)
        w = (slice(y0, y1), slice(x0, x1))
        rim_from = int(cfg["foot"][1]) - y0 if i == 0 and cfg.get("fill") and "glass" in cfg else None
        if i == 0 and "rim_from" in cfg:
            rim_from = cfg["rim_from"] - y0
        da, ha = glass_layers(photo[w], part[w], sil[w], mat[w], fine[w], lama, texture=(method == "ratio" and (cfg.get("texture", True) or "tex_to" in cfg)), notex=notex[w],
                              rim_from=rim_from, body=cfg["tint"][3] if "tint" in cfg else cfg["body"][0] if "body" in cfg else 0.05,
                              frost=cfg.get("frost") if i == 0 else None, tex_mat=cfg.get("tex_mat", 1.0),
                              edge_clear=cfg.get("edge_clear", 0), spec_mat=cfg.get("spec_mat", 1.0), body_edge=cfg["tint"][4] if len(cfg.get("tint", [])) > 4 else None,
                              tex_light=cfg.get("tex_light", 0.0), tex=cfg.get("tex", (7, 2.2)), borrow=(cfg["borrow"][0] - y0, cfg["borrow"][1]) if "borrow" in cfg else None,
                              parts=[p_[w] for p_ in parts],
                              rim_k=tuple(list(cfg.get("rim", [])) + [0.50, 3.5, 0.12, 20.0, 0.18][len(cfg.get("rim", [])):]),
                              ring=cfg["disc"][5] if len(cfg.get("disc", [])) > 5 else 0.0,
                              tex_to=cfg["tex_to"] - y0 if "tex_to" in cfg else None, inner_s=cfg.get("inner"),
                              body_w=cfg["body"][1] if "body" in cfg else 0.0, spec_min=cfg.get("spec_min", 0),
                              streaks=(cfg["streaks"][0] - y0, cfg["streaks"][1] - y0, cfg["streaks"][2]) if "streaks" in cfg else None,
                              spec_off=[(a - x0, b - y0, c - x0, d - y0) for a, b, c, d in cfg.get("spec_off", [])],
                              tex_median=cfg.get("tex_median", 3), mat_gain=cfg.get("mat_gain", 1.0))
        a_d[w] = np.where(part[w], da, a_d[w]); hi[w] = np.where(part[w], ha, hi[w])
    if "arcs" in cfg or "thick" in cfg:
        e_d, e_h = drawn_edges(*glass.shape, cfg, photo)
        a_d = np.where(glass, 1 - (1 - a_d) * (1 - e_d), 0); hi = np.where(glass, 1 - (1 - hi) * (1 - e_h), 0)
    runs = ([cfg["glass"]] if "glass" in cfg else []) + cfg.get("glass_extra", [])
    out = compose(cut, sil, glass, opaque, a_d, hi, runs, cfg["tint"][:3] if "tint" in cfg else DARK, cfg.get("fade", 16),
                  cfg.get("stem_glass", 0.0))
    if "edge_ease" in cfg:                  # tinted glass kept as cut: its thin outer rim lets a little tile through
        n, a0 = cfg["edge_ease"]
        d = nd.distance_transform_edt(out[..., 3] > 127)
        out[..., 3] = (out[..., 3] * np.where(d < n, a0 + (1 - a0) * d / n, 1.0)).astype(np.uint8)
    if "see_through" in cfg:                # tinted glass kept as cut: where it is thin (bright: the wall seen through it) some
        L0, amax, wall = cfg["see_through"][:3]  # tile shows, the colour solved so that over the wall it is the photo again
        P = out[..., :3].astype(float); A = out[..., 3].astype(float) / 255
        wgt = amax * np.clip((nd.gaussian_filter(lum(P), 2) - L0) / 60, 0, 1) * (A > 0.99)
        if len(cfg["see_through"]) > 3:     # a fourth value: only from that row down (the glass below the metal fittings),
            y_ = np.arange(wgt.shape[0], dtype=float)[:, None]   # eased in over 12 rows
            wgt = wgt * np.clip((y_ - cfg["see_through"][3]) / 12, 0, 1)
        a = 1 - wgt
        C = (P - (1 - a)[..., None] * wall) / np.maximum(a, 1e-3)[..., None]
        out[..., :3] = C.clip(0, 255).astype(np.uint8); out[..., 3] = (A * a * 255).clip(0, 255).astype(np.uint8)
    if "iris" in cfg:
        out = iris(out, photo, glass, opaque, runs, cfg["iris"], cfg.get("fade", 16))
    return out


def iris(out, photo, glass, opaque, runs, ir, fade_px):
    """An iridescent coating: the glass drawn neutral by the ratio takes the photo's own hue (it stands over a near-neutral
    wall and marble, so the photo's colour there is the coating's), and the coloured sheen is laid over it at its own
    saturation. ir = [s, a(, s0)]: s the power the hue is raised to on the drawn glass (1: as photographed, 2-3 for a coating that reads at product size), a the sheen's alpha, s0 the saturation it starts at."""
    s, a = ir[0], ir[1]
    s0 = ir[2] if len(ir) > 2 else 0.14
    P = nd.gaussian_filter(photo, (1.2, 1.2, 0))
    L = lum(P)[..., None]
    ch = P / np.maximum(L, 1.0)                                    # 1,1,1 where the photo is grey
    mx, mn = P.max(2), P.min(2)
    sat = (mx - mn) / np.maximum(mx, 1.0)
    g = glass.astype(float) * (1 - opaque)
    yy = np.arange(g.shape[0], dtype=float)[:, None]
    fade = np.zeros_like(yy)
    for r0, r1 in runs:
        fade = np.maximum(fade, np.clip((yy - r0) / fade_px, 0, 1) * (1.0 if r1 >= g.shape[0] else np.clip((r1 - yy) / fade_px, 0, 1)))
    if runs:
        g = g * fade
    rgb = out[..., :3].astype(float); A = out[..., 3].astype(float) / 255
    rgb = rgb * (1 - g[..., None]) + (rgb * ch ** s).clip(0, 255) * g[..., None]   # hue pushed by power s
    ai = a * np.clip((sat - s0) / 0.12, 0, 1) * np.clip((L[..., 0] - 110) / 60, 0, 1) * g   # bright coloured sheen only
    A2 = A + ai * (1 - A)
    rgb = (rgb * (A * (1 - ai))[..., None] + P * ai[..., None]) / np.maximum(A2, 1e-4)[..., None]
    return np.dstack([rgb.clip(0, 255), (A2 * 255).clip(0, 255)]).astype(np.uint8)


def lama_tile(photo, cut, sil, glass, opaque, lama, tile):
    """Bake the cut-out on the tile, then let LaMa paint the see-through glass (minus speculars) from its surround."""
    a = sil[..., None]
    base = cut[..., :3] * a + np.array(tile, float) * (1 - a)
    L = lum(photo); sat = photo.max(2) - photo.min(2)
    spec = (L > 228) & (sat < 40)
    dist = nd.distance_transform_edt(sil > 0.5)
    hole = glass & ~spec & (dist > 8) & (opaque < 0.5)
    out = lama_fill(base.clip(0, 255).astype(np.uint8), hole, lama)
    # baked on the tile (comparison only): opaque wherever the product is, so the tile is not composited twice
    return np.dstack([out.clip(0, 255), np.where(sil > 0.02, 255.0, 0)]).astype(np.uint8)


def matting_cut(photo, cfg, sess):
    from pymatting import estimate_foreground_ml
    h, w = photo.shape[:2]
    im = Image.fromarray(photo.astype(np.uint8))
    a = np.asarray(im.resize((1024, 1024), Image.BICUBIC), np.float32) / 255
    a = (a - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    o = sess.run(None, {"input_image": a.transpose(2, 0, 1)[None].astype(np.float32)})[0][0, 0]
    al = 1 / (1 + np.exp(-o))
    al = np.asarray(Image.fromarray((al * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), float) / 255
    if "foot" in cfg:
        al *= fill_alpha(np.full((h, w), 255, np.uint8), cfg["foot"]) if cfg.get("fill") else foot_alpha(h, w, cfg["foot"])
    F = estimate_foreground_ml(photo / 255, al)
    return np.dstack([(F * 255).clip(0, 255), al * 255]).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("cut"); ap.add_argument("out")
    ap.add_argument("names", nargs="*")
    ap.add_argument("--method", default="ratio", choices=["ratio", "rebuild", "lama", "matting"])
    ap.add_argument("--tile", default="198,216,108", help="lama only: the tile colour the result is baked on")
    ap.add_argument("--lama", default=LAMA)
    ap.add_argument("--matting", default=MATTING)
    a = ap.parse_args()
    src, cut, out = Path(a.src), Path(a.cut), Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    tile = tuple(int(v) for v in a.tile.split(","))
    if len(tile) != 3 or not all(0 <= v <= 255 for v in tile):
        ap.error("--tile takes three numbers 0-255, e.g. 198,216,108")
    names = [Path(n).stem for n in a.names] or sorted(p.stem for p in src.glob("*.jpg"))
    missing = [n for n in names if not (src / f"{n}.jpg").exists() or not (cut / f"{n}.png").exists()]
    if missing:
        ap.error("no photo (SRC_DIR/NAME.jpg) or cut-out (CUT_DIR/NAME.png) for: " + ", ".join(missing))
    need_lama = a.method in ("ratio", "lama") or any(PHOTOS.get(n, {}).get("retouch") or PHOTOS.get(n, {}).get("retouch_dark")
                                                     or PHOTOS.get(n, {}).get("retouch_sat") for n in names)
    import onnxruntime as ort
    so = ort.SessionOptions(); so.intra_op_num_threads = 4
    lama = ort.InferenceSession(a.lama, so, providers=["CPUExecutionProvider"]) if need_lama and a.method != "matting" else None
    mat = ort.InferenceSession(a.matting, so, providers=["CPUExecutionProvider"]) if a.method == "matting" else None
    for n in names:
        cfg = PHOTOS.get(n, {})
        res = run_one(src / f"{n}.jpg", cut / f"{n}.png", cfg, a.method, lama, tile, mat)
        Image.fromarray(res, "RGBA").save(out / f"{n}.png")
        did = [k for k in ("foot", "glass", "stem", "band", "retouch") if k in cfg] if a.method != "matting" else ["model matte"]
        print(n, a.method, ", ".join(did) if cfg else "no entry: cut-out as it is", flush=True)


if __name__ == "__main__":
    sys.exit(main())

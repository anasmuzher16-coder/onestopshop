"""The shop's own hookahs -> families. No supplier catalogue: the source is the shop's photos of each hookah lying on its
counter (IMG_0670..IMG_0715, Google Drive, 2026-11-27). Owner, 2026-11-27: "whatever is ready put it on the site right now so
the client can add in the details", then "put up the og photos of the hookahs with a 'to be replaced' tag".

Rules (same model as the shop's bowls, src_shop_bowls.py):
- names follow the hookah council's identification (scratchpad hookah-council/IDENTIFY.csv, 2026-11-27): the full maker's
  name where it is EXACT (brand on the piece, model and colour matched to the maker's photo); the brand alone where only
  the brand is readable ("MIG Hookah"); otherwise what the photo shows ("Hookah, clear base, silver stem"), never a brand
  that is only LIKELY (the Panda, the Smokah). Every family carries needs_confirm with its reason, for "Needs info";
- nothing is claimed that the photo does not show: no size, no height, no "hose included" (the hookahs are standalone);
- every hookah is in the shop (photographed there), Price TBD, stock not counted, weight unknown (pickup or local delivery
  once priced); the shop fills name, colours, price, stock and weight in the item editor;
- an EXACT hookah shows the maker's or a retailer's photo of that model and colour, cut out and framed like the Ace hookahs
  (its page kept as photo_src); every other one shows the shop's original, turned upright and cropped to the store's 4:5
  frame, counter and mat left in, as a full-tile photo (photo_full) with "Photo to be replaced" (status 'replace') until a
  cleaned photo goes in under the same file name. The Kingpin's and Scarface's web photos (pipedreamz.ca) show a hose fitted,
  which these standalone hookahs do not come with, so they keep the shop's original for now;
- names never mention a bowl, tongs or a hose, even where the photo shows one: the hookahs are sold standalone;
- left out, and why: IMG_0684/0685 (Tsar Molotov, already on the site), IMG_0708 (the Baseball Bat, already on the site),
  IMG_0689 (likely the Ace Panda in black: OSS-100077 'Panda Hookah' is already on view with no photo, so a second card would
  list one hookah twice; its photo goes on OSS-100077 at the next Ace rebuild, shop_photos.py),
  IMG_0713 (the Ace Rose in red, already on the site), IMG_0677 (a second shot of IMG_0673), IMG_0707 (a close-up of the
  Scarface in IMG_0706).
- the blue Ace Rose (IMG_0715) is a colour the Ace catalogue does not list: it joins the Ace Rose family (family 'ace-rose',
  one card, colour chips) as the shop's own row.
"""
from __future__ import annotations

from catlib import cell, slug

SRC_ID = "shop-hookahs-2026-11-27"
EDITION = "Shop hookah photos on the counter, Google Drive 2026-11-27"
RECEIVED = "2026-11-27"
RULE = "rule 2026-11-27 (owner: put the photographed hookahs on the site with their original photos; the shop fills the details)"

HEX = {"Silver Metallic": "#b8bcc0", "Gold Metallic": "#c9a54a", "White Matt": "#ecebe6", "Red": "#a3262a", "Black and gold": "#141414",
       "Black and white": "#1f1b18", "Wood and blue": "#2f5fb0", "Wood and green": "#2f7a3a", "Purple and pink": "#6b3fa0",
       "Black and red": "#c8372d", "White and red": "#efefef", "Green and black": "#3f8f2a", "Blue and yellow": "#2f6fc0",
       "White and gold": "#efefef", "Black": "#141414", "Brown": "#7a4a22", "Silver and black": "#b8bcc0", "Silver and yellow": "#e3c52a",
       "Yellow and black": "#e3c52a", "Blue": "#2f5fc0", "Yellow": "#e3c52a", "Gold and yellow": "#c9a54a", "Black and silver": "#141414",
       "Silver": "#b8bcc0",
       # the 2026-11-28 batch
       "Gold and silver": "#c9a54a",
       "Gold": "#c9a54a",
       "Black and green": "#141414",
       "Black, clear base": "#141414",
       "Black, crackle base": "#141414",
       "Blue and gold": "#2f5fc0",
       "Bronze": "#8a5a2b",
       "Bubble glass base": "#e6ecef",
       "Burgundy": "#6b1f2a",
       "Champagne": "#c8b07a",
       "Chrome": "#c4c8cc",
       "Cobalt blue": "#1f3f9f",
       "Cream": "#ece4d0",
       "Cream and gold": "#e6dcc0",
       "Frosted print base": "#e9ecef",
       "Gold and blue": "#c9a54a",
       "Green": "#3f8f2a",
       "Gunmetal": "#4a4d52",
       "Lavender": "#a58fd0",
       "Lime": "#a6c83a",
       "Magenta": "#c2187a",
       "Orange and purple": "#e0662a",
       "Pink": "#e0628a",
       "Purple": "#6b3fa0",
       "Red and copper": "#a3262a",
       "Red and yellow": "#c8372d",
       "Rose gold": "#c99a8a",
       "Smoky and black": "#4a4a46",
       "Smoky grey": "#6e6e68",
       "Steel blue": "#5a7a96",
       "Wood and clear": "#8a5a2b",
       "Wood and gold": "#9a6a32",
       "Yellow and red": "#e3a52a"}

DESCRIBED = "named by what the photo shows (no brand or model readable on the piece): give it its real name"
EXACT = "identified by the hookah council (brand on the piece, model and colour matched to the maker's photo): check model and colour"
BRAND_ONLY = "brand read off the piece, model not found: give it its full name"

# A web photo (owner 2026-11-27: high quality web photos of the exact model and colour are fair game): the page it came from.
# Without one, the shop's original photo goes up with "Photo to be replaced".
W_MINI = "https://www.5starhookah.com/products/steamulation-mini-gen-2-hookah"

# (name, family id or None, where the name comes from, [(photo, colour, web page or None)], reason, group or None)
HOOKAHS = [
    ("Steamulation Mini Gen II", None, "Steamulation Mini engraved on the collar",
     [("IMG_0686", "Silver Metallic", W_MINI), ("IMG_0693", "Gold Metallic", W_MINI),
      ("IMG_0694", "White Matt", "https://www.thepremiumway.com.au/products/steamulation-mini-gen-2-white-matt")], EXACT, None),
    ("Steamulation Pro X II", None, "PRO X engraved on the stem, S logo on the base",
     [("IMG_0711", "White Matt", "https://www.hookahvault.com/products/steamulation-pro-x-2-white-matt")], EXACT, None),
    ("Contraband Kingpin", None, "CONTRABAND on the collar; the red veined stem matched to the maker's Kingpin",
     [("IMG_0701", "Red", None)], EXACT, None),
    ("Contraband Scarface", None, "SCARFACE on the stem, CONTRABAND on the collar",
     [("IMG_0706", "Black and gold", None)], EXACT, None),
    ("HG Hookah, wood and resin stem", None, "HG monogram on the collar",
     [("IMG_0673", "Black and white", None), ("IMG_0674", "Wood and blue", None), ("IMG_0678", "Wood and green", None)],
     "HG monogram on the collar, maker not found; the colour words are the stem's wood and resin: give it its real name", None),
    ("MIG Hookah", None, "MIG on the collar", [("IMG_0714", "Silver", None)], BRAND_ONLY, None),
    ("Hookah Monarchy Hookah", None, "HM Hookah Monarchy engraved on the collar", [("IMG_0697", "Yellow and black", None)], BRAND_ONLY, None),
    ("Performance Smoke Hookah", None, "PERFORMANCE SMOKE engraved on the glass base", [("IMG_0709", "Silver", None)], BRAND_ONLY, None),
    ("Hookah, purple glass base, pink stem", None, "the shop's photo", [("IMG_0670", "Purple and pink", None)], DESCRIBED, None),
    ("Hookah, clear base, black and red stem", None, "the shop's photo", [("IMG_0679", "Black and red", None)], DESCRIBED, None),
    ("Hookah, frosted white base, red stripes", None, "the shop's photo", [("IMG_0681", "White and red", None)], DESCRIBED, None),
    ("Hookah, green glass base, black stem", None, "the shop's photo", [("IMG_0683", "Green and black", None)], DESCRIBED, None),
    ("Hookah, cut-glass base, resin stem", None, "the shop's photo", [("IMG_0687", "Blue and yellow", None)], DESCRIBED, None),
    ("Hookah, white and gold", None, "the shop's photo", [("IMG_0688", "White and gold", None)], DESCRIBED, None),
    ("Hookah, clear base, brown stem", None, "the shop's photo", [("IMG_0690", "Brown", None)], DESCRIBED, None),
    ("Hookah, clear base, twisted silver stem", None, "the shop's photo", [("IMG_0695", "Silver", None)], DESCRIBED, None),
    # the same ribbed silver stem and swirl-glass base shape in two colours (council: "same stem as 0699"): one card, two chips
    ("Hookah, swirl glass base, silver stem", None, "the shop's photo", [("IMG_0698", "Blue", None), ("IMG_0699", "Yellow", None)],
     DESCRIBED + "; the two colours look like one model: check", None),
    ("Hookah, clear base, gold stem", None, "the shop's photo", [("IMG_0700", "Gold and yellow", None)], DESCRIBED, None),
    ("Hookah, blue glass base, silver stem", None, "the shop's photo", [("IMG_0705", "Blue", None)], DESCRIBED, None),
    ("Hookah, frosted base, black and silver stem", None, "the shop's photo", [("IMG_0710", "Black and silver", None)], DESCRIBED, None),
    ("Hookah, clear base, silver stem", None, "the shop's photo", [("IMG_0712", "Silver and black", None)], DESCRIBED, None),
    # the blue Ace Rose: one more colour of the Ace Rose family (the Ace catalogue's family id, so one card with chips)
    ("Rose Hookah", "ace-rose", "ACE engraved on the hose handle, the metal rose on the stem: the Ace Rose (catalogue p48) in blue",
     [("IMG_0715", "Blue", None)], "a blue Ace Rose (not among the Ace catalogue's colours): check the colour", "statement"),
]

# The second batch (Google Drive, 2026-11-28; manifest reports/DRIVE-MANIFEST-2026-11-28.csv): hookahs shot standing on the
# marble table, upright (photos_shop_hookahs.py only crops them, UPRIGHT). Owner, 2026-11-28: "in the Google Drive there's more
# inventory ... get to work getting them ready and on the site"; every item goes up, Price TBD, the client fills the details.
# Same rules as above: the brand only where it is printed on the piece (MOB, MISHAISMYSHISHA, MYA, Contraband, Moze, MattPear,
# Amy Deluxe, MR EDS, Smokah, Amir's, Koress K3, Starbuzz), otherwise what the photo shows; every original goes up with
# "Photo to be replaced". Colours of one card are the same stem and base shape in another finish.
# Left out, and why (each in the manifest): second shots of a hookah listed here (IMG_0729 0731 0732 0736 0738 0740,
# PXL ..001722455 ..002051136 ..002153165 ..002858051 ..003421630 ..011649593); IMG_0730/0731 (the live Contraband Scarface,
# OSS-140006); IMG_0733 (the live OSS-140020's stem, base to check); PXL ..002516743 (MAKLAUD: the Ace Makloud Gold,
# OSS-100262..266) and PXL ..002808548 (rhinestone rifle: the Ace Gun Hookah, OSS-100113..115), already on the site.
BATCH_2 = [
    ("Hookah, smoky teardrop base, black stem", None, "the shop's photo", [("PXL_20261128_000402468", "Black", None)], DESCRIBED, None),
    ("Hookah, bubble glass base, yellow and red stem", None, "the shop's photo", [("PXL_20261128_000711649", "Yellow and red", None)], DESCRIBED, None),
    ("Hookah, blue cut-glass base, gold stem", None, "the shop's photo", [("PXL_20261128_000920111", "Gold and blue", None)], DESCRIBED, None),
    ("Hookah, champagne glass base, gold stem", None, "the shop's photo", [("PXL_20261128_001048012", "Gold", None)], DESCRIBED, None),
    ("LED Hookah, acrylic frame", None, "the shop's photo", [("PXL_20261128_001131337", "Yellow", None), ("IMG_0735", "Blue", None)], DESCRIBED + "; the colours look like one model: check", None),
    ("Hookah, stone mosaic stem and base", None, "the shop's photo", [("PXL_20261128_001542699", "Cream and gold", None)], DESCRIBED, None),
    ("Hookah, black base, rifle stem", None, "the shop's photo", [("PXL_20261128_001650238", "Black and gold", None)], DESCRIBED, None),
    ("MOB Hookah, rifle stem", None, "MOB HOOKAH crown logo on the glass base", [("PXL_20261128_001954528", "Rose gold", None), ("PXL_20261128_002137729", "Magenta", None)], BRAND_ONLY + "; the colours look like one model: check", None),
    ("MISHAISMYSHISHA Hookah", None, "MISHAISMYSHISHA. printed on the stem", [("PXL_20261128_003327263", "Blue", None), ("PXL_20261128_003758009", "Pink", None)], BRAND_ONLY + "; the colours look like one model: check", None),
    ("MYA Hookah", None, "MYA on the collar", [("PXL_20261128_004255952", "Green", None)], BRAND_ONLY, None),
    ("Hookah, smoky base, steel stem in a clear column", None, "the shop's photo", [("PXL_20261128_004355270", "Silver", None)], DESCRIBED + "; MOZE shows in the base glass only (a base can come from another maker)", None),
    ("Hookah, cut-crystal base, steel stem", None, "the shop's photo", [("PXL_20261128_004452376", "Silver", None)], DESCRIBED, None),
    ("Contraband Hookah, resin stem", None, "CONTRABAND engraved on the collar", [("PXL_20261128_004629722", "Orange and purple", None)], BRAND_ONLY, None),
    ("Hookah, cut-crystal base, wood-look teardrop stem", None, "the shop's photo", [("PXL_20261128_004922986", "Wood and gold", None)], DESCRIBED, None),
    ("Hookah, clear base, bronze stem", None, "the shop's photo", [("PXL_20261128_005022344", "Bronze", None)], DESCRIBED + "; MOZE shows in the base glass only (a base can come from another maker)", None),
    ("Hookah, cut-crystal base, spring stem", None, "the shop's photo", [("PXL_20261128_005129760", "Red", None), ("PXL_20261128_005343131", "Blue", None), ("PXL_20261128_011555355", "Lavender", None)], DESCRIBED + "; the colours look like one model: check", None),
    ("Hookah, camel-engraved stem", None, "the shop's photo", [("PXL_20261128_005212636", "Blue", None), ("PXL_20261128_010441354", "Lime", None)], DESCRIBED + "; the colours look like one model: check", None),
    ("Hookah, quilted glass base, steel stem", None, "the shop's photo", [("PXL_20261128_005254462", "Silver", None)], DESCRIBED, None),
    ("Hookah, fluted base, steel and resin stem", None, "the shop's photo", [("PXL_20261128_005523706", "Red", None), ("PXL_20261128_011247784.MP", "Burgundy", None), ("PXL_20261128_011750125", "Yellow", None)], DESCRIBED + "; the colours look like one model: check", None),
    ("Hookah, green ribbed base, chrome stem", None, "the shop's photo", [("PXL_20261128_005618124", "Green", None)], DESCRIBED, None),
    ("Hookah, fluted teardrop stem", None, "the shop's photo", [("PXL_20261128_005704432", "Red", None), ("PXL_20261128_010051374", "Blue", None), ("PXL_20261128_011030855", "Lime", None), ("PXL_20261128_011934455", "Steel blue", None)], DESCRIBED + "; the colours look like one model: check" + "; MOZE shows in the base glass only (a base can come from another maker)", None),
    ("MattPear Hookah", None, "MattPear and Simple on the collar", [("PXL_20261128_005851370", "Black, crackle base", None), ("IMG_0745", "Black, clear base", None)], BRAND_ONLY + "; the colours look like one model: check", None),
    ("Hookah, clear base, black textured stem", None, "the shop's photo", [("PXL_20261128_005930716", "Black", None)], DESCRIBED + "; MOZE shows in the base glass only (a base can come from another maker)", None),
    ("Moze Hookah, resin stem", None, "MOZE on the collar", [("PXL_20261128_010014453", "Purple", None)], BRAND_ONLY, None),
    ("Hookah, bulb vase on a black stand", None, "the shop's photo", [("PXL_20261128_010217372", "Black and gold", None)], DESCRIBED, None),
    ("Hookah, teardrop base, steel stem", None, "the shop's photo", [("PXL_20261128_010247337", "Champagne", None), ("PXL_20261128_010659855", "Smoky grey", None)], DESCRIBED + "; the colours look like one model: check" + "; the smoky grey may be the champagne one with another bowl fitted: check it is a second hookah", None),
    ("Hookah, smoky teardrop base, red stem", None, "the shop's photo", [("PXL_20261128_010607074", "Red", None)], DESCRIBED, None),
    ("Hookah, iridescent base, gold stem", None, "the shop's photo", [("PXL_20261128_010629514", "Gold", None)], DESCRIBED, None),
    ("Hookah, chrome stem, acrylic base", None, "the shop's photo", [("PXL_20261128_010735826", "Chrome", None)], DESCRIBED, None),
    ("Hookah, clear base, slim bronze stem", None, "the shop's photo", [("PXL_20261128_010859808", "Bronze", None)], DESCRIBED + "; MOZE shows in the base glass only (a base can come from another maker)", None),
    ("Hookah, cut-crystal base, gold and blue stem", None, "the shop's photo", [("PXL_20261128_011052595", "Gold and blue", None)], DESCRIBED, None),
    ("Hookah, hexagonal base, cream stem", None, "the shop's photo", [("PXL_20261128_011508060", "Cream", None)], DESCRIBED + "; MOZE shows in the base glass only (a base can come from another maker)", None),
    ("Hookah, amber pyramid base, gunmetal stem", None, "the shop's photo", [("PXL_20261128_012145739", "Gunmetal", None)], DESCRIBED, None),
    ("Hookah, cut-glass base, gold and silver stem", None, "the shop's photo", [("IMG_0672", "Gold and silver", None)], DESCRIBED, None),
    ("Hookah, cut-glass base, black and gold-fleck stem", None, "the shop's photo", [("IMG_0675", "Black and gold", None)], DESCRIBED, None),
    ("Amy Deluxe Hookah, gold rocket stem", None, "AMY DELUXE on the collar", [("IMG_0680", "Gold", None)], BRAND_ONLY, None),
    ("Hookah, cut-glass base, black and gold stem", None, "the shop's photo", [("IMG_0682", "Black and gold", None)], DESCRIBED, None),
    ("MR EDS Hookah", None, "MR EDS badge on the collar and the side knob", [("IMG_0692", "Gold and silver", None)], BRAND_ONLY, None),
    ("Smokah Hookah", None, "smokah on the collar", [("IMG_0704", "Frosted print base", None), ("IMG_0734", "Bubble glass base", None)], BRAND_ONLY + "; the colours look like one model: check", None),
    ("Hookah, clear teardrop base, black stem with clear tube", None, "the shop's photo", [("IMG_0725", "Black", None)], DESCRIBED, None),
    ("Amir's Hookah, square glass base", None, "AMIR'S printed on the glass base", [("IMG_0726", "Wood and clear", None)], BRAND_ONLY, None),
    ("Hookah, football base, gold trophy stem", None, "the shop's photo", [("IMG_0727", "Gold", None)], DESCRIBED, None),
    ("Hookah, red glass base, rifle-rail stem", None, "the shop's photo", [("IMG_0728", "Red and copper", None)], DESCRIBED, None),
    ("Hookah, clear tube on a lit black base", None, "the shop's photo", [("IMG_0737", "Black", None)], DESCRIBED, None),
    ("Hookah, tinted base, wood and resin stem", None, "the shop's photo", [("IMG_0739", "Wood and green", None), ("IMG_0741", "Wood and blue", None)], DESCRIBED + "; the colours look like one model: check" + "; the stems look like the HG Hookah's (OSS-140008/140009, IMG_0674/0678) on other bases: check these are not the same hookahs", None),
    ("Koress K3 Hookah", None, "KORESS K3 on the stem", [("IMG_0742", "Red and yellow", None)], BRAND_ONLY, None),
    ("Hookah, cut-glass base, comic-print stem", None, "the shop's photo", [("IMG_0743", "Purple", None), ("IMG_0744", "Red", None)], DESCRIBED + "; the colours look like one model: check", None),
    ("Hookah, egg-shaped base on tripod legs", None, "the shop's photo", [("IMG_0746", "Black", None), ("IMG_0747", "Green", None)], DESCRIBED + "; the colours look like one model: check", None),
    ("Hookah, canister base on tripod legs", None, "the shop's photo", [("IMG_0748", "Silver", None)], DESCRIBED, None),
    ("Amy Deluxe Hookah, gunmetal stem", None, "AMY DELUXE on the collar", [("IMG_0749", "Black and green", None), ("IMG_0750", "Black and gold", None)], BRAND_ONLY + "; the colours look like one model: check", None),
    ("Hookah, cobalt tiered base, chrome stem", None, "the shop's photo", [("IMG_0753", "Cobalt blue", None)], DESCRIBED, None),
    ("Amy Deluxe Hookah, blue marble stem", None, "AMY DELUXE on the collar and its hang tag", [("IMG_0754", "Blue", None)], BRAND_ONLY, None),
    ("Hookah, clear base, brushed steel stem", None, "the shop's photo", [("IMG_0755", "Silver", None)], DESCRIBED, None),
    ("Starbuzz Hookah", None, "STARBUZZ TOBACCO logo on the base neck", [("IMG_0756", "Blue", None)], BRAND_ONLY + "; same stem, tray and base shape as OSS-140025 (black): check whether that one is a Starbuzz too", None),
    ("Hookah, clear base, blue and gold stem", None, "the shop's photo", [("IMG_0757", "Blue and gold", None)], DESCRIBED, None),
    ("Hookah, lion-head glass base, black stem", None, "the shop's photo", [("IMG_0758", "Smoky and black", None)], DESCRIBED, None),
    ("Hookah, iridescent base, chrome stem", None, "the shop's photo", [("IMG_0759", "Chrome", None)], DESCRIBED, None),
]
HOOKAHS = HOOKAHS + BATCH_2
UPRIGHT = {photo for _n, _f, _w, shots, _y, _g in BATCH_2 for photo, _c, _p in shots}


# Cleaned photos (clear_glass2.py, 2026-11-27): the shop's own photo cut out, the mat under and through the glass cleared,
# framed like the Ace hookahs (frame_cutouts.py --kind hookah --glass). Each passed an atelier:design-reviewer check at 200%
# on two tile colours before it went in. They replace the original under the same file name, without the tag.
# CLEANED_FIRST goes live with hookah-clean-2026-11-27.sql; CLEANED_A (group A, 2026-11-28) with hookah-clean-a-2026-11-28.sql;
# CLEANED_B (group B, 2026-11-28) with hookah-clean-b-2026-11-28.sql; CLEANED_A3 with hookah-clean-a3-2026-11-28.sql.
CLEANED_FIRST = {"IMG_0715", "IMG_0673", "IMG_0681", "IMG_0674", "IMG_0678", "IMG_0697", "IMG_0699", "IMG_0670"}
CLEANED_A = {"IMG_0683"}
CLEANED_B = {"IMG_0705", "IMG_0706", "IMG_0712", "IMG_0714", "IMG_0679", "IMG_0709", "IMG_0710"}
CLEANED_A3 = {"IMG_0688", "IMG_0698", "IMG_0701"}   # group A's held photos, reworked (2026-11-28): hookah-clean-a3-2026-11-28.sql
CLEANED_A2 = {"IMG_0695", "IMG_0700", "IMG_0687"}                 # group A, second pass (2026-11-28): hookah-clean-a2-2026-11-28.sql
CLEANED_C1 = {"PXL_20261128_000402468", "PXL_20261128_000920111", "PXL_20261128_000711649", "PXL_20261128_001048012",
              "PXL_20261128_001542699"}   # crew 1, the Drive batch (OSS-140028 up, 2026-11-28): hookah-clean-crew1-2026-11-28.sql
CLEANED_C2 = {"PXL_20261128_010247337"}   # crew 2, the second batch (2026-11-28): hookah-clean-c2-2026-11-28.sql
CLEANED_CREW3 = {"IMG_0758"}                                       # crew 3, the standing batch (2026-11-28): hookah-clean-crew3-2026-11-28.sql
CLEANED_C5 = {"PXL_20261128_001650238", "PXL_20261128_003327263", "PXL_20261128_003758009", "PXL_20261128_004255952", "PXL_20261128_004629722"}   # crew 5, the Drive batch (OSS-140035 up, 2026-11-28): hookah-clean-c5-2026-11-28.sql
CLEANED = CLEANED_FIRST | CLEANED_A | CLEANED_B | CLEANED_A3 | CLEANED_A2 | CLEANED_C1 | CLEANED_C2 | CLEANED_CREW3 | CLEANED_C5


def photo_name(name: str, colour: str) -> str:
    """The photo's address under store/public/img/pc/ (no extension). A cleaned photo later goes in under the same name."""
    return f"hookah/{slug(name)}-{slug(colour)}"


def families():
    out = []
    for i, (name, fam, where, shots, why, group) in enumerate(HOOKAHS):
        fid = fam or "hookah-" + slug(name)
        src = f"photo:{shots[0][0]} ({where}); {RULE}"
        variants = []
        for photo, colour, web in shots:
            reason = why
            variants.append({"key": f"{fid}#{slug(colour)}", "photo_file": photo, "web": web, "clean": photo in CLEANED,
                             "colour": cell(colour, f"photo:{photo} (the shop's own photo)" + (f"; web:{web}" if web else "")),
                             "swatch_hex": cell(HEX[colour], f"rule: chip colour for '{colour}'"),
                             "confirm": cell(reason, RULE if reason else None),
                             "img": photo_name(name, colour)})
        out.append({
            "family_id": fid, "order": i, "category": "hookahs",
            "name": cell(name, src),
            "supplier_ref": cell(f"{name} ({where})", f"photo:{shots[0][0]}"),
            "facts": {"group": cell(group, src if group else None), "weight_g": cell(None, None)},
            "flags": [f"NEEDS SHOP: {why}"],
            "variants_src": variants,
        })
    return out

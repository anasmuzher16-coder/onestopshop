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
       "Silver": "#b8bcc0"}

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


# Cleaned photos (clear_glass2.py, 2026-11-27): the shop's own photo cut out, the mat under and through the glass cleared,
# framed like the Ace hookahs (frame_cutouts.py --kind hookah --glass). Each passed an atelier:design-reviewer check at 200%
# on two tile colours before it went in. They replace the original under the same file name, without the tag.
# CLEANED_FIRST goes live with hookah-clean-2026-11-27.sql; CLEANED_A (group A, 2026-11-28) with hookah-clean-a-2026-11-28.sql.
CLEANED_FIRST = {"IMG_0715", "IMG_0673", "IMG_0681", "IMG_0674", "IMG_0678", "IMG_0697", "IMG_0699", "IMG_0670"}
CLEANED_A = {"IMG_0683"}
CLEANED = CLEANED_FIRST | CLEANED_A


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

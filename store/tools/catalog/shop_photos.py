"""The shop's own photos standing in for Ace catalogue photos (owner, 2026-11-27: "start extracting them, cropping, cleaning
them up and putting them on the site").

A colour of an Ace hookah whose catalogue photo was low-resolution ("Photo to be upscaled") or missing (shown in another
colour) gets the shop's own photo of that very piece, matched by look: shape, colours and the printed branding in the photo.
Cut with rembg (birefnet-general-lite), framed by frame_cutouts.py --kind hookah, published under store/public/img/pc/shop/.
build_ace (catalog.py) uses these in place of the catalogue photo; status "shop" is a usable photo with no label.
"""
from __future__ import annotations

# Ace variant key -> (site photo name under img/pc, colour seen in the shop's photo, shop photo file, why it is this piece)
SHOP_PHOTOS = {
    # IMG_0713: below the base's widest point the cut-out is trimmed to the base's own outline (convex hull of its orange
    # glass), which takes off the shop's black display stand and a sliver of the white table under it
    "ace-rose##000000": ("shop/ace-rose-red", "red", "IMG_0713",
                         "Ace Rose hookah: the metal rose on the stem, ACE on the tongs, the swirled glass base (catalogue p48)"),
    # Not used: the Tsar Molotov photos (IMG_0684 green, IMG_0685 blue). Their clear base shows the shop's patterned mat through the
    # glass, and the base is etched MOZE where the catalogue says Tsar: left for the shop to check and reshoot.
}

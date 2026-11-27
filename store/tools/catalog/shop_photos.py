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
    # glass), which takes off the shop's black display stand and a sliver of the white table under it:
    #   frame_cutouts.py CUTOUTS OUT --kind hookah --trim-base-below 3560 IMG_0713   (then -l is not kept: Ace rows set no img_lw)
    "ace-rose##000000": ("shop/ace-rose-red", "red", "IMG_0713",
                         "Ace Rose hookah: the metal rose on the stem, ACE on the tongs, the swirled glass base (catalogue p48)"),
    # IMG_0684, IMG_0685: the clear cone base stood on the shop's patterned mat, which showed through the glass. The mirrored MOZE
    # logo in it is printed in the mat's middle (it shows the same under the Panda), not on the base. clear_glass.py clears what
    # is seen through the glass and keeps the outline, highlights, swing tag and downstem; framed without speck cleaning:
    #   clear_glass.py SRC CUTOUTS GLASS IMG_0684 IMG_0685; frame_cutouts.py GLASS OUT --kind hookah --glass IMG_0684 IMG_0685
    #   (-l not kept, as for the Rose)
    "ace-tsar-molotov##a6e147": ("shop/ace-tsar-molotov-green", "green", "IMG_0684",
                                 "Tsar Molotov (catalogue p26): TSAR on the stem and on the X swing tag, the cone base under a "
                                 "flared collar; the catalogue's green chip, which showed the blue photo"),
    "ace-tsar-molotov##5271ff": ("shop/ace-tsar-molotov-blue", "blue", "IMG_0685",
                                 "Tsar Molotov (catalogue p26): TSAR on the stem and on the X swing tag; the blue chip, whose "
                                 "catalogue photo was enlarged"),
}

# Zigly app — project rules

## `zigly-website-code/` is READ-ONLY

The folder `zigly-website-code/` holds the raw Shopify theme source for
zigly.com (Zigly-Live-June, Dawn 15.2.0), provided as the reference for how
the website actually works.

**Never create, edit, move, rename or delete any file under
`zigly-website-code/`.** It is not part of the app build. Read it only — to
learn the real structure, the real settings, the real section and block
schemas, the real class names — and then write the app's own code outside it.

If a change seems to require touching it, that is a signal the app code is
wrong, not the theme. Say so rather than editing the theme.

This holds for every session, without needing to be restated.

## The standing design rule

Data comes from zigly.com; the view is ours. Read every figure, product,
price, heading and image URL from the live site (see `DATA-SOURCES.md` for the
verified endpoint inventory), and draw it in whatever UI is best. Never
invent a product, a price or a claim.

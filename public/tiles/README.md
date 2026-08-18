# Importable tiles

A composed tile is described in a **JSON** file, imported from the catalogue
(*Import a file* button, in edit mode). The format takes a single tile as well
as a whole pack, and each tile can carry its own CSS.

This folder is not read automatically: it is a workshop. Files can be imported
from anywhere on your device.

## A pack

```json
{
  "name": "Sport pack",
  "themeId": "neon-miami",
  "tiles": [
    {
      "label": "Engine block",
      "metrics": ["rpm", "boost", "coolant"],
      "colSpan": 2,
      "rowSpan": 1,
      "css": ".tile__value { color: #ff2d95; }"
    },
    {
      "label": "Full trip",
      "metrics": ["tripDistance", "tripAverage", "tripDuration"]
    }
  ]
}
```

## A single tile

The envelope is optional — a lone object is enough, and so is a plain array of
tiles:

```json
{
  "label": "Speed & revs",
  "metrics": ["speed", "rpm"],
  "colSpan": 2,
  "css": ".tile__value { font-style: italic; }"
}
```

## Backgrounds

A pack can also provide backgrounds, under the `backgrounds` key. They work
exactly like tiles — scoped CSS, declarative structure, telemetry variables —
because a background is not necessarily an image.

```json
{
  "name": "Pulsing scenery",
  "backgrounds": [
    {
      "label": "Reactive halo",
      "layout": [{ "tag": "div", "class": "glow" }],
      "css": ".glow { position: absolute; inset: 0; opacity: calc(0.25 + var(--rpm-ratio) * 0.75); }"
    }
  ]
}
```

A background must provide at least `css` or `layout`. It lays over the theme
background rather than replacing it, which lets a translucent scenery compose
with it. **Every** metric is published there as a variable, not just a few: a
scenery has no principal metric.

The active background is chosen in the settings, where imported packs can also
be removed in one go.

## Fields

| Field     | Required | Detail                                                                 |
| --------- | -------- | ---------------------------------------------------------------------- |
| `metrics` | **yes**  | Non-empty list. The first is the principal value, the rest show as extras. |
| `label`   | no       | Name in the catalogue. Failing that, the list of metrics stands in.    |
| `colSpan` | no       | Width when placed, 1 to 6. Default: 1.                                 |
| `rowSpan` | no       | Height when placed, 1 to 6. Default: 1.                                |
| `themeId` | no       | Attaches the tile to a theme, for the catalogue filter.                |
| `css`     | no       | Styling specific to this tile. See below.                              |
| `layout`  | no       | Internal structure. Failing that, the standard layout applies.         |

At pack level, `name` names the whole and `themeId` serves as the default for
all its tiles.

### Metric identifiers

`speed`, `rpm`, `gear`, `throttle`, `boost`, `consumption`, `consumptionRate`,
`engineLoad`, `coolant`, `maf`, `lateralG`, `longitudinalG`, `tripDistance`,
`tripAverage`, `tripDuration`, `avatar`.

An unknown identifier causes **that tile** to be rejected, with a precise
message; the other tiles of the pack are imported as usual.

### Theme identifiers

`neon-miami`, `stealth`, `rally`.

## The CSS

The content of `css` is **scoped to the tiles built from this template**, by a
`@scope` rule applied by the browser. You therefore have nothing to prefix:
write your selectors normally, they will not bite into the rest of the
interface.

Useful classes:

| Class                   | Element                                    |
| ----------------------- | ------------------------------------------ |
| `.tile`                 | the whole tile                             |
| `.tile__label`          | the caption in small capitals              |
| `.tile__value`          | the principal value                        |
| `.tile__unit`           | its unit                                   |
| `.tile__bar`            | the level bar                              |
| `.tile__bar-fill`       | its filled part                            |
| `.tile__secondaries`    | the row of secondary values                |
| `.tile__secondary`      | one secondary value                        |

The theme variables stay available: `var(--accent)`, `var(--accent-alt)`,
`var(--text-muted)`, `var(--tile-border)`… Using those rather than fixed colours
keeps the tile coherent when the theme changes.

### Live values

Every tile publishes its metrics as CSS variables, refreshed on every frame.
That is what lets you draw a real instrument rather than a plain readout: a
needle, a dial that fills, a colour that flips at a threshold.

| Variable              | Content                                                  |
| --------------------- | -------------------------------------------------------- |
| `--<metric>`          | raw value, in its display unit                            |
| `--<metric>-ratio`    | the same, brought between 0 and 1                         |
| `--<metric>-known`    | `1` if the vehicle provides it, `0` otherwise             |
| `--value`, `--ratio`, `--known` | the same for the tile's principal metric        |

For example, `--rpm-ratio` for engine speed. A missing metric is `0` rather than
nothing: an empty variable would invalidate the `calc()` using it, and the
styling would vanish without explanation.

```css
/* Needle sweeping 280° */
.needle { transform: rotate(calc(-140deg + var(--rpm-ratio) * 280deg)); }

/* Arc that fills */
.arc { background: conic-gradient(var(--accent) calc(var(--rpm-ratio) * 100%), #333 0); }

/* Colour turning red as the threshold approaches */
.value { color: color-mix(in srgb, #ff4d4d calc(var(--coolant-ratio) * 130%), var(--accent)); }
```

## The structure (`layout`)

Without `layout`, the tile shows the standard arrangement: caption, value, level
bar, secondary values. With it, you compose freely.

```json
"layout": [
  { "tag": "div", "class": "gauge", "children": [
      { "tag": "div", "class": "arc" },
      { "tag": "div", "class": "needle" },
      { "value": "rpm", "class": "big" }
  ]},
  { "unit": "rpm" }
]
```

Node types:

| Node                                   | Renders                                   |
| -------------------------------------- | ----------------------------------------- |
| `{ "text": "…" }`                      | a fixed piece of text                     |
| `{ "value": "rpm" }`                   | the current value, formatted and refreshed |
| `{ "label": "rpm" }`                   | the caption of the metric                 |
| `{ "unit": "rpm" }`                    | its unit                                  |
| `{ "tag": "div"\|"span", "children": [] }` | a container                           |

Every node accepts a `class`.

**Only `div` and `span` are allowed**, with no other attribute. This is not
HTML: accepting free markup from a third-party file would let remote images,
frames and links through. Everything else is done in CSS, where pseudo-elements,
gradients and masks cover most of the drawing.

Depth is limited to 8 levels and the node count to 120 — an oversized template
would freeze rendering on a phone.

See [`example-dial.json`](example-dial.json): a needle rev counter and a
threshold temperature readout, entirely described in JSON.

**Mind the provenance.** Scoping stops an imported stylesheet from damaging the
interface, but not from requesting a remote image — and so signalling its
opening to a server. Of no consequence for personal offline use; still, import
only files whose origin you know.

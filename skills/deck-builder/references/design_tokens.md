# Design tokens

Pick ONE palette + ONE style recipe + the type/space scales, and apply them
everywhere. Adapted from MiniMax-AI/skills (MIT); condensed.

## Palettes (pick one; use only its colors + transparency)
| Theme | Colors | Best for |
|---|---|---|
| Business & Authority | `#2b2d42` `#8d99ae` `#edf2f4` `#ef233c` | annual reports, corporate, finance |
| Education & Charts | `#264653` `#2a9d8f` `#e9c46a` `#f4a261` `#e76f51` | data/analysis, general business |
| Tech & Night (dark) | `#000814` `#001d3d` `#003566` `#ffc300` `#ffd60a` | tech launches, premium dark decks |
| Pure Tech Blue | `#03045e` `#0077b6` `#00b4d8` `#90e0ef` `#caf0f8` | cloud/AI, clean energy |
| Luxury & Mysterious | `#22223b` `#4a4e69` `#9a8c98` `#c9ada7` `#f2e9e4` | high-end consulting, premium |
| Platinum White-Gold | `#0a0a0a` `#0070F3` `#D4AF37` `#f5f5f5` | fintech, corporate, luxury |

Brand override: if the client has a charter (e.g. dark navy bg + gold + cyan),
use it verbatim and ignore the table.

Rules: only palette colors (transparency allowed); solid fills (no gradients
unless brand); static (no animation); text on a colored fill uses the darkest
shade of that same family — never pure black on a tint.

## Style recipes (corner radius + spacing)
| Recipe | Card radius | Padding | Block gap | Use for |
|---|---|---|---|---|
| Sharp & Compact | 0–0.05" | 0.1–0.15" | 0.25–0.35" | data-dense, tables, finance |
| Soft & Balanced | 0.08–0.12" | 0.15–0.2" | 0.35–0.5" | corporate / general (default) |
| Rounded & Spacious | 0.15–0.25" | 0.2–0.3" | 0.5–0.7" | product, marketing |
| Pill & Airy | 0.3–0.5" | 0.25–0.4" | 0.6–0.9" | brand showcase, launches |

In python-pptx, `rrect(..., radius=fraction)` where fraction is 0..0.5 of the
shorter side. For a perfect pill, radius=0.5 on a thin bar (corner = height/2).

## Mixing rules
- Outer container radius ≥ inner element radius (else inner appears to overflow).
- A pill/bar accent on a rounded card must be **inset past the card's corner
  radius** (inset ≈ radius_emu + ~0.02") or its square ends overhang the corner.
- Density drives spacing: data zones → Sharp/Soft; browsing zones → Rounded/Pill.

## Type scale (pt)
| Use | Size |
|---|---|
| Source / caption | 10–12 |
| Body / description | 14–16 (16–18 for sparse slides) |
| Subtitle / card header | 18–22 |
| Slide title | 28–36 |
| Cover / section title | 44–60 |
| Data callout (big number) | 60–96 |

Floor: body ≥ 14pt. Two weights only (regular + bold). Bold = titles/labels;
never bold whole body paragraphs.

## Spacing scale (16:9, EMU via pptx_kit.IN)
| Use | Inches |
|---|---|
| icon ↔ text | 0.08–0.15 |
| list item gap | 0.15–0.25 |
| card inner padding | 0.2–0.4 |
| element group gap | 0.3–0.5 |
| page safe margin | 0.4–0.6 |
| major block gap | 0.5–0.8 |

## Quick pick
Finance/data → Sharp. Corporate/business → Soft. Product/marketing → Rounded.
Brand/launch → Pill. Tech → Sharp/Soft.

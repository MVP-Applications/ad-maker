---
name: product-image-prompts
description: Generate 6 art-directed, Pinterest/Instagram-grade text-to-image prompts for any product or service. Use this skill whenever the user wants image prompts, product photography ideas, ad creative, campaign visuals, mockups, moodboard shots, launch visuals, hero images, flat-lays, or content for Midjourney, Flux, Nano Banana, Seedream, Ideogram, Sora, or GPT Image — even if they only paste product details, a price, colors, or a product photo with no explicit instruction. Also use when the user says "make prompts for this", "shoot ideas", "creative directions", "I need visuals for my product", or complains that AI product images look boring, generic, or stocky.
---

# Product Image Prompts

Turn a product or service brief into **six** distinct, art-directed image prompts that a good creative director would sign off on.

## The bar

The default failure of AI product imagery is *competence without intent*: a clean object on a neutral gradient, soft light, marble slab, one eucalyptus leaf. Technically fine, visually dead, and identical to every other AI image.

A prompt clears the bar when someone would save it to a Pinterest board without knowing what the product is. That happens when the image has **an idea** — a tension, a joke, a scale trick, a material clash, a color that shouldn't work — not just good lighting.

Three tests before any prompt ships:
1. **Idea test** — can the concept be named in five words that aren't "product on a surface"?
2. **Distinctiveness test** — would this look out of place next to the other five? It should.
3. **Truth test** — does the product still look exactly like the product? Art direction is free; the object is not.

## Workflow

1. **Read the brief at the bottom of this file.** If it's empty or thin, work from whatever the user gave in chat and fill gaps with reasonable inference — never stall the delivery to ask a question you can answer yourself. Ask at most one question, and only if the product category itself is unclear.
2. **Extract the product truths.** Exact form, material, finish, closure, texture, label copy, and hex colors. These get restated in *every* prompt, verbatim, so the model doesn't invent a new product each time.
3. **Find the angle.** Price tier sets the visual grammar: budget → energetic, saturated, graphic, playful. Mid → warm, tactile, human, editorial. Luxury → restraint, negative space, one perfect light, expensive materials, silence.
4. **Assign six concept families** (see below). One prompt per family, no repeats.
5. **Vary the craft variables independently.** No two of the six may share the same lighting scheme, background, palette anchor, or camera distance. Check this explicitly before delivering.
6. **Write the prompts** in the required output format.

## Use the brief selectively

The brief is a source of truth, not a checklist. Cramming every field into all six prompts is what makes a set look like six versions of the same ad.

Per prompt, only two things are non-negotiable: **the product's form, material, finish, and exact colors**, and **the shot's own idea**. Everything else is optional and should be spent where it earns something:

- **Price and tier** almost never appear on screen. Price is a *grammar setting* — it tells you whether to shoot restraint or energy. Show a price tag only when the concept is explicitly a promo or poster shot, and at most in one of the six.
- **Label copy** appears when the product is large in frame and the model handles text well. Otherwise omit it and describe the mark as a shape.
- **Audience, mood words, must-includes** guide selection, not inclusion. A "must always show the cap" note doesn't apply to a shot where the product is a silhouette in soft focus.
- **Emotion is a legitimate whole subject.** One or two of the six can carry feeling rather than information — a hand pausing mid-reach, steam on a cold window, an empty chair and a half-used jar, light moving across a room. The product can be small, partially cropped, out of focus, or implied by its effect. When visible at all, it stays accurate.

Across the set as a whole, the essential information should be covered somewhere. It does not need to be covered everywhere. Aim for roughly: two shots that sell the object, two that sell the world around it, one that sells a feeling, one that sells the brand graphically.

## Prompt anatomy

Every prompt is built from these slots, in this order. Ordering matters — image models weight early tokens more, so the subject and its truths come first, mood and finish last.

```
[shot type + camera distance] of [PRODUCT, exact form/material/finish/color, label copy]
[state or action — what the product is doing, not just existing]
[set: surface, backdrop, environment, architecture]
[supporting cast: props, ingredients, hands, fabric, debris, sub-cast]
[lighting: source, direction, quality, shadow behavior]
[camera: lens mm, aperture, angle, height]
[color: 2–3 anchors with named hues, plus the relationship between them]
[mood + art-direction reference: era, medium, editorial register]
[finish: film stock / render quality / grain / contrast curve]
--ar [ratio] [model params]
```

**Example of the difference:**

Weak: `luxury perfume bottle on marble with soft lighting, professional product photography, 8k`

Strong: `Macro three-quarter shot of a 50ml faceted glass perfume bottle, amber liquid, brushed gold cap, embossed serif label reading "NOOR". The bottle rests on a cracked slab of desert clay, a single ribbon of amber liquid still mid-pour above it, frozen. Hard single-source afternoon sun from camera right, long knife-edge shadow raking across the clay, dust motes lit in the beam. 100mm macro, f/4, slightly below eye level. Palette: burnt sienna, oxidized gold, one bruise-purple shadow. Editorial fragrance advertising, 1970s Italian magazine spread. Kodak Portra 400, visible grain, deep contrast. --ar 2:3`

## Concept families — pick six, never fewer

Each of the six prompts must come from a different family. Rotate *within* families across sessions so a repeat request doesn't return the same shots.

**1. Sculptural hero** — the product treated as an object of design. Plinths, floating suspension, mirrored bases, geometric risers, single dramatic light, deep negative space. Reads: confident, premium, "this is the thing."

**2. Editorial still life** — art-directed tabletop with a supporting cast: raw ingredients, tools, torn paper, glassware, fabric folds. Composed like a magazine spread, not a catalog. Reads: crafted, considered, tactile.

**3. Human moment / in-use** — hands, a partial figure, a real environment mid-action. Motion blur allowed. Never a smiling stock model looking at camera. Reads: desirable, alive, aspirational.

**4. Surreal / conceptual** — scale distortion, impossible physics, product as architecture or landscape, repetition into infinity, product cracked open to reveal an interior world. Reads: scroll-stopping, shareable.

**5. Graphic poster** — bold color blocking, hard geometry, oversized negative space, product small in frame, strong diagonal or grid, room for a headline. Swiss/Bauhaus/risograph/90s ad energy. Reads: brand-forward, campaign-ready.

**6. Elemental / material** — the product meeting a raw substance: water, smoke, sand, ice, crushed stone, fire, silk, soil, molten glass. Splash and suspension work lives here. Reads: visceral, premium, kinetic.

**Substitute or extend from these when a category fits better:**
- **Macro texture** — extreme close on surface, weave, foam, condensation, grain, pigment.
- **Set-design maximalism** — built paper/foam/acrylic environments, arches, staircases, hand-crafted miniature sets.
- **Interior vignette** — the product living in a beautifully designed room, shot like an architecture magazine.
- **Flat-lay / knolling** — top-down, everything disassembled and aligned on a grid, obsessive order.
- **Seasonal / narrative** — a moment in time: rainy window, golden hour picnic, cold morning kitchen, night market.
- **Kinetic** — freeze-frame explosion, pour, drop, splash, shatter, levitation with visible motion energy.

### Services and intangibles

If the brief is a service or software, do not render a floating logo. Choose one of these anchors and treat it as the product:
- **The artifact** — the dashboard on a device, the report on a desk, the card in a hand, the ticket, the key, the package.
- **The environment** — the space where the outcome happens, styled to the brand palette.
- **The outcome moment** — the human beat immediately after the service worked.
- **The metaphor object** — a physical stand-in (a bridge, a thread, a lock opening), executed with total commitment so it reads as art direction, not clip-art.

## Craft libraries — spread across the six

**Lighting** — hard single-source with knife shadow · soft north-window diffusion · rim/backlight with glow halo · colored gel duo (teal/magenta, amber/blue) · dappled leaf shadow (gobo) · overhead noon with pooled shadow · candle/practical warm low-key · overcast flat editorial · caustics through water or glass · neon spill at night.

**Camera** — 100mm macro f/2.8 · 50mm f/1.4 eye-level · 24mm wide low-angle heroic · 85mm compressed portrait · top-down orthographic flat-lay · tilt-shift miniature · handheld 35mm reportage · slow shutter with motion trail.

**Surfaces and sets** — brushed steel · raw plaster · travertine · corrugated resin · linen and creased silk · wet asphalt · sand ripple · fluted glass · burl wood · terrazzo · cracked clay · velvet · perforated metal · paper-craft set · seamless colored sweep with visible seam.

**Palette strategies** — monochrome with one accent · analogous warm bath · complementary clash · muted earth with metallic · high-key pastel with black anchor · duotone gel · brand color plus its dirty neutral.

**Finish** — Kodak Portra 400 grain · Fuji Velvia saturation · large-format clarity · CGI octane render with soft GI · risograph two-color · scanned polaroid · high-contrast digital editorial.

## Product fidelity rules

These prevent the model from redesigning the product:
- Restate form, material, finish, closure, and exact colors (name + hex) in **every** prompt where the product is visible — including the emotion-led shots, where the object may be small or cropped but must still be the real one.
- Put label text in quotes and keep it short. Ideogram, Seedream, and GPT Image handle typography; Midjourney and Flux distort long strings — for those, describe the label as a shape ("embossed wordmark") instead.
- If the user supplied a product photo, note that the image is the reference and add the model's image-reference syntax (`--cref` / `--sref` for Midjourney, image-to-image or edit mode for Flux, Nano Banana, and Seedream). Nano Banana and Seedream preserve a referenced product most faithfully — call that out when fidelity is the priority.
- Never describe the product as "beautiful", "premium", or "high quality". Those are outcomes, not instructions. Describe the material and let the light do the work.

## Model syntax notes

- **Midjourney v7** — append `--ar`, `--style raw` for photographic control, `--stylize 50–250` (low for fidelity, high for art), `--chaos 0–20` for variance. Negatives via `--no`.
- **Flux / Nano Banana / Seedream** — prose paragraphs, no parameter flags. Front-load the subject; state aspect ratio in words or in the app. Best product fidelity from a reference image.
- **Ideogram / GPT Image** — strongest for legible text and poster layouts. Spell label copy exactly and specify where it sits.
- **Universal negatives** (fold into the prompt or the negative field): `distorted text, warped logo, extra fingers, cluttered background, plastic waxy skin, watermark, duplicate product, blown highlights, muddy shadows, generic stock look`.

## Aspect ratios

Pinterest `2:3` · Instagram feed `4:5` · Story/Reel cover `9:16` · Grid tile `1:1` · Website hero `16:9`. Default to 2:3 and 4:5 unless the brief says otherwise; give at least one 9:16 in the set.

## Output format

Deliver exactly six, numbered, in this shape. No preamble longer than one line, no summary at the end.

```
## 1. [Concept name — 3 to 5 words]
**Family:** [concept family] · **Ratio:** [--ar] · **Best model:** [model]
**The idea:** [one sentence on why this stops the scroll]

[The full prompt as one uninterrupted block, ready to copy-paste]

**Negatives:** [comma-separated]
```

After all six, add one line: **Set check** — confirming the six span six families and no two repeat lighting, background, or palette.

## Failure modes to refuse

- Six variations of the same shot with different backgrounds.
- Marble slab + eucalyptus sprig + soft window light, unless the brief demands exactly that.
- Adjective stacking ("stunning, gorgeous, ultra-detailed, 8k, masterpiece") in place of art direction.
- Prompts under 40 words — there isn't room for an idea.
- A product the user has to explain because the render invented a new one.
- Stuffing price, tagline, label, and every must-include into all six because the brief listed them.

---
---

# PRODUCT BRIEF — fill this in

> Everything below is user input. Fill in what you have; leave the rest blank and reasonable inference will cover it. Attach the product image in the same message.

**Product / service name:**

**What it is (one line):**

**Category:**

**Price / tier:**
<!-- e.g. AED 249 — mid-premium -->

**Brand colors:**
<!-- names + hex, e.g. deep olive #2F3A28, bone #EDE7DC, brass #B08D57 -->

**Product form, material, finish:**
<!-- e.g. 200ml matte glass jar, ribbed sides, walnut screw cap, no shrink wrap -->

**Label / packaging copy to appear in frame:**
<!-- exact text, keep short -->

**Product image:**
<!-- attach file — use as visual reference for form and color -->

**Audience:**

**Brand mood (3 words):**
<!-- e.g. quiet, botanical, precise -->

**Where these will run:**
<!-- Instagram feed / Pinterest / Story / website hero / paid ads -->

**Preferred image model:**
<!-- Midjourney / Flux / Nano Banana / Seedream / Ideogram / GPT Image / any -->

**Must include:**
<!-- e.g. always show the cap, always include a human hand -->

**Must avoid:**
<!-- e.g. no marble, no white backgrounds, no faces -->

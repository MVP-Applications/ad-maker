/**
 * The craft library: the moves an art director actually chooses between.
 *
 * Twelve Creative Directions were never twelve looks — they were twelve
 * bundles, each one welding a subject treatment to a lighting setup to a
 * palette to a camera position. Two Product Hero ads came back as the same
 * photograph because the direction had already decided everything except the
 * product in it.
 *
 * So the bundles come apart. A direction now says what the picture is OF, and
 * these axes say how it is made: how it is lit, what it is shot on, how it is
 * arranged, what it sits on, how it is graded, and what the copy is arguing.
 * They are orthogonal on purpose — any lighting works with any lens works with
 * any surface — so the director composes rather than picks from a menu of
 * finished pictures.
 *
 * Roughly a hundred and seventy named moves live here and in `directions.ts`.
 * Composed, they are not a hundred and seventy looks: a direction, a light, a
 * lens, a composition, a surface and a grade is a space in the tens of millions,
 * and every point in it is coherent because each axis was written to stand
 * alone. That is the argument for building it this way rather than writing three
 * hundred flat presets — three hundred presets is three hundred looks, and the
 * three hundred and first is a code change.
 *
 * Each entry carries the sentence that goes into the image prompt. The director
 * chooses by key alone, so its own prompt stays short; the prose is spliced in
 * here, where it can be edited without retraining anybody's expectations.
 */

export type CraftMove<K extends string> = {
  key: K;
  /** Short human name, for the menu the director reads and the UI shows. */
  label: string;
  /** The sentence spliced into the image prompt when this move is chosen. */
  prompt: string;
};

/* ─────────────────────────── light ─────────────────────────── */

/**
 * How the subject is lit, which is the single largest lever on whether an
 * advertisement looks expensive. Studio setups, natural conditions and the
 * practical-light looks that read as contemporary rather than catalogue.
 */
export const LIGHTING = [
  {
    key: "rembrandt",
    label: "Rembrandt key",
    prompt:
      "One hard key light 45 degrees off-axis and slightly above, throwing a small triangle of light on the shadow side. Deep, controlled shadow everywhere else.",
  },
  {
    key: "butterfly",
    label: "Butterfly / beauty",
    prompt:
      "A single soft key placed high and dead-on, casting a small symmetric shadow directly beneath the subject. Clean, flattering, cosmetic-campaign light.",
  },
  {
    key: "split_light",
    label: "Split light",
    prompt:
      "A hard light exactly side-on, so half the subject is lit and half falls to black. Nothing fills the shadow.",
  },
  {
    key: "rim_separation",
    label: "Rim separation",
    prompt:
      "Two rim lights behind the subject drawing a bright edge down both sides, with only a whisper of frontal fill. The silhouette carries the shot.",
  },
  {
    key: "soft_box_wrap",
    label: "Wrapped softbox",
    prompt:
      "One very large softbox close to the subject, wrapping the light all the way around it. Almost shadowless, gradient falloff, no hard edges anywhere.",
  },
  {
    key: "hard_flash",
    label: "Direct hard flash",
    prompt:
      "Bare on-camera flash, hard and frontal, throwing a crisp black shadow onto the surface behind. Slightly overexposed highlights, the look of a nineties press photograph.",
  },
  {
    key: "golden_hour",
    label: "Golden hour",
    prompt:
      "Low warm sun raking across the frame minutes before it sets, long soft shadows stretching away from the subject, a faint haze in the air.",
  },
  {
    key: "blue_hour",
    label: "Blue hour",
    prompt:
      "The cool, even light twenty minutes after sunset. Deep blue ambient, no visible sun, any warm light in frame glowing against it.",
  },
  {
    key: "overcast",
    label: "Overcast diffusion",
    prompt:
      "Flat, cool, shadowless daylight through heavy cloud. Colours read true, contrast is gentle, nothing sparkles.",
  },
  {
    key: "window_north",
    label: "North-facing window",
    prompt:
      "Soft directional daylight from a large window to one side, falling off gently across the frame, with a subtle bounce filling the shadows.",
  },
  {
    key: "dappled_leaf",
    label: "Dappled through leaves",
    prompt:
      "Sunlight broken by foliage, scattering irregular bright patches and soft-edged shadows across the subject and the surface it sits on.",
  },
  {
    key: "venetian_blind",
    label: "Blind slats",
    prompt:
      "Hard light through venetian blinds, laying parallel bands of light and shadow across the subject and the wall behind it.",
  },
  {
    key: "neon_practical",
    label: "Neon practicals",
    prompt:
      "Coloured neon tubes inside the frame doing the lighting themselves, spilling saturated colour onto nearby surfaces, with deep unlit shadow between them.",
  },
  {
    key: "gel_duotone",
    label: "Two gelled heads",
    prompt:
      "Two gelled lights from opposite sides in contrasting colours, meeting across the subject so each side takes a different hue.",
  },
  {
    key: "underlit",
    label: "Underlight",
    prompt:
      "The light source below the subject, throwing shadow upward. Unnatural, theatrical, slightly unsettling in a deliberate way.",
  },
  {
    key: "backlit_silhouette",
    label: "Backlit silhouette",
    prompt:
      "A bright source directly behind the subject, reducing it almost to a shape, with a thin halo of light around its outline and glare blooming past it.",
  },
  {
    key: "caustics",
    label: "Water caustics",
    prompt:
      "Light refracted through moving water, casting rippling bright web patterns over the subject and the surface around it.",
  },
  {
    key: "specular_glint",
    label: "Specular glints",
    prompt:
      "Small hard sources placed to strike every polished edge, so the subject is picked out in sharp bright glints against a darker field.",
  },
  {
    key: "high_key",
    label: "High key",
    prompt:
      "Everything lit bright and even against a white field, shadows almost eliminated, the subject separated by its own edges rather than by tone.",
  },
  {
    key: "low_key",
    label: "Low key",
    prompt:
      "A single restrained source in an otherwise dark room. Most of the frame falls to near-black; only what matters is lit.",
  },
  {
    key: "candle_warmth",
    label: "Candlelight",
    prompt:
      "One small warm flickering source close to the subject, falling off fast into warm darkness, with a gentle amber cast on everything it reaches.",
  },
  {
    key: "screen_glow",
    label: "Screen glow",
    prompt:
      "Cool light from an unseen display, lighting the subject from below and in front, the rest of the room in dim ambient shadow.",
  },
  {
    key: "studio_gradient",
    label: "Gradient sweep",
    prompt:
      "A single light aimed at the backdrop rather than the subject, producing a smooth bright-to-dark gradient behind it and gentle reflected fill in front.",
  },
  {
    key: "top_down_shadow",
    label: "Overhead hard sun",
    prompt:
      "Hard light straight down from above, compressing shadows into small dense pools directly beneath everything in frame.",
  },
  {
    key: "fog_beam",
    label: "Volumetric beam",
    prompt:
      "A visible shaft of light cutting through faint atmospheric haze, the beam itself as much a subject as what it lands on.",
  },
  {
    key: "bounce_card",
    label: "White bounce",
    prompt:
      "Key light bounced off a large white card, soft and directional with an open, luminous shadow side. Clean commercial product light.",
  },
  {
    key: "sunset_flare",
    label: "Lens flare",
    prompt:
      "The sun clipping the edge of the frame, throwing anamorphic streaks and a warm veiling glare across one side of the image.",
  },
  {
    key: "moonlit_cool",
    label: "Moonlight",
    prompt:
      "Cool, dim, directional light with deep blue shadows and only the highest highlights retaining detail.",
  },
] as const satisfies readonly CraftMove<string>[];

export type LightingKey = (typeof LIGHTING)[number]["key"];

/* ─────────────────────────── camera ─────────────────────────── */

/** What it was shot on, and from where. */
export const LENSES = [
  {
    key: "portrait_85",
    label: "85mm portrait",
    prompt:
      "Shot on an 85mm lens at f/2, the subject sharp and the background falling into smooth defocus.",
  },
  {
    key: "macro_100",
    label: "100mm macro",
    prompt:
      "Shot on a 100mm macro, close enough that the depth of field is a razor-thin band and surface texture becomes the subject.",
  },
  {
    key: "wide_24",
    label: "24mm wide",
    prompt:
      "Shot on a 24mm wide lens close to the subject, giving it presence and scale with the environment stretching away behind it.",
  },
  {
    key: "tele_compress",
    label: "200mm compression",
    prompt:
      "Shot on a 200mm telephoto from a distance, flattening the layers of the scene into stacked planes.",
  },
  {
    key: "flat_lay",
    label: "Flat lay",
    prompt:
      "Shot straight down from directly above, everything arranged flat on the surface, no perspective at all.",
  },
  {
    key: "eye_level",
    label: "Eye level",
    prompt:
      "Camera at the subject's own height, level and square, the neutral honest view.",
  },
  {
    key: "low_hero",
    label: "Low hero angle",
    prompt:
      "Camera below the subject looking up, so it towers in frame against the space above it.",
  },
  {
    key: "high_survey",
    label: "High angle",
    prompt:
      "Camera well above the subject looking down at an angle, taking in the surface around it.",
  },
  {
    key: "tilt_shift",
    label: "Tilt-shift",
    prompt:
      "Shot with a tilt-shift lens, the plane of focus running at an angle through the scene so sharpness cuts across it unexpectedly.",
  },
  {
    key: "dutch_tilt",
    label: "Dutch tilt",
    prompt:
      "The camera rolled a few degrees off level, putting a deliberate diagonal through the whole frame.",
  },
  {
    key: "over_shoulder",
    label: "Over the shoulder",
    prompt:
      "Framed from just behind and beside the point of view, so the subject sits past a soft out-of-focus foreground edge.",
  },
  {
    key: "through_foreground",
    label: "Foreground occlusion",
    prompt:
      "Shot through something in the immediate foreground — a leaf, a glass edge, a doorway — blurred across one part of the frame.",
  },
  {
    key: "extreme_close",
    label: "Extreme close-up",
    prompt:
      "Cropped so tight that only one detail of the subject fills the frame and the whole is inferred rather than shown.",
  },
  {
    key: "wide_environment",
    label: "Wide environmental",
    prompt:
      "The subject small in a large frame, the space around it doing most of the work.",
  },
  {
    key: "product_three_quarter",
    label: "Three-quarter product",
    prompt:
      "The classic catalogue angle: the subject rotated to show its front and one side at once, camera slightly above.",
  },
  {
    key: "straight_on_elevation",
    label: "Straight elevation",
    prompt:
      "Dead-on, perfectly square to the subject, no perspective convergence — an architectural elevation of the thing.",
  },
  {
    key: "long_exposure",
    label: "Long exposure",
    prompt:
      "A long exposure: everything static rendered sharp while anything moving smears into a soft continuous trail.",
  },
  {
    key: "handheld_grab",
    label: "Handheld immediacy",
    prompt:
      "Handheld, slightly imperfect framing, the unposed feel of a photograph taken quickly because the moment was there.",
  },
  {
    key: "shallow_stack",
    label: "Focus-stacked",
    prompt:
      "Focus-stacked so the entire subject is sharp front to back while the background stays soft.",
  },
  {
    key: "mirror_reflection",
    label: "Through a reflection",
    prompt:
      "The subject seen in a mirror or a polished surface, the real thing and its reflection both in frame.",
  },
] as const satisfies readonly CraftMove<string>[];

export type LensKey = (typeof LENSES)[number]["key"];

/* ─────────────────────────── arrangement ─────────────────────────── */

/** How the frame is divided, and where the eye is sent. */
export const COMPOSITIONS = [
  {
    key: "thirds_right",
    label: "Subject right third",
    prompt:
      "The subject on the right third, the left two-thirds left open and quiet.",
  },
  {
    key: "thirds_left",
    label: "Subject left third",
    prompt:
      "The subject on the left third, the right two-thirds left open and quiet.",
  },
  {
    key: "dead_center",
    label: "Dead centre symmetry",
    prompt:
      "Perfect bilateral symmetry, the subject exactly centred, the frame balanced to the millimetre.",
  },
  {
    key: "negative_space_top",
    label: "Air above",
    prompt:
      "The subject low in the frame with a large calm expanse of empty space above it.",
  },
  {
    key: "negative_space_bottom",
    label: "Air below",
    prompt:
      "The subject high in the frame with a large calm expanse of empty space beneath it.",
  },
  {
    key: "diagonal_sweep",
    label: "Diagonal",
    prompt:
      "A strong diagonal running corner to corner, everything in frame aligned to it.",
  },
  {
    key: "frame_within_frame",
    label: "Frame within a frame",
    prompt:
      "The subject seen through an opening in the scene — an arch, a window, a gap — that frames it a second time.",
  },
  {
    key: "leading_lines",
    label: "Leading lines",
    prompt:
      "Converging lines in the scene driving the eye directly to the subject.",
  },
  {
    key: "grid_repetition",
    label: "Repetition grid",
    prompt:
      "The same element repeated on a strict grid, with one deliberate break in the pattern.",
  },
  {
    key: "stacked_bands",
    label: "Horizontal bands",
    prompt:
      "The frame divided into clean horizontal bands, the subject sitting on the line between two of them.",
  },
  {
    key: "rule_of_odds",
    label: "Three subjects",
    prompt:
      "Three elements arranged at unequal heights and distances, the eye moving between them in a triangle.",
  },
  {
    key: "extreme_scale",
    label: "Scale contrast",
    prompt:
      "One element rendered far larger than everything around it, so the size difference is the point.",
  },
  {
    key: "corner_weight",
    label: "Corner anchor",
    prompt:
      "Everything weighted into one corner, the opposite diagonal left almost entirely empty.",
  },
  {
    key: "overlap_layers",
    label: "Layered depth",
    prompt:
      "Three clear depth layers — something near, the subject, something far — overlapping to build depth.",
  },
  {
    key: "horizon_low",
    label: "Low horizon",
    prompt:
      "The horizon dropped near the bottom of the frame, the space above it dominating.",
  },
  {
    key: "tight_crop_edge",
    label: "Cropped at the edge",
    prompt:
      "The subject deliberately cropped by the frame edge, so the picture reads as a detail of something larger.",
  },
] as const satisfies readonly CraftMove<string>[];

export type CompositionKey = (typeof COMPOSITIONS)[number]["key"];

/* ─────────────────────────── ground ─────────────────────────── */

/** What the subject sits on, stands in, or is set against. */
export const SURFACES = [
  {
    key: "seamless_paper",
    label: "Seamless paper",
    prompt: "A seamless studio paper sweep, flawless and edgeless.",
  },
  {
    key: "wet_black_marble",
    label: "Wet black marble",
    prompt:
      "Polished black marble with a thin film of water on it, catching a mirror reflection of the subject.",
  },
  {
    key: "raw_concrete",
    label: "Raw concrete",
    prompt: "Raw poured concrete, cool grey, faintly pitted and honest.",
  },
  {
    key: "brushed_steel",
    label: "Brushed steel",
    prompt:
      "Brushed stainless steel with fine directional grain and a soft anisotropic sheen.",
  },
  {
    key: "linen_drape",
    label: "Draped linen",
    prompt:
      "Heavy natural linen falling in soft irregular folds, warm and slightly textured.",
  },
  {
    key: "travertine",
    label: "Travertine stone",
    prompt: "Pale travertine with its natural pitting and warm mineral tone.",
  },
  {
    key: "sand_ripples",
    label: "Rippled sand",
    prompt: "Fine sand raked by wind into shallow parallel ripples.",
  },
  {
    key: "still_water",
    label: "Still water",
    prompt:
      "A shallow sheet of perfectly still water, doubling whatever sits above it in a flawless reflection.",
  },
  {
    key: "moss_forest_floor",
    label: "Moss floor",
    prompt: "Dense damp moss and leaf litter on a shaded forest floor.",
  },
  {
    key: "aged_wood",
    label: "Aged wood",
    prompt: "Old oak with visible grain, small dents and a waxed patina.",
  },
  {
    key: "colored_acrylic",
    label: "Coloured acrylic",
    prompt:
      "A glossy acrylic plinth in a saturated colour, throwing a crisp reflection beneath the subject.",
  },
  {
    key: "crumpled_foil",
    label: "Crumpled foil",
    prompt:
      "Crushed metallic foil scattering hundreds of small hard highlights.",
  },
  {
    key: "velvet_deep",
    label: "Deep velvet",
    prompt:
      "Deep-pile velvet swallowing the light, rich and shadowed with a soft nap sheen.",
  },
  {
    key: "cracked_earth",
    label: "Cracked earth",
    prompt: "Sun-baked earth split into a web of dry polygonal cracks.",
  },
  {
    key: "terrazzo",
    label: "Terrazzo",
    prompt:
      "Pale terrazzo scattered with fine chips of colour, matte and even.",
  },
  {
    key: "frosted_glass",
    label: "Frosted glass",
    prompt:
      "A frosted glass plane, softly translucent, glowing where light passes through it.",
  },
  {
    key: "studio_infinity",
    label: "Infinite room",
    prompt:
      "A softly lit infinite space with no visible horizon, floor and wall merging seamlessly.",
  },
  {
    key: "gallery_wall",
    label: "Gallery wall",
    prompt: "A clean white gallery wall with a faint shadow gradient across it.",
  },
  {
    key: "city_asphalt_night",
    label: "Wet asphalt",
    prompt:
      "Wet city asphalt at night, streaked with the reflections of lights it cannot show.",
  },
  {
    key: "kraft_paper",
    label: "Kraft paper",
    prompt: "Warm kraft paper, matte and faintly fibrous.",
  },
  {
    key: "marble_white",
    label: "White marble",
    prompt: "White marble with fine grey veining, honed rather than polished.",
  },
  {
    key: "rice_paper",
    label: "Rice paper",
    prompt:
      "Translucent rice paper with visible fibres, lit from behind so the fibres show.",
  },
  {
    key: "brutalist_interior",
    label: "Brutalist interior",
    prompt:
      "A brutalist interior of board-formed concrete planes and hard shadow.",
  },
  {
    key: "greenhouse_glass",
    label: "Greenhouse",
    prompt:
      "Inside a glasshouse: condensation on the panes, plants pressing in at the edges, humid diffused light.",
  },
] as const satisfies readonly CraftMove<string>[];

export type SurfaceKey = (typeof SURFACES)[number]["key"];

/* ─────────────────────────── grade ─────────────────────────── */

/** How the finished image is developed. The last five percent that reads as expensive. */
export const FINISHES = [
  {
    key: "portra_warm",
    label: "Warm negative film",
    prompt:
      "Graded like warm colour negative film: creamy highlights, gentle contrast, skin and neutrals leaning warm.",
  },
  {
    key: "ektachrome_cool",
    label: "Cool slide film",
    prompt:
      "Graded like cool slide film: punchy saturation, clean blues, deep contained shadows.",
  },
  {
    key: "clean_commercial",
    label: "Clean commercial",
    prompt:
      "Neutral, accurate colour and clean contrast — nothing stylised, everything true.",
  },
  {
    key: "matte_lifted",
    label: "Lifted matte",
    prompt:
      "A lifted matte grade: blacks raised slightly, contrast softened, a faint milky veil over the shadows.",
  },
  {
    key: "high_contrast_bw",
    label: "High-contrast black and white",
    prompt:
      "Monochrome with deep blacks, bright whites and very little in between.",
  },
  {
    key: "soft_bw",
    label: "Soft black and white",
    prompt:
      "Monochrome with a long gentle tonal range, silver-print greys, nothing crushed.",
  },
  {
    key: "teal_orange",
    label: "Cinematic teal and orange",
    prompt:
      "Cinematic grade: shadows pushed cool and teal, highlights and subject warm.",
  },
  {
    key: "bleach_bypass",
    label: "Bleach bypass",
    prompt:
      "Bleach-bypass look: desaturated, high contrast, a metallic silver quality across the whole image.",
  },
  {
    key: "cross_process",
    label: "Cross-processed",
    prompt:
      "Cross-processed: shifted colour, cyan shadows, blown yellow-green highlights.",
  },
  {
    key: "duotone_flat",
    label: "Duotone",
    prompt:
      "Reduced to two colours across the entire tonal range — one for the shadows, one for the highlights.",
  },
  {
    key: "pastel_wash",
    label: "Pastel wash",
    prompt:
      "Desaturated pastel grade, low contrast, everything a half-tone softer than life.",
  },
  {
    key: "saturated_pop",
    label: "Saturated pop",
    prompt:
      "Fully saturated, high-clarity, poster-bright colour with hard clean edges.",
  },
  {
    key: "film_grain_35",
    label: "35mm grain",
    prompt:
      "Fine 35mm grain across the whole frame, with the very slight softness of a real negative.",
  },
  {
    key: "medium_format_clarity",
    label: "Medium-format clarity",
    prompt:
      "Medium-format sharpness and tonality: enormous detail, smooth gradation, no grain.",
  },
  {
    key: "risograph",
    label: "Risograph",
    prompt:
      "Risograph printing: two or three flat spot inks, visible misregistration, coarse halftone texture.",
  },
  {
    key: "screenprint_flat",
    label: "Screen-printed",
    prompt:
      "Flat screen-printed areas of solid colour with slightly imperfect edges and no gradients.",
  },
  {
    key: "chrome_render",
    label: "Chrome render",
    prompt:
      "Rendered rather than photographed: perfect reflections, ray-traced highlights, soft global illumination.",
  },
  {
    key: "clay_render",
    label: "Matte clay render",
    prompt:
      "Matte untextured clay render: form and light only, no material detail at all.",
  },
  {
    key: "halation_bloom",
    label: "Halation",
    prompt:
      "Warm halation blooming softly around every bright highlight, the way light spills on film.",
  },
  {
    key: "print_texture",
    label: "Printed paper",
    prompt:
      "The image sitting on stock: faint paper tooth and the slight ink absorption of a good press.",
  },
] as const satisfies readonly CraftMove<string>[];

export type FinishKey = (typeof FINISHES)[number]["key"];

/* ─────────────────────────── argument ─────────────────────────── */

/**
 * What the copy is actually arguing.
 *
 * The only axis that never reaches the image model. It shapes the headline the
 * director writes, and it is here rather than in the director's own prompt
 * because "write a good headline" is not an instruction — "write the headline
 * that names the objection and answers it" is.
 */
export const COPY_ANGLES = [
  {
    key: "benefit_led",
    label: "Benefit",
    prompt: "Lead with what the buyer gets, in their words, not what the thing has.",
  },
  {
    key: "problem_agitate",
    label: "Problem first",
    prompt:
      "Name the frustration the buyer already feels, then imply the relief without explaining it.",
  },
  {
    key: "curiosity_gap",
    label: "Curiosity gap",
    prompt:
      "Say enough to open a question and stop. The picture answers half of it and the buyer wants the rest.",
  },
  {
    key: "single_spec",
    label: "One specification",
    prompt:
      "Stake everything on one concrete, verifiable number or material the brand actually owns.",
  },
  {
    key: "contrarian",
    label: "Contrarian",
    prompt:
      "Contradict what the category always says, then let the product be the reason you can.",
  },
  {
    key: "social_proof",
    label: "Social proof",
    prompt:
      "Let other buyers carry the claim — a count, a verdict, a quoted line — never the brand asserting it itself.",
  },
  {
    key: "scarcity",
    label: "Scarcity",
    prompt:
      "A limit that is real: a run, a season, a stock. Never invent one.",
  },
  {
    key: "founder_voice",
    label: "Founder voice",
    prompt:
      "First person, plainly stated, the tone of the person who made the thing rather than the company that sells it.",
  },
  {
    key: "before_after",
    label: "Before and after",
    prompt: "Two states implied in one line: how it was, how it is now.",
  },
  {
    key: "ritual",
    label: "Ritual",
    prompt:
      "Place the product inside a repeated moment in the buyer's day, so it belongs to a habit rather than a purchase.",
  },
  {
    key: "provenance",
    label: "Provenance",
    prompt:
      "Where it comes from, who made it, what it is made of. Origin as the argument.",
  },
  {
    key: "craft_obsession",
    label: "Obsessive craft",
    prompt:
      "One small detail nobody would notice, taken absurdly seriously. The detail proves the whole.",
  },
  {
    key: "category_definition",
    label: "Category claim",
    prompt:
      "State plainly what this is, as though the category is new and this defines it.",
  },
  {
    key: "objection_handle",
    label: "Objection",
    prompt:
      "Name the reason the buyer would not buy, and answer it in the same breath.",
  },
  {
    key: "aspiration",
    label: "Aspiration",
    prompt:
      "Describe who the buyer becomes, not what the product does. Never overclaim it.",
  },
  {
    key: "understatement",
    label: "Understatement",
    prompt:
      "Say much less than the product deserves. Confidence reads as restraint.",
  },
  {
    key: "direct_command",
    label: "Imperative",
    prompt: "One verb, aimed at the buyer. Short enough to be read at a glance.",
  },
  {
    key: "question",
    label: "Question",
    prompt:
      "A question the buyer answers in their head before they finish reading it.",
  },
  {
    key: "juxtaposition",
    label: "Juxtaposition",
    prompt:
      "Two words that do not belong together, made to belong by the product.",
  },
  {
    key: "seasonal_moment",
    label: "Occasion",
    prompt:
      "Tie the line to the moment it is being read in — the season, the holiday, the deadline.",
  },
  {
    key: "value_math",
    label: "The arithmetic",
    prompt:
      "Make the value obvious as a sum the buyer does themselves. Only where the real numbers support it.",
  },
  {
    key: "insider",
    label: "Insider",
    prompt:
      "Written as though to someone who already knows the category. Assumes fluency; rewards it.",
  },
  {
    key: "origin_story",
    label: "Why it exists",
    prompt:
      "The reason this was made at all, stated in one line, as a fact rather than a legend.",
  },
  {
    key: "plain_speech",
    label: "Plain speech",
    prompt:
      "No adjectives, no adverbs, no craft. Say the thing. The picture does the rest.",
  },
] as const satisfies readonly CraftMove<string>[];

export type CopyAngleKey = (typeof COPY_ANGLES)[number]["key"];

/* ─────────────────────────── lookup ─────────────────────────── */

const index = <K extends string>(moves: readonly CraftMove<K>[]) =>
  new Map(moves.map((move) => [move.key as string, move]));

const INDEXES = {
  lighting: index(LIGHTING),
  lens: index(LENSES),
  composition: index(COMPOSITIONS),
  surface: index(SURFACES),
  finish: index(FINISHES),
  copyAngle: index(COPY_ANGLES),
} as const;

export type CraftAxis = keyof typeof INDEXES;

/** The move on this axis, or undefined for a key no catalogue holds. */
export function craftMove(
  axis: CraftAxis,
  key: string | null | undefined,
): CraftMove<string> | undefined {
  return key ? INDEXES[axis].get(key) : undefined;
}

/** Every key on one axis, as a tuple `z.enum` can take. */
const keysOf = <K extends string>(moves: readonly CraftMove<K>[]) =>
  moves.map(({ key }) => key) as [K, ...K[]];

export const LIGHTING_KEYS = keysOf(LIGHTING);
export const LENS_KEYS = keysOf(LENSES);
export const COMPOSITION_KEYS = keysOf(COMPOSITIONS);
export const SURFACE_KEYS = keysOf(SURFACES);
export const FINISH_KEYS = keysOf(FINISHES);
export const COPY_ANGLE_KEYS = keysOf(COPY_ANGLES);

/**
 * One axis as the director reads it: key and label only.
 *
 * The prose stays here rather than travelling in the director's prompt. A
 * hundred and thirty-two sentences is a prompt nobody can afford on every
 * compose, and the director does not need them — it needs to know what its
 * options are called. The sentence is spliced in later, by the code that builds
 * the image prompt.
 */
export function craftMenu(moves: readonly CraftMove<string>[]): string {
  return moves.map(({ key, label }) => `${key} (${label})`).join(", ");
}

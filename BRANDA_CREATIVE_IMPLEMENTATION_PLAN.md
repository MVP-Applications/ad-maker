# Branda Creative Studio Implementation Plan

## Purpose

Extend the existing Branda project from a brand/product extractor into a prompt-driven creative studio.

The system must let a user:

1. Extract a brand and product catalogue from a website.
2. Select a specific product.
3. Enter a custom creative request inline.
4. Select reusable format, visual-style and scene templates.
5. Generate several structured ad concepts.
6. Edit the generated prompts before image generation.
7. Generate multiple images using the existing image tools.
8. Select a generated image as a product, style, composition or person reference.
9. Generate improved variations while preserving the product and brand.
10. Evaluate the result for product fidelity, brand consistency and instruction following.

Do not rebuild the extractor. Keep the extraction layer stable and add a separate `creative` domain.

---

## Source repositories

Use these repositories as references and selectively reuse their concepts. Do not copy an entire repository into Branda.

### 1. Creatify static ad concept generator

Repository:

```text
https://github.com/Creatify-AI/static-ad-concept-generator
```

Use it for:

- Ad angles.
- Headline formulas.
- Audience and objective thinking.
- Platform-specific concept structure.
- Visual directions.
- Generating several concepts before image generation.

Important: this is a Claude skill and concept-generation framework. It is not a ready-made Branda YAML template database.

### 2. Creatify AI ad prompt guide

Repository:

```text
https://github.com/Creatify-AI/ai-ad-prompt-guide
```

Use it for:

- Detailed image prompts.
- Product-shot prompting.
- Lifestyle and UGC prompting.
- Lighting and camera instructions.
- Negative prompts.
- Model-specific prompt construction.
- Image-generation quality checks.

Important: do not introduce a mandatory Creatify API dependency. Branda must be able to call the existing image-generation provider.

### 3. Creatify video ad generator

Repository:

```text
https://github.com/Creatify-AI/video-ad-generator
```

Do not implement during the initial MVP. Examine it later when static image generation is stable and reuse its creative planning concepts for video.

### 4. AWS marketing campaign blueprint

Repository:

```text
https://github.com/aws-samples/generative-ai-ml-latam-samples/tree/main/blueprints/genai-marketing-campaigns
```

Use it as a workflow and UX reference for:

- Campaign briefs.
- Image retrieval.
- Selecting previous images as references.
- Generating editable prompts.
- Generating multiple campaign images.

Do not copy the AWS infrastructure into the first Branda implementation. Avoid making Bedrock, Nova, Lambda or OpenSearch mandatory.

### 5. ComfyUI reference sampling

Repository:

```text
https://github.com/logtd/ComfyUI-RefSampling
```

Use it as a technical reference for future reference-image workflows:

- Product image as content reference.
- Existing generated image as style reference.
- Combining product and style references.

Treat it as a proof of concept, not a guaranteed production dependency.

### 6. Creative advertising reference

Repository:

```text
https://github.com/yasikvlad/creative-ads
```

Use it for ideas about:

- Static ad units.
- Video and Reel structures.
- Platform rules.
- A/B creative variations.
- Audience-awareness stages.
- Creative strategy.

Do not copy its whole workflow without adapting it to Branda's verified brand and product data.

### 7. Product photography prompt reference

Repository:

```text
https://github.com/cliprise/awesome-ai-product-photography-prompts
```

Use it for ideas about:

- Product fidelity.
- Composition.
- Lighting.
- Environment.
- Product photography scenes.
- Image-to-video source frames.

---

## Core product principle

Templates are not final prompts.

A template is a reusable set of advertising rules. Branda combines:

```text
Brand context
+ selected product
+ user request
+ format template
+ style template
+ scene template
= concept brief and final image prompt
```

Example:

```text
Format: Pinterest Product Pin
Style: Premium Minimal
Scene: Person Using Product
Product: Leather Travel Bag
User request: Show it with a man walking through an airport
```

The prompt planner must turn this into a complete, editable image prompt.

---

## Target architecture

```text
URL
  |
  v
Existing Branda extractor
  |
  v
BrandContext JSON
  |
  v
Creative Studio UI
  |
  +-- Select product
  +-- Select product image
  +-- Choose platform and format
  +-- Choose style
  +-- Choose scene
  +-- Enter custom prompt
  +-- Select number of variants
  |
  v
Creative concept planner
  |
  +-- Select ad angle
  +-- Generate concepts
  +-- Generate detailed prompts
  +-- Validate constraints
  |
  v
Existing image-generation adapter
  |
  v
Image gallery
  |
  +-- Favourite image
  +-- Use as product reference
  +-- Use as style reference
  +-- Edit image
  +-- Generate variations
  |
  v
Creative evaluator
```

---

## Required directory structure

Create this structure without breaking existing Branda paths:

```text
branda/
├── backend/
│   ├── brand_extractor/
│   ├── creative/
│   │   ├── __init__.py
│   │   ├── schemas.py
│   │   ├── loaders.py
│   │   ├── prompt_planner.py
│   │   ├── concept_generator.py
│   │   ├── image_orchestrator.py
│   │   ├── reference_manager.py
│   │   ├── evaluator.py
│   │   ├── errors.py
│   │   ├── providers/
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── existing_provider.py
│   │   │   └── mock_provider.py
│   │   └── templates/
│   │       ├── formats/
│   │       ├── styles/
│   │       └── scenes/
│   └── api/
├── frontend/
│   └── creative-studio/
├── data/
│   └── brands/
├── .claude/
│   └── skills/
├── tests/
│   ├── creative/
│   └── fixtures/
└── docs/
```

If the existing project uses a different structure, preserve its conventions and place the same logical modules in the nearest equivalent locations.

---

## Install Claude skills for development

Install the two most important skills into the project:

```bash
mkdir -p .claude/skills

git clone \\
  https://github.com/Creatify-AI/static-ad-concept-generator.git \\
  .claude/skills/static-ad-concept-generator

git clone \\
  https://github.com/Creatify-AI/ai-ad-prompt-guide.git \\
  .claude/skills/ai-ad-prompt-guide
```

Do not install the video skill until the static-image workflow passes all MVP tests.

If a repository already exists, fetch updates instead of cloning over it:

```bash
git -C .claude/skills/static-ad-concept-generator pull
```

Do not copy the source skill files into application runtime code. Use them as developer/agent guidance and translate the relevant rules into deterministic Branda templates and prompts.

---

## Step 1: Freeze the BrandContext contract

Before implementing creative generation, inspect the existing extractor and create an adapter that produces one normalized object.

Create or adapt:

```python
# backend/creative/schemas.py
from typing import Optional
from pydantic import BaseModel, Field

class Evidence(BaseModel):
    source: str
    confidence: float = Field(ge=0.0, le=1.0)

class Product(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    image_urls: list[str] = []
    product_url: Optional[str] = None
    evidence: dict[str, Evidence] = {}

class BrandProfile(BaseModel):
    name: str
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    colors: list[str] = []
    fonts: list[str] = []
    tone: list[str] = []
    languages: list[str] = []
    country: Optional[str] = None

class BrandContext(BaseModel):
    brand: BrandProfile
    products: list[Product]
    social_images: list[str] = []
    social_captions: list[str] = []
```

Save normalized data as:

```text
data/brands/{brand_id}/brand_context.json
```

Rules:

- Never invent a product.
- Never invent a price.
- Only use a price when it exists and passes the confidence threshold.
- Never invent product benefits.
- Preserve source and confidence metadata.
- Keep the raw extraction output available for debugging.

---

## Step 2: Create the template system

Do not create one giant template for every combination. Use three independent template categories.

```text
formats/  = where and how the ad appears
styles/   = visual treatment and mood
scenes/   = what is happening in the image
```

The user can combine one template from each category.

### Initial format template

Create:

```text
backend/creative/templates/formats/pinterest_product_pin.yaml
```

Contents:

```yaml
id: pinterest_product_pin
name: Pinterest Product Pin
category: format
platforms:
  - pinterest

output:
  aspect_ratio: "2:3"
  default_variants: 3
  max_variants: 5
  render_text_inside_image: false

layout:
  product_visibility: dominant
  product_position: center_or_lower_center
  text_safe_area: upper_right
  thumbnail_priority: high
  background: lifestyle_or_clean_studio

prompt_rules:
  - Use a vertical composition suitable for Pinterest.
  - Make the product recognisable in the first visual scan.
  - Use the supplied product image as the product reference.
  - Preserve product shape, packaging, colour and logo.
  - Use the extracted brand palette.
  - Leave optional negative space for later copy.
  - Avoid dense text inside the generated image.

copy_rules:
  headline_max_words: 8
  cta_allowed: true
  price_allowed: true
  price_requires_confidence: 0.90

negative_prompt:
  - distorted product
  - changed packaging
  - fake logo
  - unreadable text
  - extra products
  - misleading product claims
```

### Initial style template

Create:

```text
backend/creative/templates/styles/premium_minimal.yaml
```

Contents:

```yaml
id: premium_minimal
name: Premium Minimal
category: style
platforms:
  - instagram
  - pinterest
  - display

visual_rules:
  - Use generous whitespace.
  - Use the extracted brand colour palette.
  - Use one dominant product.
  - Use controlled, intentional lighting.
  - Use minimal props.
  - Use a clean composition.
  - Use short, confident copy when copy is requested.
  - Do not add random decorative elements.
  - Do not add generic gradients unless the brand uses them.

lighting:
  preferred:
    - soft directional light
    - controlled studio light
    - subtle natural shadow

composition:
  props: minimal
  focal_points: 1
  clutter: prohibited
```

### Initial scene template

Create:

```text
backend/creative/templates/scenes/person_using_product.yaml
```

Contents:

```yaml
id: person_using_product
name: Person Using Product
category: scene
platforms:
  - instagram
  - pinterest
  - tiktok

scene_rules:
  - Use a realistic person.
  - Keep the product as the visual subject.
  - Make the hands and product interaction clearly visible.
  - Preserve product shape, colour and packaging.
  - Make the interaction physically natural.
  - Do not invent product usage claims.
  - Do not add a second product unless explicitly requested.

person_rules:
  preserve_product_visibility: true
  avoid_obstructing_product: true
  realism_required: true
```

Do not add the Arabic template until the English pipeline works. Later create an Arabic-specific template for RTL layout, Arabic-safe fonts, currency formatting, localized CTA wording and culturally appropriate scenes.

---

## Step 3: Implement template loading

Create:

```python
# backend/creative/loaders.py
from pathlib import Path
import yaml

TEMPLATE_ROOT = Path(__file__).parent / "templates"


def load_template(category: str, template_id: str) -> dict:
    path = TEMPLATE_ROOT / category / f"{template_id}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Unknown template: {category}/{template_id}")

    with path.open("r", encoding="utf-8") as file:
        template = yaml.safe_load(file)

    if template.get("id") != template_id:
        raise ValueError(f"Template id mismatch: {path}")

    return template
```

Add validation:

```python
def validate_template_selection(
    format_template: dict,
    style_template: dict,
    scene_template: dict,
    platform: str,
) -> None:
    for template in [format_template, style_template, scene_template]:
        platforms = template.get("platforms", [])
        if platforms and platform not in platforms:
            raise ValueError(
                f"Template {template['id']} does not support {platform}"
            )
```

---

## Step 4: Build the Creative Brief schema

Create structured input for the user's request:

```python
class CreativeBrief(BaseModel):
    brand_id: str
    product_id: str
    platform: str
    format_template_id: str
    style_template_id: str | None = None
    scene_template_id: str | None = None
    objective: str = "product_discovery"
    user_instruction: str = ""
    number_of_variants: int = Field(default=3, ge=1, le=5)
    language: str = "en"
    product_reference_asset_id: str | None = None
    style_reference_asset_id: str | None = None
```

The frontend must provide:

```text
Product selector
Platform selector
Format selector
Style selector
Scene selector
Objective selector
Custom instruction textarea
Number of variants
Product-reference checkbox
Optional style-reference image
```

The custom instruction is mandatory for the first test but may be empty later if the user wants template-only generation.

---

## Step 5: Implement concept generation

Create:

```text
POST /api/creative/concepts
```

Input:

```json
{
  "brand_id": "brand-123",
  "product_id": "product-456",
  "platform": "pinterest",
  "format_template_id": "pinterest_product_pin",
  "style_template_id": "premium_minimal",
  "scene_template_id": "person_using_product",
  "objective": "product_launch",
  "user_instruction": "Show it with a man walking through an airport",
  "number_of_variants": 3,
  "language": "en",
  "product_reference_asset_id": "asset-product-456"
}
```

Pipeline:

```text
1. Load BrandContext.
2. Find the selected product.
3. Load format template.
4. Load style template.
5. Load scene template.
6. Validate platform compatibility.
7. Build a structured planner input.
8. Generate five concepts internally.
9. Return the best three concepts to the UI.
```

Do not generate images in this endpoint.

Expected response:

```json
{
  "creative_set_id": "set-001",
  "concepts": [
    {
      "id": "concept-001",
      "name": "Golden-hour airport journey",
      "angle": "Lifestyle aspiration",
      "audience": "Frequent travellers who value premium accessories",
      "headline": "Travel beautifully",
      "visual_direction": "A man walking through a modern airport...",
      "image_prompt": "...",
      "negative_prompt": "...",
      "recommended_aspect_ratio": "2:3",
      "copy_area": "upper_right",
      "constraints": [
        "preserve product geometry",
        "preserve logo",
        "preserve product colour"
      ]
    }
  ]
}
```

Use the Creatify static-ad-concept-generator as inspiration for angles, concepts, headlines, visual direction, audience and platform treatment. Use the ai-ad-prompt-guide for detailed image-prompt construction.

The generated prompt must be visible and editable in the frontend.

---

## Step 6: Implement image generation adapters

Create a provider interface:

```python
class ImageGenerator:
    async def generate(
        self,
        prompt: str,
        negative_prompt: str | None,
        references: list[dict],
        width: int,
        height: int,
        count: int,
    ) -> list[dict]:
        raise NotImplementedError
```

Implement:

```text
existing_provider.py = adapter for the current image tool
mock_provider.py     = deterministic provider for tests
```

Do not integrate multiple external providers in the first MVP.

Create:

```text
POST /api/creative/generate
```

Input:

```json
{
  "concept_id": "concept-001",
  "prompt": "edited prompt from the user",
  "negative_prompt": "edited negative prompt",
  "number_of_images": 3,
  "references": [
    {
      "asset_id": "asset-product-456",
      "role": "product"
    }
  ]
}
```

The endpoint must:

1. Load the concept.
2. Accept the user's edited prompt.
3. Validate product constraints.
4. Resolve reference assets.
5. Calculate dimensions from the selected format template.
6. Call the current image provider.
7. Persist every generation and its metadata.
8. Return the generated assets.

---

## Step 7: Persist creative assets

For every generated image, save:

```json
{
  "asset_id": "generated-789",
  "creative_set_id": "set-001",
  "concept_id": "concept-001",
  "brand_id": "brand-123",
  "product_id": "product-456",
  "image_url": "...",
  "prompt": "...",
  "negative_prompt": "...",
  "format_template_id": "pinterest_product_pin",
  "style_template_id": "premium_minimal",
  "scene_template_id": "person_using_product",
  "references": [
    {
      "asset_id": "asset-product-456",
      "role": "product"
    }
  ],
  "provider": "existing_provider",
  "model": "model-name",
  "parameters": {},
  "is_favourite": false,
  "created_at": "..."
}
```

The prompt, references, model and template IDs must always be stored. This makes every output reproducible and debuggable.

---

## Step 8: Implement the reference loop

After an image is generated, show these actions:

```text
Use as product reference
Use as style reference
Use as composition reference
Edit and regenerate
Favourite
Download
```

Create:

```text
POST /api/creative/variations
```

Input:

```json
{
  "product_reference_asset_id": "asset-product-456",
  "style_reference_asset_id": "generated-789",
  "composition_reference_asset_id": null,
  "instruction": "Keep the product unchanged but replace the airport with a modern indoor setting.",
  "preserve": [
    "product geometry",
    "logo",
    "packaging",
    "product colours"
  ],
  "number_of_images": 3
}
```

Use ComfyUI-RefSampling as a technical reference for content/style reference conditioning. Do not make it mandatory for the first provider. If the current image provider cannot support references, keep the API contract and implement provider-specific fallbacks.

---

## Step 9: Add creative evaluation

Create an evaluator that returns scores and warnings:

```json
{
  "brand_consistency": 0.91,
  "product_fidelity": 0.88,
  "instruction_following": 0.94,
  "composition_quality": 0.86,
  "text_quality": 0.72,
  "warnings": [
    "The product logo may be distorted",
    "Generated image contains unreadable text"
  ],
  "approved": false
}
```

Check:

- Product shape.
- Product colour.
- Packaging.
- Logo.
- Brand palette.
- User instruction.
- Aspect ratio.
- Unwanted extra objects.
- Unsupported product claims.
- Text errors.
- Arabic rendering when applicable.

Do not automatically publish an image with a failed critical check.

---

## Important text-rendering rule

Do not generate important text inside the image model output.

The image model should create the visual scene. Branda should render the following separately using HTML, SVG, Canvas or another deterministic renderer:

- Product name.
- Price.
- Currency.
- CTA.
- Promotional text.
- Arabic text.
- Logo overlay when necessary.

This avoids distorted prices, unreadable CTAs and broken Arabic text.

---

## Initial templates

Create only these three templates first:

```text
formats/pinterest_product_pin.yaml
styles/premium_minimal.yaml
scenes/person_using_product.yaml
```

Do not create all possible platform/style combinations. Templates should be composable.

Later add:

```text
formats/instagram_product_hero.yaml
formats/instagram_carousel.yaml
formats/tiktok_cover.yaml
styles/luxury_editorial.yaml
styles/colourful_lifestyle.yaml
styles/dark_technology.yaml
scenes/product_hero.yaml
scenes/flat_lay.yaml
scenes/ugc_testimonial.yaml
scenes/unboxing.yaml
scenes/person_using_product.yaml
```

Only add the Arabic template after the English pipeline is stable:

```text
styles/arabic_gulf_commerce.yaml
```

It should define RTL layout, Arabic-safe fonts, Saudi/UAE currency formatting, localized CTA conventions and culturally appropriate scene rules.

---

## UI acceptance flow

The first working demo must support this exact flow:

1. Paste a shop URL.
2. Wait for brand and product extraction.
3. Select a real product.
4. Select the product's image as the product reference.
5. Choose `Pinterest Product Pin`.
6. Choose `Premium Minimal`.
7. Choose `Person Using Product`.
8. Type: `Show it with a man walking through an airport.`
9. Choose three variants.
10. Click `Generate Concepts`.
11. Display at least three concept cards.
12. Display the generated prompt for every concept.
13. Allow the user to edit a prompt.
14. Click `Generate Images`.
15. Display three images.
16. Favourite one image.
17. Use the favourite image as a style reference.
18. Change the instruction to: `Keep the product unchanged but use a modern indoor setting.`
19. Generate three variations.
20. Display evaluation scores and warnings.

This flow is the MVP definition of done.

---

## Tests to implement

### Template tests

- Load every template successfully.
- Reject unknown template IDs.
- Reject incompatible platform/template combinations.
- Verify that each template has an ID, name, category and rules.
- Verify aspect ratios for format templates.

### Product safety tests

- A missing product must fail generation.
- A missing product image must produce a clear warning.
- An unverified price must not appear in generated copy.
- Product names must come from BrandContext.
- Product claims must come from verified product data.

### Prompt tests

- The final prompt includes the selected product name.
- The final prompt includes the selected template rules.
- The final prompt includes product-preservation constraints.
- The final prompt includes the user's custom instruction.
- The negative prompt includes product-distortion warnings.

### Reference tests

- A product reference is stored with the generation.
- A style reference is stored with the generation.
- A selected image can be reused in a later generation.
- Reference roles remain distinguishable.

### API tests

- `POST /api/creative/concepts` returns concepts without generating images.
- `POST /api/creative/generate` creates and persists image assets.
- `POST /api/creative/variations` uses references correctly.
- Provider errors return useful messages.
- Generation requests are idempotent or have a request ID.

---

## Implementation order

Follow this order exactly:

### Milestone 1: Data contract

- Inspect the existing extractor.
- Produce normalized `BrandContext` JSON.
- Add schema validation.
- Add fixture data for one English ecommerce brand.

### Milestone 2: Template loading

- Add the three initial YAML templates.
- Add the template loader.
- Add template validation.
- Add unit tests.

### Milestone 3: Creative brief UI

- Add product selector.
- Add format/style/scene selectors.
- Add custom prompt textarea.
- Add number-of-variants control.
- Add reference-image selection.

### Milestone 4: Concept generation

- Implement `/api/creative/concepts`.
- Integrate concept-generation rules from Creatify.
- Return three to five editable concepts.
- Do not generate images yet.

### Milestone 5: Static image generation

- Implement the current image provider adapter.
- Implement `/api/creative/generate`.
- Persist image metadata.
- Add gallery and favourite actions.

### Milestone 6: Reference iteration

- Implement product references.
- Implement style references.
- Implement `/api/creative/variations`.
- Add ComfyUI/reference-provider support only if necessary.

### Milestone 7: Evaluation

- Add brand/product/instruction checks.
- Show scores and warnings.
- Block or flag failed critical checks.

### Milestone 8: Additional templates

- Add Instagram feed.
- Add Instagram Story.
- Add carousel.
- Add luxury editorial.
- Add UGC testimonial.
- Add Arabic Gulf commerce.

### Milestone 9: Video

- Install and study the Creatify video-ad-generator skill.
- Reuse the existing Creative Brief and references.
- Add video generation only after static creative generation is reliable.

---

## What not to do

- Do not rewrite the Branda extractor.
- Do not make all templates giant prompt strings.
- Do not create 100 templates before the first workflow works.
- Do not integrate multiple image providers initially.
- Do not make Creatify API mandatory.
- Do not make AWS Bedrock mandatory.
- Do not generate important prices or Arabic copy inside the image model.
- Do not allow the model to invent product facts.
- Do not hide the final prompt from the user.
- Do not discard generation metadata.
- Do not treat a generated image as a reusable reference unless the user explicitly selects it.

---

## Final expected behaviour

When the user selects a product and writes:

```text
Show it with a man walking through an airport.
```

Branda should:

1. Load the verified product and brand context.
2. Load the selected format, style and scene templates.
3. Generate multiple creative concepts.
4. Show the concepts and prompts to the user.
5. Allow prompt editing.
6. Generate several images.
7. Store prompts, references and model metadata.
8. Allow a selected image to become a new reference.
9. Generate revised variations.
10. Evaluate and display quality warnings.

The first milestone is complete only when this complete loop works end-to-end with one real product and one image-generation provider.

---
name: page-hero-prompt
description: Generate hero images for AEM documentation pages using Adobe Firefly
---

# Page Hero Image Generator

Generate professional hero images (1472×832px, 16:9) for AEM documentation pages using Adobe Firefly's generative AI.

## When to Use This Skill

Invoke this skill when:
- User requests a hero image for a documentation page
- Creating new documentation that needs a visual header
- Updating an existing page's hero image
- User provides a page URL and asks for image generation

## Prerequisites Check

Before starting, verify Firefly credentials:

```bash
node .skills/page-hero-prompt/scripts/generate.mjs --check
```

If credentials are missing, guide the user through setup:
1. They need to get credentials from [Adobe Developer Console](https://developer.adobe.com/console)
2. Create `.cache/.env` with FIREFLY_CLIENT_ID and FIREFLY_CLIENT_SECRET
3. Run check again to verify

See README.md "Quick Start" section for detailed credential setup instructions.

## Workflow

### Step 1: Gather Page Context

When given a page URL, fetch and analyze the content:

1. **Fetch markdown version:**
   ```bash
   curl https://[page-url].md
   ```

2. **Extract key information:**
   - Page title (H1 heading)
   - Overview/introduction (first paragraph)
   - Main sections (H2 headings)
   - Key technical concepts and terms
   - Target audience (developer, author, admin)

3. **Summarize for user:**
   Present what you learned: "I analyzed the page about [topic]. It covers [key concepts] for [audience]."

### Step 2: Identify Visual Themes

Based on content analysis, identify 2-3 visual concepts that represent the page:

**Common themes:**
- **Localization/i18n:** Globes, language symbols, locale indicators, connected networks
- **Performance:** Speed metaphors, optimization flows, efficiency indicators
- **APIs/Development:** Code symbols, connection diagrams, technical flows
- **Authoring:** Content creation, document metaphors, editing workflows
- **Architecture:** System diagrams, component relationships, structural concepts

**Match to style guide** (`references/style-guide.md`):
- Check color palette recommendations for the topic
- Review composition guidelines
- Note any content-specific visual patterns

### Step 3: Propose Visual Concepts

Present 3 distinct design directions to the user:

```
I've identified three visual approaches for this hero image:

**Option A: [Concept Name]**
Visual approach: [1-2 sentences describing the main composition]
Key elements: [List 3-4 specific visual elements]
Color palette: [Primary colors from style guide]
Mood: [Professional, technical, friendly, etc.]

**Option B: [Concept Name]**
Visual approach: [Different compositional approach]
Key elements: [Different set of elements]
Color palette: [Alternative color scheme]
Mood: [Different mood/feeling]

**Option C: [Concept Name]**
Visual approach: [Third distinct approach]
Key elements: [Third set of elements]
Color palette: [Third color option]
Mood: [Third mood]

Which direction would you like to pursue? Or would you like modifications?
```

### Step 4: Craft Firefly Prompt

Once the user selects a direction, create the Firefly prompt using the **two-layer composition pattern**.

**CRITICAL: AEM hero images use a two-layer design:**
1. **Background Layer** - Simple gradient or pattern canvas (ambient atmosphere)
2. **Foreground Layer** - UI mockup/interface that represents the page concept

**Prompt structure**:
```
BACKGROUND: Soft [color1] to [color2] gradient, [optional: subtle grid/pattern overlay],
minimal ambient canvas.

FOREGROUND: Large [color] rounded panel (70-80% width, 55-60% height) centered on canvas.
[Specific UI mockup description that represents page concept - e.g., folder tree diagram,
form interface, code editor window]. Panel floats with strong drop shadow. Modern technical
UI design aesthetic.

Clear layer separation. Professional, technical, approachable mood. Landscape 16:9 format.
No text, no typography, no letters, no words.
```

**Foreground concepts by content type:**
- **Localization:** Folder tree diagram with locale badges, translation UI panel
- **Forms:** Form interface mockup with field types, validation states
- **Performance:** Dashboard with metrics, optimization controls
- **APIs:** Code editor window with API calls, connection diagram
- **Authoring:** Document editor interface, content block builder

**Key requirements:**
- **Foreground size:** Specify "70-80% width, 55-60% height" for proper scale
- **Maximum 1024 characters** (Firefly limit)
- Use exact colors from style guide (#4B6BFB, #8B5CF6, #2C3E50 for dark panels)
- Condensed language - avoid verbose descriptions
- Always end with "No text, no typography, no letters, no words"

**Show prompt to user for approval** before generating.

### Step 5: Generate Images

After prompt approval, run the generation script:

```bash
cd .skills/page-hero-prompt/scripts
node generate.mjs \
  --prompt "your approved prompt here" \
  --folder "[page-name]" \
  --output "[page-name]-hero"
```

Parameters:
- `--prompt`: The crafted Firefly prompt (wrap in quotes)
- `--folder`: Subfolder name in ~/Downloads (e.g., "localize-fragments")
- `--output`: File name prefix (e.g., "localize-fragments-hero")
- `--n`: Number of variations (default: 4)

The script will:
1. Create folder in ~/Downloads/[page-name]/
2. Authenticate with Firefly API (using cached token if available)
3. Submit generation job (16:9 ratio, 2688×1536px)
4. Poll for completion (shows progress)
5. Download all variations as JPG files

Images will be saved as:
- ~/Downloads/[page-name]/[page-name]-hero-1.jpg
- ~/Downloads/[page-name]/[page-name]-hero-2.jpg
- ~/Downloads/[page-name]/[page-name]-hero-3.jpg
- ~/Downloads/[page-name]/[page-name]-hero-4.jpg

**Inform user of progress** as it happens.

### Step 6: Review and Iterate

Once images are generated:

1. **Inform user where files are saved:**
   ```
   Generated 4 variations saved as:
   - hero-[page-slug]-1.jpg
   - hero-[page-slug]-2.jpg
   - hero-[page-slug]-3.jpg
   - hero-[page-slug]-4.jpg
   ```

2. **Ask for feedback:**
   - Does the image reflect the page content?
   - Is the composition suitable for text overlay?
   - Do colors match the documentation aesthetic?
   - Which variation works best?

3. **If refinements needed:**
   - Adjust prompt based on specific feedback
   - Regenerate (same process)
   - Repeat until satisfied

**Common refinements:**
- "Make the background lighter/darker"
- "Add more/less elements"
- "Shift composition left/right"
- "Use different color scheme"
- "More abstract/more concrete"

### Step 7: Finalize and Deliver

Once user approves a variation:

1. **Provide the filename** for the selected image

2. **Suggest next steps:**
   ```
   Selected: hero-[page-slug]-2.jpg

   Next steps:
   1. Rename to: media_[hash].png (or use AEM naming convention)
   2. Place in your page directory
   3. Reference in your content

   The image will be automatically optimized by AEM:
   - Converted to WebP for modern browsers
   - Responsive sizes generated (750px, 2000px)
   - Optimized for performance
   ```

3. **Offer to help with placement** if needed

## Example Session

**User:** "Generate a hero image for https://main--helix-website--adobe.aem.page/drafts/ukhalid/examples/how-to-localize-fragments"

**Assistant:** *Fetches .md version, analyzes content*

"I analyzed the page about localizing fragments in AEM Edge Delivery Services. It covers locale-aware content resolution, URL-based detection, and fallback mechanisms for multi-language sites targeting AEM developers.

I've identified three visual approaches:

**Option A: Global Network**
Visual approach: Stylized translucent globe with orbiting document fragments connected by flowing lines
Key elements: Globe (left of center), floating documents, connection network, geometric language symbols
Color palette: Blue (#4B6BFB) to purple (#8B5CF6) gradient, teal accents (#22D3EE)
Mood: Professional, technical, international

**Option B: Locale Pathways**
Visual approach: Abstract routing diagram showing URL paths branching to different locale destinations
Key elements: Central hub, branching paths, locale markers, document endpoints
Color palette: Teal (#06B6D4) to blue (#4B6BFB), purple highlights (#8B5CF6)
Mood: Technical, systematic, clear

**Option C: Fragment Mosaic**
Visual approach: Modular content blocks arranged in a multilingual pattern suggesting localization
Key elements: Overlapping rounded rectangles, subtle locale indicators, unified composition
Color palette: Purple (#8B5CF6) to pink (#F472B6), blue accents (#6B8AFF)
Mood: Modern, organized, approachable

Which direction appeals to you?"

**User:** "Option A looks good"

**Assistant:** "Great choice. Here's the Firefly prompt using the two-layer approach:

```
BACKGROUND: Soft blue (#4B6BFB) to purple (#8B5CF6) gradient, subtle grid overlay,
minimal ambient canvas.

FOREGROUND: Large dark navy rounded panel (75% width, 58% height) centered, showing
folder tree diagram with locale badges (en_US, fr_FR, de_DE), document icons arranged
hierarchically, teal connection lines (#22D3EE) linking nodes. Panel floats with strong
drop shadow. Modern technical UI design aesthetic.

Clear layer separation. Professional, technical, approachable mood. Landscape 16:9 format.
No text, no typography, no letters, no words.
```

Does this capture what you're looking for? Any adjustments?"

**User:** "Looks good, generate it"

**Assistant:** *Runs generation script*

"Generating images...
Creating folder: ~/Downloads/localize-fragments/
✓ Authenticated (cached token)
Submitting job (4 variations)...
Status: pending...
Status: running...
✓ Done. 4 images saved to ~/Downloads/localize-fragments/

Generated variations:
- localize-fragments-hero-1.jpg
- localize-fragments-hero-2.jpg
- localize-fragments-hero-3.jpg
- localize-fragments-hero-4.jpg

Please review and let me know which one works best or if you'd like any adjustments."

## Technical Notes

### Image Specifications
- **Generated size:** 2688×1536px (16:9-ish ratio, high resolution)
- **Target size:** 1472×832px (automatically handled by AEM)
- **Format:** JPG from Firefly, convert to PNG if needed
- **File size:** Aim for < 500KB before AEM optimization
- **Composition:** Two-layer design (background gradient + foreground UI mockup)

### Firefly API Parameters
- **Content Class:** art (not photo)
- **Aspect Ratio:** 16:9 (landscape)
- **Model:** image4_standard
- **Variations:** 4 (default)

### Credential Storage
- **Location:** `.skills/page-hero-prompt/scripts/.cache/.env`
- **Format:**
  ```
  FIREFLY_CLIENT_ID=your_id_here
  FIREFLY_CLIENT_SECRET=your_secret_here
  ```
- **Security:** `.cache/` is gitignored, never committed

### Token Caching
- Tokens cached in `.cache/token.json`
- Valid for 23 hours (expire at 24)
- Automatic refresh when expired
- Speeds up repeated generations

## Troubleshooting

### "Missing credentials" Error
```bash
node .skills/page-hero-prompt/scripts/generate.mjs --check
```
If fails, guide user to README.md "Quick Start" section for credential setup instructions.

### "401 Unauthorized" Error
- Credentials may be incorrect
- Check Adobe Developer Console for valid Client ID/Secret
- Ensure Firefly API is enabled in project
- Delete `.cache/token.json` and retry

### "Job timed out" Error
- Firefly service may be slow
- Retry the generation
- Try with fewer variations (--n 2)

### Poor Image Quality
- Refine prompt with more specific details
- Adjust color descriptions
- Try different compositional approach
- Reference `references/style-guide.md` for prompt tips

### Images Don't Match Content
- Re-analyze the page content more carefully
- Try a different visual concept option
- Ask user for more specific feedback on what's off
- Iterate on prompt with specific adjustments

## Best Practices

1. **Always analyze content first** - Don't guess at prompts without reading the page
2. **Use two-layer composition** - Background gradient + foreground UI mockup (not single artistic image)
3. **Specify foreground size** - Always include "70-80% width, 55-60% height" for proper scale
4. **Offer multiple options** - Users appreciate choice and may have preferences you didn't anticipate
5. **Be specific in prompts** - Use exact hex colors, precise positioning, clear descriptions
6. **Iterate based on feedback** - First generation rarely perfect, expect 1-2 refinement rounds
7. **Consider text overlay** - Hero images will have text, ensure composition accommodates this
8. **Match brand aesthetic** - Follow AEM's visual identity (blues, purples, modern, professional)
9. **Keep prompts under 1024 chars** - Firefly has strict character limit
10. **Use content-specific foregrounds** - Folder tree for localization, form UI for forms, etc.
11. **Organize output** - Use `--folder` parameter to create page-specific directories

## References

- **Style guide:** `references/style-guide.md` - Visual standards, colors, composition rules, two-layer pattern
- **README.md:** Complete documentation including credential setup and examples
- **Generation script:** `scripts/generate.mjs` - Technical implementation

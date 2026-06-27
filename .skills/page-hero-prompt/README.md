# Page Hero Image Generator Skill

A Claude Code skill for generating professional hero images for AEM documentation pages using Adobe Firefly API.

## Overview

This skill automates the process of creating hero images (1472×832px, 16:9 aspect ratio) for documentation pages by:
1. Analyzing page content to understand the topic
2. Proposing visual concepts using **two-layer composition** (gradient background + UI mockup foreground)
3. Generating images using Adobe Firefly's generative AI
4. Saving organized output to ~/Downloads/[page-name]/

## Quick Start

### 1. Set Up Credentials

**Get Adobe Firefly API credentials:**

1. Go to [Adobe Developer Console](https://developer.adobe.com/console)
2. Sign in with your Adobe ID
3. Click **Create new project** → **Add API**
4. Select **Firefly Services** → **Firefly API**
5. Choose **OAuth Server-to-Server** credential type
6. Click **Save configured API**
7. Copy your **Client ID** and **Client Secret** (click "Retrieve client secret")

**Store credentials:**

Create `.skills/page-hero-prompt/scripts/.cache/.env`:

```bash
FIREFLY_CLIENT_ID=your_client_id_here
FIREFLY_CLIENT_SECRET=your_client_secret_here
```

**Important:** No quotes, no extra spaces. The `.cache/` directory is gitignored.

### 2. Verify Setup

```bash
node .skills/page-hero-prompt/scripts/generate.mjs --check
```

You should see: `✓ Firefly credentials configured`

### 3. Use the Skill

In Claude Code, simply ask:

```
Generate a hero image for https://main--helix-website--adobe.aem.page/drafts/ukhalid/examples/how-to-localize-fragments
```

**What happens:**
1. Claude analyzes the page content
2. Proposes 3 visual concepts using two-layer composition (background gradient + UI mockup foreground)
3. Generates 4 variations based on your selection
4. Saves to ~/Downloads/[page-name]/[page-name]-hero-1.jpg through 4.jpg

## Two-Layer Composition Pattern

**CRITICAL:** AEM hero images use a two-layer design, not single artistic images.

**Structure:**
1. **Background Layer** - Simple gradient or pattern canvas (ambient atmosphere)
2. **Foreground Layer** - UI mockup/interface that represents the page concept (70-80% width, 55-60% height)

**Example prompt:**
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

## Manual Usage (Without Skill)

Generate images directly from command line:

```bash
cd .skills/page-hero-prompt/scripts

node generate.mjs \
  --prompt "Your two-layer Firefly prompt here" \
  --folder "page-name" \
  --output "page-name-hero" \
  --n 4
```

**Parameters:**
- `--prompt` (required): The Firefly image generation prompt
- `--folder` (optional): Subfolder name in Downloads (e.g., "localize-fragments")
- `--output` (optional): File name prefix (default: "hero-image")
- `--n` (optional): Number of variations (default: 4)

**Output location:**
- With `--folder`: `~/Downloads/[folder]/[output]-1.jpg` through `[output]-4.jpg`
- Without `--folder`: `~/Downloads/[output]-1.jpg` through `[output]-4.jpg`

## File Structure

```
page-hero-prompt/
├── SKILL.md                    # Skill instructions for Claude
├── README.md                   # This file
├── .gitignore                  # Ignores .cache directory
├── references/
│   └── style-guide.md         # Visual standards and prompt guidelines
└── scripts/
    ├── generate.mjs           # Image generation script
    └── .cache/                # Gitignored - stores credentials and tokens
        ├── .env              # Your Firefly credentials (create this)
        └── token.json        # Auto-generated access token cache
```

## Installation Options

### Option 1: Use from Project (Recommended)

If your project already has this skill in `.skills/page-hero-prompt/`, just set up credentials (see Quick Start above).

### Option 2: Copy to Different Project

```bash
cp -r .skills/page-hero-prompt /path/to/target/project/.claude/skills/
```

Then set up credentials in the new location.

### Option 3: Install Globally

```bash
mkdir -p ~/.claude/skills
cp -r .skills/page-hero-prompt ~/.claude/skills/
```

Set up credentials at `~/.skills/page-hero-prompt/scripts/.cache/.env`

## Examples

### Example 1: Localization Guide

**Page:** How to localize fragments

**Prompt:**
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

### Example 2: Forms Page

**Page:** Forms implementation guide

**Prompt:**
```
BACKGROUND: Soft purple (#8B5CF6) to blue (#4B6BFB) gradient, minimal ambient canvas.

FOREGROUND: Large dark navy rounded panel (78% width, 60% height) centered, showing clean
form interface with input fields, dropdown selector, checkbox group, submit button. Modern
technical UI design. Panel floats with strong drop shadow.

Clear layer separation. Professional, technical mood. Landscape 16:9 format.
No text, no typography, no letters, no words.
```

## Troubleshooting

### "Missing credentials" error

```bash
node .skills/page-hero-prompt/scripts/generate.mjs --check
```

If fails:
- Ensure `.cache/.env` exists in the scripts directory
- Check no extra spaces or quotes in .env file
- Verify both FIREFLY_CLIENT_ID and FIREFLY_CLIENT_SECRET are set

### "401 Unauthorized" error

- Verify credentials are correct (copy-paste from Adobe Developer Console)
- Check that your Adobe account has Firefly API access
- Ensure Firefly API is enabled in your Developer Console project
- Delete `.cache/token.json` and retry

### Images don't match AEM style

- Review `references/style-guide.md` for two-layer composition pattern
- Ensure you're specifying BACKGROUND and FOREGROUND layers separately
- Include foreground size specs: "70-80% width, 55-60% height"
- Use exact color codes from style guide

### Prompt exceeds character limit

Firefly has a 1024 character limit. Condense your prompt:
- Remove redundant words
- Use abbreviations where clear
- Focus on essential details only

### Foreground element too small

Explicitly specify size: "Large dark navy rounded panel (75% width, 60% height) centered"

## Technical Details

### Image Specifications
- **Generated size:** 2688×1536px (16:9-ish ratio, high resolution)
- **Target size:** 1472×832px (automatically handled by AEM)
- **Format:** JPG from Firefly, convert to PNG if needed
- **File size:** Aim for < 500KB before AEM optimization
- **Composition:** Two-layer design (background gradient + foreground UI mockup)

### Token Caching
- Tokens cached in `.cache/token.json`
- Valid for 24 hours (cache expires after 23 hours)
- First run slower (authentication + generation)
- Subsequent runs use cached token (faster)

### Security
- **Never commit credentials** - `.cache/` is gitignored
- **Don't share credentials** - each developer needs their own
- **Rotate regularly** - regenerate in Developer Console if exposed
- **Tokens auto-expire** - no manual cleanup needed

## Resources

- **Style Guide:** `references/style-guide.md` - Detailed visual standards, colors, composition rules, prompt templates
- **Adobe Firefly API:** https://developer.adobe.com/firefly-services/docs/firefly-api/
- **AEM Documentation:** https://www.aem.live/docs/

## Contributing

When improving this skill:
- Follow the two-layer composition pattern
- Update `style-guide.md` with new visual patterns that work
- Add examples to this README
- Test with multiple page types before committing
- Keep credentials out of git (.cache/ is gitignored)

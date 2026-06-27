# Hero Image Style Guide for AEM Documentation

This guide defines the visual style for hero images used at the top of AEM documentation pages.

## Specifications

**Dimensions:** 1472×832 pixels (target), generated at 2688×1536
**Aspect Ratio:** 16:9 (landscape)
**Format:** PNG (will be automatically converted to WebP by AEM)
**Target File Size:** < 500KB (before automatic optimization)

## Critical: Two-Layer Composition

**AEM hero images use a two-layer design pattern:**

1. **Background Canvas** (ambient layer)
   - Soft gradient or subtle abstract pattern
   - Provides color atmosphere
   - Never busy or distracting
   - Examples: pink-to-yellow gradient, blue-to-purple, subtle grid overlay

2. **Foreground Element** (focus layer)
   - Clean UI mockup, interface component, or illustration
   - Centered or positioned strategically
   - Has depth (subtle shadow, elevation)
   - Looks like a screenshot or designed element placed on the canvas
   - Clear, functional, represents the page concept

**This is NOT a single artistic image** - it's a composed scene with background + foreground.

## Visual Direction

Hero images should look like **designed UI components placed on an ambient background canvas**, not complex artistic illustrations.

### Key Principles

1. **Two distinct layers** - Background provides atmosphere, foreground provides concept
2. **UI/mockup aesthetic** - Foreground should look functional, like a real interface element
3. **Conceptual clarity** - The foreground element immediately suggests the topic
4. **Professional aesthetic** - Clean, modern, technical but approachable
5. **Depth and elevation** - Foreground floats above background with subtle shadow
6. **Brand consistency** - Align with AEM's visual identity

## Composition Guidelines

### Layout

- **Horizontal orientation** - Fill the 16:9 frame naturally
- **Centered or left-weighted** - Leave space for text overlay (usually top-left)
- **Balanced negative space** - Don't overcrowd the composition
- **Depth and layers** - Use subtle layering to create visual interest

### Visual Elements

**Primary subject:**
- One clear focal point or concept illustration
- Can be more detailed than card thumbnails
- Abstract representations of technical concepts work well

**Supporting elements:**
- 2-4 secondary elements to reinforce the concept
- Geometric shapes, icons, or interface elements
- Connection lines, flows, or networks when relevant

**Background:**
- Soft gradients (preferred)
- Subtle grid or dot patterns
- Clean solid colors with subtle texture
- Avoid busy backgrounds that compete with text

## Color Palette

### Primary Colors (Technical Content)

- **Blues:** #4B6BFB, #6B8AFF, #93B3FF (trust, technology, stability)
- **Purples:** #8B5CF6, #A78BFA, #C4B5FD (innovation, creativity)
- **Teals:** #06B6D4, #22D3EE, #67E8F9 (modern, fresh, digital)

### Accent Colors

- **Soft Pink:** #F472B6, #FCA5CD (highlights, warmth)
- **Lime:** #84CC16, #A3E635 (energy, growth, success)
- **Amber:** #F59E0B, #FBBF24 (attention, caution, optimization)

### Background Gradients

**Preferred combinations:**
- Blue to purple: `linear-gradient(135deg, #4B6BFB 0%, #8B5CF6 100%)`
- Teal to blue: `linear-gradient(135deg, #06B6D4 0%, #4B6BFB 100%)`
- Purple to pink: `linear-gradient(135deg, #8B5CF6 0%, #F472B6 100%)`

Use soft, subtle gradients - avoid harsh color transitions.

## Style Characteristics

### Design Aesthetic

- **Flat design with subtle depth** - Not completely flat, but not skeuomorphic
- **Rounded shapes** - Prefer curved edges over sharp corners
- **Soft drop shadows** - Use sparingly for depth: `0 4px 12px rgba(0,0,0,0.1)`
- **Smooth transitions** - Gradients should be gentle
- **Modern and clean** - Avoid clutter, ornate details, or vintage styles

### Visual Mood

- Professional but friendly
- Technical but accessible
- Modern and forward-looking
- Confident and clear
- Optimistic (not cold or sterile)

## Content-Specific Guidelines

### Localization / Internationalization

**Visual concepts:**
- Globes, world maps (abstract, not photorealistic)
- Multiple language symbols as geometric shapes
- Connected nodes suggesting different locales
- Document fragments with locale indicators

**Colors:** Blues and purples with teal accents

### Performance / Optimization

**Visual concepts:**
- Speed indicators (abstract speedometers, motion lines)
- Simplified graphs showing improvement
- Lightning bolts, rocket ships (stylized, not literal)
- Streamlined flows

**Colors:** Blues and teals with lime accents

### Developer Tools / APIs

**Visual concepts:**
- Code bracket symbols
- Terminal/command line windows (simplified)
- API connection diagrams
- Tool icons (stylized versions)

**Colors:** Teals and purples with pink accents

### Authoring / Content Creation

**Visual concepts:**
- Document/page metaphors
- Cursor and editing indicators
- Content blocks or components
- Publishing/workflow flows

**Colors:** Purples and pinks with blue accents

## What to Avoid

### Never Include

- **Text or typography** - Hero images must never contain readable text
- **Logos or branding** - No Adobe logos, product logos, or brand marks
- **Photographs** - No photorealistic images or stock photos
- **Faces or people** - Keep it abstract and universal
- **Specific UI screenshots** - Generic representations only

### Style Pitfalls

- **Dark backgrounds** - Makes text overlay difficult to read
- **High contrast** - Harsh contrasts fight with overlaid text
- **Busy compositions** - Too many elements create visual noise
- **Saturated colors** - Keep colors soft and pleasant
- **Literal representations** - Abstract metaphors work better
- **Dated styles** - Avoid Web 2.0 gloss, flat 2014, or other trendy-but-dated aesthetics

## Firefly Prompt Template for Two-Layer Composition

**Critical: Describe the scene as two distinct layers in a single image**

```
BACKGROUND LAYER: [Gradient description or pattern]
Soft [color1] to [color2] gradient background canvas.
[Optional: subtle grid/texture overlay].
Clean, minimal, ambient atmosphere.

FOREGROUND LAYER: [UI mockup or illustration]
Centered [describe the UI element/mockup/illustration].
[Specific details about the interface or component].
Elevated with soft drop shadow, appears to float above background.
Modern, clean, functional design aesthetic.

Composition: Foreground element positioned [center/slightly left/etc]
on the background canvas. Clear separation between layers.
Professional, technical, approachable mood.
Landscape 16:9 format suitable for hero image.

No text, no typography, no letters, no words inside UI elements or anywhere.
```

### Example Prompt (Localization Topic)

```
Abstract illustration of a stylized translucent globe with soft glowing
document fragments orbiting around it connected by thin flowing lines in
a network pattern. Gradient background transitioning smoothly from deep
blue (#4B6BFB) to purple (#8B5CF6) with very subtle grid overlay.

Multiple geometric shapes suggesting language symbols float in the mid-ground.
UI elements suggesting content fragments with soft shadows positioned in
the lower third. Central globe is left of center to allow for text overlay
space in upper left.

Soft drop shadows, rounded corners throughout. Modern flat design aesthetic
with subtle depth. Professional, clean, optimistic mood. Teal accents (#22D3EE)
on connection lines.

Landscape 16:9 composition. No text, no typography, no letters, no logos.
```

## Testing Hero Images

### Text Overlay Test

After generating an image, test it with typical heading text:
- Add a dark heading (e.g., "How to Localize Fragments") in top-left
- Ensure image doesn't compete with or obscure text
- Verify contrast is sufficient for readability

### Responsive Preview

Hero images are displayed at different sizes:
- Desktop: Full 1472×832px
- Tablet: ~750px width (2000px versions generated)
- Mobile: Full width at smaller viewport

Key elements should remain clear at all sizes.

### Brand Alignment

Compare with existing AEM documentation:
- Visit https://www.aem.live/developer/tutorial
- Review https://www.aem.live/docs/ pages
- Ensure consistent aesthetic with the platform

## Quick Reference Checklist

Before finalizing a hero image, verify:

- [ ] Dimensions are 1472×832px (16:9 ratio)
- [ ] No text, typography, letters, or logos present
- [ ] Color palette uses AEM blues/purples/teals
- [ ] Composition leaves space for text overlay (usually top-left)
- [ ] Background is light/medium (not dark)
- [ ] Style is modern, clean, professional
- [ ] Concept clearly relates to page topic
- [ ] File size is reasonable (< 500KB)
- [ ] Image looks good with sample heading text overlaid
- [ ] Visual mood is professional but friendly

## Examples to Reference

Browse these AEM documentation pages for hero image examples:
- https://www.aem.live/developer/tutorial
- https://www.aem.live/developer/block-collection
- https://www.aem.live/docs/

Note: Some pages may not have hero images yet - we're establishing this standard.

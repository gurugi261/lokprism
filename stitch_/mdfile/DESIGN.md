---
name: Chromatic Utility System
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb786'
  on-tertiary: '#502400'
  tertiary-container: '#df7412'
  on-tertiary-container: '#461f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.5'
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  sidebar-width: 320px
  header-height: 64px
---

## Brand & Style

The design system is engineered for a **Color-Based Image Search System**, prioritizing functional clarity and visual neutrality. The brand personality is **technical, precise, and unobtrusive**, acting as a high-performance canvas that recedes to let user-uploaded images and color data take center stage.

The aesthetic follows a **Tool-Centric Minimalism**, drawing inspiration from professional creative suites. It utilizes a "UI as a Frame" philosophy:
- **Chrome-less Mentality:** Minimizing unnecessary decorative elements to maximize the viewport for visual results.
- **Micro-Precision:** Small, intentional details such as 1px borders and subtle hover states that signal a high-quality, professional tool.
- **Contextual Awareness:** UI elements respond to the colors they are analyzing, maintaining a symbiotic relationship between the data and the interface.

## Colors

The palette is designed to be **chromatically silent**. By using cool-toned grays and deep slates, the interface avoids "color bleed" which could skew the user's perception of the image search results.

- **Primary (Electric Blue):** Reserved exclusively for high-intent actions (Search, Export, Primary Selection).
- **Secondary (Emerald):** Used for "Match" indicators and success states.
- **Neutral/Surface:** A spectrum of cool grays (Slate) provides the structural hierarchy. 
- **Dark Mode (Default):** The primary environment for visual work, reducing eye strain and allowing vibrant image colors to "pop" against deep backgrounds.
- **Light Mode:** High-legibility alternative using off-whites and soft silver borders.

## Typography

This design system uses **Inter** for all functional and interface text due to its exceptional legibility at small sizes. **JetBrains Mono** is introduced for technical data (HEX codes, RGB values, metadata) to reinforce the "tool" aesthetic and provide clear character differentiation.

- **Headlines:** Tight tracking and bold weights for clear section anchoring.
- **Body:** Standardized at 14px for optimal information density without clutter.
- **Labels:** Uppercase monospaced text for data-heavy overlays and technical readouts.

## Layout & Spacing

The layout is a **hybrid-fluid system** designed for high-density data manipulation.

- **Main Workspace:** A fluid area that uses CSS Grid to create a responsive masonry or uniform grid of image results. 
- **The Sidebar:** A fixed-width (320px) collapsible panel on the right for history and favorites, ensuring the search tools remain consistent while the gallery expands.
- **Gutter Rhythm:** A strict 16px gutter between all cards and interactive components to maintain a clean, breathable structure.
- **Breakpoints:** 
    - *Mobile (< 768px):* Single column results, hidden sidebar (drawer-based).
    - *Tablet (768px - 1280px):* 2-3 column results, collapsible sidebar.
    - *Desktop (> 1280px):* 4+ column results, persistent sidebar.

## Elevation & Depth

To maintain a professional, "flat" tool feel, elevation is conveyed through **Low-Contrast Outlines** and **Tonal Layers** rather than heavy shadows.

- **Base Layer:** The darkest (in dark mode) or lightest (in light mode) surface.
- **Content Layer:** Cards and containers sit on a slightly contrasting surface color with a 1px solid border.
- **Active State:** Elements being dragged or selected receive a subtle, high-diffusion "ambient shadow" (0 8px 24px rgba(0,0,0,0.2)) to appear slightly lifted.
- **Glassmorphism:** Use only for sticky headers and floating color pickers (Backdrop blur: 12px) to maintain context of the content underneath.

## Shapes

The shape language is **Soft (0.25rem)**. This subtle rounding provides a modern, approachable feel while maintaining the structural integrity and precision of a technical tool.

- **Interactive Elements:** Buttons and Inputs use 4px (`rounded`) corners.
- **Image Cards:** Use 8px (`rounded-lg`) for a slightly softer visual framing of the content.
- **Color Swatches:** Use 2px radius or complete circles depending on the context (e.g., small color pickers are circles; large swatches are squares).

## Components

### Color Pickers & Inputs
- **Inputs:** Darker background than the surface, 1px border. Focus state uses a 1px Primary Blue border.
- **Technical Inputs:** HEX/RGB fields use `label-mono` typography.
- **Color Picker:** A custom popover containing a spectrum map and discrete sliders for HSL/RGB adjustment.

### Image Result Cards
- **Structure:** Aspect-ratio locked image container. 
- **Overlays:** On hover, a semi-transparent dark overlay appears at the bottom with `label-mono` text showing the dominant color % and a "Save" icon.
- **States:** A 2px Primary Blue border indicates the "Currently Selected" image for color extraction.

### Buttons
- **Primary:** Solid Primary Blue with white text. High contrast.
- **Ghost:** Transparent background with 1px Slate border. Used for secondary actions like "Clear History."

### Collapsible Sidebar
- Fixed to the right. Header contains a toggle to collapse into a narrow icon-only bar.
- Uses a vertical list of thumbnails with a 1px divider between items.

### Floating Action Button (FAB)
- Used for "Upload Image" on mobile; a circular button with a simple plus icon, positioned in the bottom right.
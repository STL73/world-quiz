# WorldQuiz CSS Design System Reference

All styles live in `CSS/style.css`. The design is dark-theme only, built with CSS custom properties.

## Colour tokens

```css
--bg-color: #0c0529           /* deep navy — page background, darkest layer */
--secondary-bg-color: #140844 /* dark purple — panels, answer boxes, inner containers */
--secondary-color: #290f8f    /* mid purple — cards, question boxes, nav buttons */
--primary-color: #9fb9f1      /* light blue — text, labels, input backgrounds */
--edit-color: lightseagreen   /* teal — CTAs, hints, success, star icon, progress fill */
--delete-color: darkred       /* delete actions only */
```

## Typography

Font: Poppins (Google Fonts, all weights 100–900). Applied globally via `*`.

| Use | Size | Weight | Letter-spacing |
|-----|------|--------|----------------|
| Logo | 1.7rem | 800 | 4px |
| Page heading | 2.5–2.7rem | 600–800 | 3–4px |
| Section heading | 1.4–1.8rem | 600–700 | 2–3px |
| Body / labels | 1–1.2rem | 400–500 | 2px |
| Buttons | 1.2–1.4rem | 600–700 | 3px |

## Button patterns

### Gradient button (nav, start)
```css
background: linear-gradient(to bottom, var(--secondary-color), var(--secondary-bg-color), var(--bg-color));
color: var(--primary-color);
border-radius: 7px;
/* hover: reverse gradient direction */
```

### Flat primary button (`.btn`)
```css
background-color: var(--primary-color);
color: var(--secondary-bg-color);
border-radius: 10px;
/* hover: background → var(--secondary-color), color → var(--primary-color) */
```

### CTA/action button (`.task-btn`, `.start-btn`)
```css
background-color: var(--secondary-color);   /* or var(--edit-color) for primary CTA */
color: var(--primary-color);
border-radius: 10px;
box-shadow: 5px 5px 10px rgba(164, 179, 232, 0.3);
/* hover: swap to opposite colour */
```

### Delete button
```css
background: var(--secondary-color);
color: var(--primary-color);
/* hover: background → var(--delete-color) */
```

## Transitions

- Colour transitions: `transition: background 0.3s ease-in-out`
- Gradient transitions: `transition: background 0.5s ease-in-out`
- Scale/transform: `transition: 0.3s ease-in-out`

## Card / panel pattern

```css
background: var(--secondary-color);
border-radius: 10px;
box-shadow: 5px 5px 10px rgba(164, 179, 232, 0.2);
padding: 2rem;
```

## Layout

- Everything is flexbox — no CSS Grid anywhere in the project
- Header: `height: 10vh`, sticky, z-index: 1
- Content areas: `min-height: 90vh` (full page minus header)
- Wrapper pattern: left panel (25% wide) + main area (75% wide), adjacent with matching border-radius removed on the touching sides

## Scrollable containers

```css
overflow: auto;
scroll-snap-type: y mandatory;
scrollbar-width: thin;
scrollbar-color: var(--primary-color) var(--bg-color);
```

## Icons

Boxicons via CDN: `https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css`
Used for star (`bx-star`), social media icons in the footer.

## Known responsive gaps

The current CSS has **no `@media` queries**. These are hardcoded and will break on small screens:
- `.question-box` — `width: 1000px; height: 500px`
- `.image-box img` — `width: 450px; height: 350px`
- `.img-box` — `width: 400px; height: 360px`
- `.form-container form` — `width: 40%` (too narrow on mobile)

When adding responsive support, start with these breakpoints matching the existing fixed widths:
- `max-width: 1100px` — scale down the question box
- `max-width: 768px` — stack left/main containers vertically, full-width form

---
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
  - "src/theme.ts"
---

# Admin Panel Styling Rules

## MUI Theme (Primary)
- All component styling through MUI `sx` prop or theme overrides in `src/theme.ts`
- Use theme palette tokens: `primary.main`, `background.paper`, `text.primary`, etc.
- Never hardcode colors — use theme or CSS variables

## Color Palette
- Primary: #2B6EF5 (hover: #4A85F7)
- BG: #0C0D1D | Card: #0E1831 | Card hover: #162140
- Text: #F9F9F9 (primary), #8384A5 (secondary), #878AA2 (muted)
- Border: #1E2D55 | Active border: #2B6EF5
- Success: #0ECC68 | Error: #E01B4F | Warning: #FFC23F | Info: #5581F7
- Input BG: #10182E

## Tailwind (Secondary)
- Use Tailwind for layout utilities: flex, grid, spacing, responsive breakpoints
- For colors, prefer MUI sx or CSS variables over Tailwind arbitrary values
- Responsive: sm (640px), md (768px), lg (1024px), xl (1280px)

## DO NOT
- Mix styled-components with MUI sx on the same component
- Use old colors: #0F1525, #1A2033, #2D334A, #646ECD
- Add separate CSS files per component — use sx or Tailwind
- Use Tailwind `dark:` prefix — we have a single dark theme

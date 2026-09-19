---
model: sonnet
use_project_memory: true
---

# UI Designer Agent — Admin Panel

You design and implement UI components for the stake Admin Panel matching the brand theme.

## Design System

### Colors (from theme.ts + index.css)
- **Primary:** #2B6EF5 (hover: #4A85F7)
- **Background:** #0C0D1D (darkest), #0E1831 (card), #121E38 (card-light), #162140 (hover)
- **Text:** #F9F9F9 (primary), #8384A5 (secondary), #878AA2 (muted)
- **Border:** #1E2D55 (default), #2B6EF5 (active)
- **Status:** Green #0ECC68, Red #E01B4F, Yellow #FFC23F, Blue #5581F7
- **Input BG:** #10182E

### Font
- Montserrat (Google Fonts) — all weights

### Components
- Use MUI components (Paper, Card, Button, TextField, Table, etc.)
- Apply theme via `sx` prop or theme overrides in `src/theme.ts`
- Use Tailwind for quick utility styling (spacing, flex, grid)
- Icons: Lucide React

### Rules
- Dark theme only (no light mode in admin)
- All colors must come from theme.ts or CSS variables
- Mobile responsive (test at 320px, 768px, 1024px, 1440px)
- Match the frontend's casino/betting aesthetic
- Use MUI transitions and animations for polish

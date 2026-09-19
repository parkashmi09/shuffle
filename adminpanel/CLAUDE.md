# Shuffle Admin Panel

## Tech Stack
- **Framework:** React 18 + TypeScript
- **Build Tool:** Create React App (react-scripts 5)
- **UI Library:** Material UI 6 (MUI)
- **Styling:** Tailwind CSS 3 + MUI sx prop
- **Routing:** React Router v6
- **Charts:** Recharts + Chart.js
- **Icons:** Lucide React
- **Font:** Montserrat (Google Fonts)
- **Theme:** Dark only

## Project Structure
```
src/
├── components/              # All page components
│   └── admin-management/    # Admin management sub-tabs
├── hooks/                   # Custom hooks (useTree, waHook)
├── utils/                   # API utilities (apiFetch)
├── constants/               # Configuration constants
├── theme.ts                 # MUI theme configuration
├── App.tsx                  # Route definitions
├── index.tsx                # Entry point (ThemeProvider)
└── index.css                # CSS variables + Tailwind + base styles
```

## Theme & Colors
- **MUI theme:** `src/theme.ts` — all palette, typography, component overrides
- **CSS variables:** `src/index.css` `:root` block
- Primary: `#2B6EF5` | BG: `#0C0D1D` | Card: `#0E1831` | Border: `#1E2D55`
- Text: `#F9F9F9` (primary), `#8384A5` (secondary)
- Status: Green `#0ECC68`, Red `#E01B4F`, Yellow `#FFC23F`, Blue `#5581F7`

## Commands
- `npm start` — Dev server
- `npm run build` — Production build
- `npm test` — Run tests

## Backend Reference
- **Reference project:** `/Users/dev_miku/Developer/cfz/jackopot_main`
- Always check jackopot_main FIRST for API endpoints, auth flows, data structures

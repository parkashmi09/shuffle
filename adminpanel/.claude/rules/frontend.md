---
paths:
  - "src/components/**"
  - "src/**/*.tsx"
---

# Admin Panel Frontend Rules

## Stack
- React 18 + TypeScript (strict — avoid `any`)
- Material UI 6 for all UI components
- Tailwind CSS 3 for utility styling
- React Router v6 for routing
- Lucide React for icons
- Montserrat font (Google Fonts)

## Theme
- MUI theme defined in `src/theme.ts` — use theme tokens, never hardcode colors
- CSS variables in `src/index.css` `:root` block
- Dark theme only: BG #0C0D1D, Card #0E1831, Primary #2B6EF5
- Use `sx` prop for MUI component styling

## Code Style
- Functional components + hooks only
- No class components
- No console.log in production code
- No unused imports or variables
- Handle loading + error states in all async operations
- Components under 300 lines — split if larger
- Proper TypeScript interfaces for all props and API responses

## API
- Use `apiFetch` from `src/utils/api.ts` for all API calls
- Never use raw fetch or axios directly
- Auth token managed via localStorage

## Backend Reference
- **Reference project:** `/Users/dev_miku/Developer/cfz/jackopot_main`
- Check jackopot_main FIRST for any API, auth, or backend logic
- Copy exact implementations (endpoints, request/response, error handling)

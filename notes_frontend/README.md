# Notes Frontend (Qwik)

A modern, minimalistic Qwik web UI for creating, viewing, updating, and deleting notes.
It integrates with a REST backend (notes_sqlite_db). Layout includes header navigation,
sidebar for tags, a notes list, and a detail pane.

## Features
- Create, read, update, delete notes
- List and search notes
- Tag filtering
- Responsive design
- Light theme with primary/secondary/accent colors

## Configure Backend
Set the API base URL via environment variable:
- VITE_NOTES_API_URL (optional). If not set, the app will call a relative `/api` path.

Copy `.env.example` to `.env` and adjust if needed.

## Development
- npm start
- Backend expected endpoints:
  - GET    {API}/notes[?q=...]
  - GET    {API}/notes/:id
  - POST   {API}/notes
  - PUT    {API}/notes/:id
  - DELETE {API}/notes/:id

Note: When VITE_NOTES_API_URL is not set, configure your dev proxy or serve backend on the same host with /api prefix.

## Scripts
- npm run dev       # Start in SSR dev mode
- npm run preview   # Build preview
- npm run build     # Production build

## Styling
Global styling and layout in `src/global.css`. Colors:
- Primary: #1976d2
- Secondary: #424242
- Accent: #ffb300

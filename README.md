# SquashIQ

A static landing page and product showcase for SquashIQ, an AI-assisted player-coach performance platform.

## Run

Open `index.html` directly in a browser. The page uses hosted Google Fonts and CSS-built athletic visual elements for its visual treatment.

## Player workflows

- `players.html` accepts player videos and stores them in the private `player-videos` Supabase Storage bucket.
- `schedule.html` saves player details first, then generates and stores a weekly training draft.
- Run `supabase-setup.sql` in the Supabase SQL Editor to create the tables, bucket, and insert-only policies.
- Add the project's publishable/anon key to `anonKey` in `supabase-config.js`. Never put a secret or service-role key in browser code.

The key previously embedded in the browser script was a secret credential. Rotate/revoke it in Supabase before deploying these changes. The anonymous insert policies are suitable for this prototype, but a public launch should add authenticated player accounts, request limits, and coach-only read access before collecting personal data or videos.

## Included

- Responsive SquashIQ visual identity inspired by the supplied references
- Player readiness and training-load dashboard preview
- Coach-in-the-loop AI workflow
- Clickable step-unlock training cards
- Pilot invite form with inline confirmation

This prototype intentionally keeps AI as a coach-reviewed decision-support layer, not a medical or computer-vision diagnosis tool.

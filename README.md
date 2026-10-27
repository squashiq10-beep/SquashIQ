# SquashIQ

A static landing page and product showcase for SquashIQ, an AI-assisted player-coach performance platform.

## Run

Open `index.html` directly in a browser. The page uses hosted Google Fonts and CSS-built athletic visual elements for its visual treatment.

## Player workflows

- `players.html` collects a player-owned nutrition, training, recovery, and squash video submission after email-link sign-in.
- `coach.html` is the authenticated review workspace for private AI drafts and video; only coach-published feedback is visible to the player.
- `schedule.html` saves player details first, then generates and stores a weekly training draft.
- Run `supabase-setup.sql` in the Supabase SQL Editor to create the tables, private bucket, and row-level security policies.
- Add the project's publishable/anon key to `anonKey` in `supabase-config.js`. Never put a secret or service-role key in browser code.
- Deploy `supabase/functions/generate-coach-draft` as a Supabase Edge Function and set `OPENAI_API_KEY` as a function secret. Supabase provides the URL, anon key, and service-role key to deployed functions.
- After a coach signs in once, authorize their account from the SQL Editor with `insert into public.coach_users (user_id) select id from auth.users where email = 'coach@example.com' on conflict do nothing;`. Do not grant coach membership from the browser.

With the Supabase CLI linked to the project, deploy the function with `supabase functions deploy generate-coach-draft`; configure `OPENAI_API_KEY` in Supabase function secrets and never commit it. In Supabase Auth, allow the local/deployed player and coach page URLs as redirect URLs.

Rotate/revoke any OpenAI key that was previously placed in browser code. Player and coach magic-link authentication must be enabled in Supabase Auth. The legacy schedule tables remain for the existing schedule demo; the new intake and feedback workflow uses authenticated ownership and coach-only policies. Configure request limits, retention, and consent appropriate to your deployment before collecting personal data or videos.

## Included

- Responsive SquashIQ visual identity inspired by the supplied references
- Player readiness and training-load dashboard preview
- Coach-in-the-loop AI workflow
- Clickable step-unlock training cards
- Pilot invite form with inline confirmation

This prototype intentionally keeps AI as a coach-reviewed decision-support layer, not a medical or computer-vision diagnosis tool.

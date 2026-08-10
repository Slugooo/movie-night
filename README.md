# Movie Night

The first UI slice for a small party movie-picking game.

## Included

- `/host` — start/end the active game and display joined players; cast or mirror this screen to the TV.
- `/` — guest page for entering a name once the game has started.
- A browser-local prototype store that synchronizes tabs of the same browser.

## Run locally

After reopening your terminal so that Node is available, run:

```powershell
cd C:\Users\clanc\Documents\Codex\2026-08-09\wh\movie-night
npm install
npm run dev
```

Open `http://localhost:3000/host` to act as host and `http://localhost:3000/` in another tab to test joining.

## Connect Supabase (required for separate phones)

1. Create a Supabase project.
2. In **Authentication → Providers**, enable **Anonymous Sign-Ins**.
3. In **SQL Editor**, run the complete contents of `supabase/schema.sql`.
4. In **Project Settings → API**, copy the project URL and **publishable** key (never the secret/service-role key).
5. Copy `.env.example` to `.env.local`, fill in those two values, and restart `npm run dev`.

The app will create an anonymous identity for each browser and will then synchronize the active game and players over Supabase Realtime.

Movie submission, voting, vetoes, and the spinner come after that foundation is live.

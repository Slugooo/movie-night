# Movie Night feature backlog

Last updated: August 10, 2026

## Next features

### 1. Make the movie wheel feel real

- Show every eligible movie as a labeled wheel segment.
- Animate the movie choices as the wheel spins.
- Use easing so the wheel accelerates, slows down, and lands clearly.
- Keep the winning movie deterministic across every connected screen.
- Add a pointer, winner highlight, and optional sound/confetti.
- Preserve reduced-motion accessibility and a fast fallback on older phones.

### 2. Optional accounts and sign-in

- Keep guest play available so joining a party remains frictionless.
- Let returning users sign in to save a display name and preferences.
- Decide whether hosts alone need accounts or whether accounts benefit guests too.
- Consider Supabase magic-link or social authentication.
- Avoid requiring sign-in for the initial join flow unless abuse becomes a problem.

### 3. Letterboxd watchlist suggestions

- Let a user connect or enter their Letterboxd profile.
- Import eligible titles from their watchlist.
- Randomly suggest a watchlist movie during game setup.
- Allow filters such as runtime, release year, genre, and streaming availability.
- Show who supplied the watchlist suggestion and allow rerolling.
- Confirm the supported Letterboxd API/authentication path before implementation; public-page scraping should not be the long-term integration.

## Already implemented

- Deployed production app with a short Vercel URL.
- Host chooses a display name.
- Host participates as a player and can submit two movies.
- Player joining and shared game state through Supabase.
- Movie search, submissions, voting, vetoes, and winner flow.
- Personalized visual design using the host's four Letterboxd favorites.

## Decisions to make later

- Whether sign-in is host-only, optional for everyone, or required for saved features.
- Whether Letterboxd suggestions draw from only the host or combine every connected player's watchlist.
- Whether watchlist picks are fully random or filtered before the draw.
- Whether wheel sound effects should default on or require an explicit toggle.

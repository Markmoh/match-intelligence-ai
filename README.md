# MATCH INTELLIGENCE AI V4.0 — private live-data starter

## What this build does
- Loads the current competition catalogue dynamically from API-Football into a searchable dropdown.
- Accepts only home team, away team and selected competition from the user.
- Resolves the two teams, retrieves up to 10 recent fixtures each, head-to-head, team season statistics and injury records.
- Calculates a transparent baseline independent-Poisson 1X2 estimate and scoreline probabilities.
- Shows data coverage limitations instead of inventing unavailable information.

## Important limitations
This is a working integration starter, not a fully validated professional forecasting service. API-Football coverage varies by league, season and subscription. The current model uses simple goal-average inputs; it does not yet have calibrated league-wide attack/defence ratings, manager-change intelligence, tactical web research, confirmed lineups or bookmaker odds. Those require additional data feeds and model validation.

## Setup
1. Install Node.js 20 or later.
2. Create an API-Football account and obtain an API key: https://www.api-football.com/
3. Copy `.env.example` to `.env` and insert your key as `API_FOOTBALL_KEY=...`.
4. Run `npm install`.
5. Run `npm start`.
6. Open http://localhost:3000

Never commit `.env`, publish the API key, or put it in browser JavaScript. Deploy the Node server to a private host with the key configured as a server-side environment variable.

## Provider references
- API-Football docs: https://www.api-football.com/documentation-v3
- API-Football getting started: https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide

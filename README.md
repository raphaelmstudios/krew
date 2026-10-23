# KREW

Payment trust platform for Nairobi's event and gig crew — ALU Software Engineering course build.

Stack: React (Vite) + Node/Express + SQLite.

## Project layout

```
krew-app/
  client/   React app (Vite). Dev server on :5173, proxies /api to :4000.
  server/   Express API + SQLite (better-sqlite3). Runs on :4000.
```

## Running it locally

Two terminals:

```bash
# Terminal 1 — API
cd server
npm install
npm run dev

# Terminal 2 — frontend
cd client
npm install
npm run dev
```

Then open http://localhost:5173 — it should show "Scaffold is live. API: ok", confirming
the client, the dev proxy, the Express server, and the SQLite connection are all wired up.

## Build checklist

Each task in the [3-Day Build Sprint checklist](https://claude.ai/artifact/Mp3E46RUafKjRGBtqbMVZB)
maps onto a route group in `server/src/index.js` and a screen in `client/src/` — the
comments in both files point to which task adds what, in order. Screens are built
against the approved HTML previews from the design pass, not from scratch.

## Status

- [x] **d1-1** — Stack picked (React + Express + SQLite), repo scaffolded, client ↔ API
      connection verified end to end.
- [ ] **d1-2** — Schema off the Class Diagram (User / Organizer / CrewMember / Transaction / Dispute) — next.
- [ ] **d1-3** — Deploy bare hello-world to a live URL.
- [ ] ...rest of the checklist.

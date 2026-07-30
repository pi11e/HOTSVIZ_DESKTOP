# HOTSVIZ

**Your personal Heroes of the Storm stat tracker — local-first, privacy-first.**

HOTSVIZ imports your own `.StormReplay` files and turns your personal replay data into actionable performance statistics. It runs entirely on your machine — no accounts, no uploads, no telemetry.

## Why this exists

Most Heroes stats tools (HeroesProfile.com, HotsLogs.com, etc.) collect data from thousands of players to build global leaderboards and meta snapshots. That's useful for the community, but it doesn't tell you much about *your own* play.

HOTSVIZ takes the opposite approach: **just your replays, just your stats.** It's designed for individual improvement — understanding your own hero pool, map performance, winrate trends, and draft patterns — without your data ever leaving your computer.

## Features

- **Dashboard** — match count, winrate, best hero, recent trend
- **Hero & map performance** — per-hero and per-map winrates with game counts
- **Hero × Map heatmap** — see where your best (and worst) hero/map combos are
- **Party-size analysis** — how does your winrate change solo vs grouped?
- **Draft helper** — recommends heroes for a selected map based on your personal history
- **Match history** — browsable, filterable list of all imported replays
- **Filters** — filter by game mode, map, hero, date range, and last N games
- **Local SQLite database** — your data stays on your machine
- **Auto-updater** — keeps the app current via GitHub releases

## Credits

Replay parsing is powered by **[Heroes.ReplayParser](https://github.com/barrett777/Heroes.ReplayParser)** (Barrett777), the most comprehensive .NET replay parser for Heroes of the Storm. Without this library, HOTSVIZ would not exist.

## Getting started

```powershell
npm install
npm run build-parser   # requires .NET SDK — builds HeroesParser.exe
npm run dev            # launches the app
```

Or download the latest installer from the [Releases](https://github.com/pi11e/HOTSVIZ_DESKTOP/releases) page.

## License

This project is not affiliated with Blizzard Entertainment or Heroes of the Storm.

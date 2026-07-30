# HOTSVIZ

**Your personal Heroes of the Storm stat tracker & visualizer.**

HOTSVIZ imports your own `.StormReplay` files and turns your personal replay data into actionable performance statistics. It runs entirely on your machine.

## Why this exists

Most Heroes stats tools (HeroesProfile.com, HotsLogs.com, etc.) collect data from thousands of players to build global leaderboards and meta snapshots. That's useful for the community, but it doesn't tell you much about *your own* play.

HOTSVIZ takes the opposite approach by only looking at your personal data. It's designed for individual improvement — understanding your own hero pool, map performance, winrate trends, and draft patterns.

## Features

- **Dashboard** - match count, winrate, best hero, recent trend
- **Hero & map performance** - per-hero and per-map winrates with game counts
- **Hero × Map heatmap** - see where your best (and worst) hero/map combos are
- **Party-size analysis** - how does your winrate change solo vs grouped?
- **Draft helper** - recommends heroes for a selected map based on your personal history
- **Match history** - browsable, filterable list of all imported replays
- **Filters** - filter by game mode, map, hero, date range, and last N games
- **Local SQLite database** - your data stays on your machine
- **Auto-updater** - keeps the app current via GitHub releases, easy to opt-out
- **Offline Use** - imports local data, displays local data, computes statistics locally

## AI Use Disclaimer
I am a hobby programmer and gamer. I have a full-time job and a family. I don't have time to re-learn SQL, or deal with JavaScript type-safety bugs. 
However, I like doing fun things, and doing them fast. That's why large sections of this tool were created or reviewed
with the help of free generative AI models. 
I started the original app around 2024 and created the foundations manually - parsing, storing, visualizing was all there.
In 2026, I picked up development again as a hobby project to experiment with OpenCode, and here we are.

## Credits

Replay parsing is powered by **[Heroes.ReplayParser](https://github.com/barrett777/Heroes.ReplayParser)** (Barrett777), the most comprehensive .NET replay parser for Heroes of the Storm. Without this library, HOTSVIZ would not exist.
This app bundles work derived from HeroesParser, to which I have made minor adjustments to fit the needs of this application. Full credit for the original parser goes to barrett777.

## Getting started

```powershell
npm install
npm run build-parser   # requires .NET SDK — builds HeroesParser.exe
npm run dev            # launches the app
```

Or download the latest installer from the [Releases](https://github.com/pi11e/HOTSVIZ_DESKTOP/releases) page.

## IP Notice

This project is not affiliated with Blizzard Entertainment or Heroes of the Storm.

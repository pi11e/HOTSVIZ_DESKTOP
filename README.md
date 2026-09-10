# HOTSVIZ

HOTSVIZ processes Heroes of the Storm replay files and analyzes *your* performance based on the stats extracted from them. 
It suggests what works and doesn't, and provides draft insights based on how you play. 
It also delivers various charts to highlight useful information based on your match history.

[![Discord](https://img.shields.io/badge/Discord-Join%20Us-5865F2?logo=discord&logoColor=white)](https://discord.gg/n3VcDcJR6k)
[![GitHub](https://img.shields.io/badge/GitHub-HOTSVIZ_Desktop-blue)](https://github.com/pi11e/HOTSVIZ_Desktop)
[![GitHub Release](https://img.shields.io/github/v/release/pi11e/HOTSVIZ_Desktop)](https://github.com/pi11e/HOTSVIZ_Desktop/releases)

**Download the latest release** from [GitHub Releases](https://github.com/pi11e/HOTSVIZ_Desktop/releases) — it's free. Windows only.

<details>
  <summary><strong>Click here to expand a preview of the entire app in one screen:</strong></summary>
  <img alt="HOTSVIZ full app tour" src="resources/screenshots/app-tour.png">
</details>

---

## What it does

**Analyze your replays.** Import your own `.StormReplay` files and get stats that are actually about you — win rate, most-played hero, hero and map performance, recent trends, party-size breakdowns, and a win-rate momentum chart. Everything is filtered instantly by game mode, hero, map, date range, or patch build.

**Supports Multi-account.** Play on more than one HotS account? Import replays from all of them and view any subset — per-owner checkboxes in the replay library filter the entire dashboard at query time, with no re-import and no deleted data.

**Draft better..** Get draft-time recommendations based on *your* win rate, recent form, and statistical confidence. Pick a map, fill in your roster, and it ranks heroes for you with role-conflict awareness (e.g. lower score for tank pick recommendations when a tank has already been picked).

**Understand your team mates and opponents.** View your match history and post-game details — both teams' stats, talents, and draft order, all in one view. Includes party indicators so you can see who was grouped together.

**Detailed per-Hero Performance.** Click any hero to see its full profile: aggregate win rate, per-map breakdown, and your best synergies and which hero spells your doom.

**Coaching Corner.** A short summary of what's worth your attention right now — recent vs overall form, and targeted scope insights when you drill into a single hero or map.

**Hero × Battleground heatmap.** A visual grid showing where you win and where you lose across every hero and map combination.

**Advanced filtering options.** Dropdowns at the top to filter by Game mode (incl. ARAM), last X games, "all matches since" date, patch, map and hero. 

---

## Screenshots

| Draft Helper | Match Detail |
|---|---|
| ![Draft Helper](resources/screenshots/draft-helper.png) | ![Match Detail](resources/screenshots/match-detail.png) |
| *Draft-time recommendations based on your win rate* | *Full breakdown of your matches — both teams* |

| Hero Detail | Heatmap |
|---|---|
| ![Hero Detail](resources/screenshots/hero-detail.png) | ![Heatmap](resources/screenshots/heatmap.png) |
| *Per-hero deep-dive with map breakdown and synergies* | *Hero × map win rate at a glance* |

| Import demo | Dashboard |
|---|---|
| ![Import flow](resources/screenshots/import.webp) | ![Dashboard](resources/screenshots/dashboard.png) |
| *From replays folder to full dashboard in seconds* | *The full dashboard view: cards, filter bar, heatmap* |

---

## Getting started

1. **Download** the latest release from [GitHub Releases](https://github.com/pi11e/HOTSVIZ_Desktop/releases)
2. **Select your replays folder** — the `Replays\Multiplayer` directory where Heroes of the Storm saves `.StormReplay` files (usually in your Documents folder). 
3. **Import and explore** — fast import skips already-imported replays; clean import rebuilds from scratch. Play on multiple accounts? They'll show up as checkboxes in the replay library so you can filter the whole dashboard per owner. Filter by game mode, hero, map, date, or patch build to focus your analysis.

All your data stays on your machine. Nothing is uploaded, sent over the network, or stored anywhere else.

---

## SmartScreen notice

The installer is not code-signed. Windows SmartScreen may show a warning when you download it. 
Click **More info → Run anyway** to proceed. The app itself is safe — it makes no network calls outside of the auto-updater and collects no data.
You can opt-out of updates if you prefer.

---

## Community

Join the [HOTSVIZ Discord](https://discord.gg/n3VcDcJR6k) to report bugs, request features, and talk about the app.

---

## Support

HOTSVIZ is free. If you enjoy it and want to support development, you can [buy me a coffee](https://buymeacoffee.com/pi11e). 

---

## Technical details

- Built with [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/) and [Electron](https://www.electronjs.org/)
- Replay decoding uses [HeroesParser](https://github.com/HeroesToolChest/Heroes.StormReplayParser), a .NET parser bundled as a self-contained binary
- Data stored locally in SQLite (path varies by platform — see [ARCHITECTURE.md](ARCHITECTURE.md))

---

## Supported Platforms

HOTSVIZ is a Windows-only application. It is not supported on macOS, Linux, or any other platform.
A Mac build may be feasible in the future.

---

## Disclaimer

HOTSVIZ is an independent project and is not affiliated with, endorsed, or sponsored by Blizzard Entertainment or any of its affiliates. Heroes of the Storm, the Blizzard logo, and all related trademarks are property of Blizzard Entertainment.

---

## Thanks

- Special thanks to all contributors to the [Heroes Toolchest](https://github.com/HeroesToolChest), without which there would be no replay insights to analyze. 
- Heroes of the Storm is the best MOBA in existence, there, I said it! Janitor, keep it up. Blizzard Execs, take note. To the players: May the hopium flow and the ranked queues be short.
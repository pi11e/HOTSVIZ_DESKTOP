# HOTSVIZ Desktop - Refactoring Guide & Analysis

**Date**: July 21, 2026  
**Status**: In Progress - Filter wiring implemented ✅

---

## 📊 Project Overview

HOTSVIZ Desktop is an Electron application for Heroes of the Storm players to visualize ranked gameplay statistics. It:
1. Processes `.StormReplay` files into JSON
2. Stores data in an SQLite database
3. Visualizes stats through 6 different chart types

**Main Tech Stack**: Electron, Chart.js, SQLite3, Node.js

---

## 🎯 Two Main Improvement Goals

### Goal #1: User-Enabled Filtering ✅ IMPLEMENTED

**Status**: Filter wiring completed on commit `fa89d1a`

#### What Was Done
Added event listener in `renderer.js` (lines 109-121) that:
- Captures filter inputs (game count, date, map)
- Sends them to backend via `window.electron.applyFilters()`
- Triggers visualization reload with filtered data

#### How It Works Now
1. User selects filters in the UI
2. Clicks "Apply Filters" button
3. Backend applies filters to database queries
4. Charts re-render with filtered data

#### Filter Options Available
- **Game Count**: Last 3, 5, 10, 15, 25, 50, or 100 games
- **Date Range**: Since specific date/time (datetime-local input)
- **Map Filter**: Select specific map or all maps
- **Combinations**: Can use any/all filters together

#### Testing Instructions
1. Open Developer Tools (F12)
2. Apply filters
3. Check console for filter logs
4. Watch charts update

#### Infrastructure Already In Place
- ✅ `hotsdb.js` lines 184-250: `queryDatabaseWithFiltersAndSerializeResult()` 
- ✅ `hotsdb.js` lines 211-250: `buildQuery()` for dynamic WHERE clauses
- ✅ `main.js` lines 305-322: `apply-filters` IPC handler
- ✅ `hotsdb.js` lines 27-33: `setFilters()` state management

---

### Goal #2: Code Quality & Architecture Refactoring 🚧 PROPOSED

**Status**: Design phase - Ready for implementation

#### Current Architecture Problems

**Monolithic Files Problem:**
```
main.js (329 lines)
├─ All Electron IPC handlers mixed together
├─ Concurrency logic (p-limit) 
└─ Event emission logic

renderer.js (361 lines)
├─ All chart creation lumped together
├─ Heatmap gets 150 lines of special handling (lines 127-273)
└─ Direct DOM manipulation everywhere

hotsdb.js (551 lines)
├─ Database queries
├─ Query building/filtering
├─ JSON file I/O
└─ Data serialization

hotsdata.js (655 lines)
├─ Chart data generation (7 chart types)
├─ Data transformation logic
└─ Complex nested data structures
```

**Key Issues Identified:**
| Issue | Impact | Severity |
|-------|--------|----------|
| No separation of concerns | Hard to test, modify, reuse | HIGH |
| Monolithic chart creation | Heatmap breaks pattern (150 lines) | HIGH |
| Data transformation scattered | 7 generator functions, duplicated patterns | MEDIUM |
| No error handling | Silent failures, no user feedback | MEDIUM |
| Global state | `window.charts`, `_filters`, race conditions | MEDIUM |
| Hardcoded constants | Paths and query files everywhere | LOW |

---

## 🛠️ Proposed Refactoring (4 Phases)

### Phase 1: Extract Chart Rendering (HIGHEST PRIORITY)
**Effort**: Medium | **Impact**: High | **Time**: 2-3 hours

**Goal**: Replace monolithic chart creation with reusable builders

**Create these new files:**

```
chartBuilders/
├─ ChartRegistry.js          (new)
├─ HeatmapBuilder.js         (new) 
├─ BarChartBuilder.js        (new)
├─ LineChartBuilder.js       (new)
├─ PieChartBuilder.js        (new)
├─ HeroChartBuilder.js       (new)
└─ PartySizeChartBuilder.js  (new)
```

**Key Benefits:**
- Reduce `renderer.js` from 361 lines to ~150 lines
- Each chart type is independently testable
- Adding new chart takes 10 min (vs 30+ min now)
- Heatmap special-case handling becomes clean

**Template Structure:**
```javascript
// chartBuilders/HeatmapBuilder.js
export class HeatmapBuilder {
  static build(data) {
    const { heroWinrate, mapWinrate, heatmapData, nestedMapStats, mapLabels, heroLabels } = data;
    return {
      type: 'matrix',
      data: this.buildChartData(heatmapData, mapLabels, heroLabels),
      options: this.buildOptions(heroWinrate, mapWinrate, nestedMapStats, mapLabels, heroLabels)
    };
  }
  
  static buildChartData(heatmapData, mapLabels, heroLabels) { /* ... */ }
  static buildOptions(heroWinrate, mapWinrate, nestedMapStats, mapLabels, heroLabels) { /* ... */ }
}
```

**Updated renderer.js:**
```javascript
async function createChart(chartName) {
  const response = await window.electron.getChartData(chartName);
  const data = JSON.parse(response);
  const chartConfig = ChartBuilder.build(chartName, data); // ← Single line!
  const ctx = document.getElementById(chartName).getContext('2d');
  const newChart = new Chart(ctx, chartConfig);
  charts.push(newChart);
}
```

---

### Phase 2: Data Fetching & Caching Layer
**Effort**: Medium | **Impact**: Medium | **Time**: 1-2 hours

**Goal**: Centralize data management and cache filtered results

**Create:** `dataManager.js`

**Features:**
- Caches chart data by filter combination
- Invalidates cache when filters change
- Prevents redundant backend calls
- Centralizes all data fetching logic

```javascript
export class DataManager {
  constructor() {
    this.filters = {};
    this.cache = new Map();
  }
  
  setFilters(gameCount, sinceDate, mapFilter) {
    this.filters = { gameCount, sinceDate, mapFilter };
    this.clearCache(); // Invalidate when filters change
  }
  
  async getChartData(chartType) {
    const cacheKey = this._getCacheKey(chartType);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey); // Return cached data
    }
    
    const response = await window.electron.getChartData(chartType);
    const data = JSON.parse(response);
    this.cache.set(cacheKey, data);
    return data;
  }
  
  _getCacheKey(chartType) {
    return `${chartType}_${JSON.stringify(this.filters)}`;
  }
}
```

---

### Phase 3: Constants & Configuration
**Effort**: Low | **Impact**: High | **Time**: 30 min

**Goal**: Centralize all hardcoded values

**Create:** `config.js`

```javascript
export const CONFIG = {
  DATA_PATHS: {
    DEV: './data/',
    DIST: './resources/app/data/'
  },
  
  QUERY_FILES: {
    HERO_STATS: 'queryForHeroStatsResult.json',
    MAP_STATS: 'queryForMapStatsResult.json',
    HEATMAP: 'queryForHeatmapResult.json',
    LINE_CHART: 'queryForLineChartResult.json',
    NESTED_MAP: 'queryForNestedMapResult.json',
    PARTY_WINRATE: 'queryForPartyWinrateResult.json'
  },
  
  MAPS: [
    "Alterac Pass",
    "Battlefield of Eternity",
    // ... rest of maps
  ],
  
  CHART_TYPES: ["heatmap", "piechart", "barchart", "linechart", "herochart", "partysizechart"],
  
  CONCURRENCY_LIMIT: 8, // for replay processing
  
  FILTER_DEFAULTS: {
    GAME_COUNTS: [3, 5, 10, 15, 25, 50, 100],
    DB_PROCESSING_DELAY: 500 // milliseconds
  }
};
```

**Benefits:**
- Single source of truth for configuration
- Easy to adjust settings globally
- No more searching files for magic numbers

---

### Phase 4: Error Handling & User Feedback
**Effort**: Medium | **Impact**: Medium | **Time**: 1 hour

**Goal**: Replace silent failures with user-visible feedback

**Create:** `errorHandler.js` and `uiNotifications.js`

```javascript
// errorHandler.js
export class UIErrorHandler {
  static showError(title, message, duration = 5000) {
    const errorDiv = document.getElementById("error-message") || this.createErrorDiv();
    errorDiv.innerHTML = `<strong>${title}</strong>: ${message}`;
    errorDiv.style.display = "block";
    errorDiv.className = "notification error";
    
    setTimeout(() => { errorDiv.style.display = "none"; }, duration);
  }
  
  static showSuccess(message, duration = 3000) {
    const notif = this.createNotificationDiv();
    notif.innerHTML = message;
    notif.className = "notification success";
    notif.style.display = "block";
    
    setTimeout(() => { notif.style.display = "none"; }, duration);
  }
  
  static createErrorDiv() {
    const div = document.createElement("div");
    div.id = "error-message";
    div.style.cssText = "position: fixed; top: 20px; right: 20px; padding: 15px; border-radius: 4px; z-index: 9999;";
    document.body.appendChild(div);
    return div;
  }
}
```

---

## 📈 Expected Results After Refactoring

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| renderer.js lines | 361 | ~150 | -58% |
| Testability | Low | High | 5x better |
| Time to add new chart | 30+ min | 10 min | 3x faster |
| Code duplication | ~20% | ~5% | 4x less |
| Maintainability score | Low | High | Subjective but significant |

---

## 🚀 Implementation Order

**Recommended sequence** (start with highest impact):

1. ✅ **Filter wiring** - DONE (commit `fa89d1a`)
2. 🔲 **Phase 1: Chart Builders** - START HERE
3. 🔲 **Phase 3: Config constants** - Quick win after Phase 1
4. 🔲 **Phase 2: Data manager** - Nice-to-have optimization
5. 🔲 **Phase 4: Error handling** - Polish pass

---

## 📝 Implementation Checklist

### Phase 1: Chart Builders
- [ ] Create `chartBuilders/` directory
- [ ] Create `ChartRegistry.js` with registration pattern
- [ ] Extract HeatmapBuilder logic from renderer.js (lines 127-273)
- [ ] Extract BarChartBuilder from hotsdata.js (lines 279-328)
- [ ] Extract LineChartBuilder from hotsdata.js (lines 142-182)
- [ ] Extract PieChartBuilder from hotsdata.js (lines 115-140)
- [ ] Extract HeroChartBuilder from hotsdata.js (lines 351-388)
- [ ] Extract PartySizeChartBuilder from hotsdata.js (lines 184-221)
- [ ] Update renderer.js to use ChartRegistry
- [ ] Test all 6 chart types render correctly
- [ ] Verify filters still work after refactoring

### Phase 3: Config Constants
- [ ] Create `config.js`
- [ ] Move all hardcoded paths to CONFIG
- [ ] Move all hardcoded arrays to CONFIG
- [ ] Update all imports throughout codebase
- [ ] Remove duplicate map arrays from renderer.js

### Phase 2: Data Manager
- [ ] Create `dataManager.js`
- [ ] Implement cache with filter-aware keys
- [ ] Update renderer.js to use DataManager
- [ ] Test cache invalidation on filter change

### Phase 4: Error Handling
- [ ] Create `errorHandler.js`
- [ ] Create CSS styles for notifications
- [ ] Add try-catch blocks in main data loading functions
- [ ] Add error boundaries in chart creation
- [ ] Test error messages display correctly

---

## 🔗 Related Files

**Current Implementation:**
- `renderer.js` - Frontend rendering (needs refactoring)
- `hotsdb.js` - Database layer (already has filter support)
- `hotsdata.js` - Data transformation (duplicate logic to extract)
- `main.js` - Electron main process (IPC handlers)
- `index.html` - Filter UI elements already in place

**Will Create:**
- `chartBuilders/` - New directory for chart builders
- `dataManager.js` - Cache and data fetching
- `config.js` - Centralized configuration
- `errorHandler.js` - User notifications

---

## 💡 Quick Reference

**Filter Application Data Flow:**
```
User clicks "Apply Filters"
    ↓
renderer.js event listener captures inputs
    ↓
window.electron.applyFilters(gameCount, sinceDate, mapFilter)
    ↓
main.js ipcMain handler receives call
    ↓
hotsdb.js setFilters() stores filter object
    ↓
User sees chart reload triggered
    ↓
Visualization requests chart data with:
window.electron.getChartData(chartType)
    ↓
main.js getChartData handler calls hotsdata.createResponseForChartType()
    ↓
hotsdata.js functions check for _filters in hotsdb.js
    ↓
Database queries run with WHERE clauses based on filters
    ↓
Results serialized to JSON and returned to renderer
    ↓
Charts re-render with filtered data
```

---

## 🎓 Learning Resources

**Related Files to Study:**
- Heatmap rendering: `renderer.js` lines 127-273
- Chart data generation patterns: `hotsdata.js` functions
- Database filtering: `hotsdb.js` `buildQuery()` function
- Electron IPC: `main.js` ipcMain handlers

---

## 📌 Notes for Future Self

- Filter timing: 500ms delay before chart reload is empirically determined
- Heatmap uses Matrix chart type (different from others)
- Check browser DevTools console for filter application logs
- Remember: `window.charts` array stores Chart.js instances for cleanup
- Test with both dev mode (`npx electron .`) and packaged distribution

---

## ✅ Completion Tracker

- [x] Goal #1: Filter wiring implemented
- [ ] Goal #2: Architecture refactoring (phases 1-4)
  - [ ] Phase 1: Chart builders
  - [ ] Phase 2: Data manager
  - [ ] Phase 3: Config constants
  - [ ] Phase 4: Error handling

**Last Updated**: July 21, 2026

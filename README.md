# Performance Manager

> 🚀 Built with AI via vibe coding.

A fully offline, browser-based benchmark performance management and visualization tool.

## Features

- **Data Management** — Import/export JSON, per-benchmark statistics (Arch/Config/Record counts)
- **Data Operations** — Full CRUD for benchmark records across a 3-level hierarchy (Benchmark → Architecture → Configuration). Supports custom extra fields per Architecture. Paginated record table with search, sort, and inline edit
- **Data Visualization** — Multi-line Canvas charts with animated drawing, MAX/MIN point highlighting, hover tooltips with collision-aware positioning, and fullscreen view

## Data Hierarchy

| Step | Name | Example |
|------|------|---------|
| 1 | **Benchmark** | resnet50, llama2-7b |
| 2 | **Architecture** | 16T r2p1, 8T r3p0 |
| 3 | **Configuration** | fp16, int8 per-layer symm |

## Data Structure

```json
{
  "benchmark_name": {
    "arch_name": {
      "config_name": [
        {
          "date": "2026-04-19",
          "duration": 123.456,
          "extras": {
            "field_id": { "name": "MAC Utilization (%)", "type": "float", "value": 57.1 }
          }
        }
      ]
    }
  }
}
```

## Usage

1. Open `index.html` in a browser (no server required for basic use)
2. **Data Operations**: Select Benchmark → Arch → Configuration → Add/Edit records
3. **Data Visualization**: Select Benchmark → choose Arch/Config lines → pick Y-axis metric → Draw Chart
4. **Data Management**: Import/Export JSON backup, view per-benchmark statistics

## Storage

All data stored in browser **IndexedDB** — works **fully offline** with no external dependencies.

## File Structure

```
perf_manager/
├── index.html            # Home page
├── html/
│   ├── data.html        # Data management
│   ├── data-op.html     # Data operations
│   └── chart.html       # Data visualization
├── css/styles.css       # All styles (dark theme, animations)
├── fonts/               # JetBrains Mono + Outfit (offline)
└── js/
    ├── db.js            # IndexedDB wrapper
    ├── data.js          # Import/export, statistics
    ├── data-op.js       # CRUD logic, pagination, form handling
    └── chart.js         # Canvas rendering, animations, tooltips
```

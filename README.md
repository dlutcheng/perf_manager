# Performance Manager

> 🚀 Built with AI via vibe coding.

A web-based tool for managing and visualizing benchmark performance data.

## Features

- **Home** (`index.html`) - Entry page with navigation
- **Data Management** (`data.html`) - JSON import/export/clear
- **Data Operations** (`data-op.html`) - Add/edit benchmark records
- **Data Visualization** (`chart.html`) - Performance charts

## Data Hierarchy

Follow the 3-step selection flow in Data Operations:

| Step | Name | Examples |
|------|------|----------|
| 1 | **Benchmark** | resnet50, bert |
| 2 | **Architecture** | 16T r2p1, 8T r3p0 |
| 3 | **Configuration** | fp32, int8, shape224 |

## Data Structure

```json
{
  "benchmark_name": {
    "arch_name": {
      "configuration_name": [
        {
          "date": "2026-04-19",
          "duration": 123.456,
          "extras": {
            "field_id": {
              "name": "Field Name",
              "value": 789.012
            }
          }
        }
      ]
    }
  }
}
```

## Usage

1. Go to **Data Operations**, select or create Benchmark → Arch → Configuration
2. Fill in date and duration, add custom fields if needed
3. Click **Save Record**

## Visualization

1. Go to **Data Visualization**, select a Benchmark
2. Check Arch/Configuration combos to compare
3. Choose Y-axis metric, click **Draw Chart**

## Storage

Data stored in browser **IndexedDB**, works **fully offline**.

## File Structure

```
perf_manager/
├── index.html          # Home page
├── html/
│   ├── data.html       # Data management
│   ├── data-op.html    # Data operations
│   └── chart.html      # Charts
├── css/styles.css
└── js/
    ├── db.js           # IndexedDB wrapper
    ├── data.js         # Data utilities
    ├── data-op.js      # Operations logic
    └── chart.js        # Chart rendering
```

# Performance Manager

> ### 🚀 Built with AI via vibe coding.

A web-based tool for managing and visualizing benchmark performance data.

## Overview

This tool helps you organize benchmark performance data through a hierarchical structure: **Benchmark → Arch → Configuration**. You can record, search, and visualize performance metrics over time.

## Pages

### 1. Home (index.html)
Landing page with navigation to all features and data status overview.

### 2. Data Management (data.html)
- **Import**: Load benchmark data from a JSON file
- **Export**: Download current data as JSON file
- **Clear**: Remove all data (with automatic backup download)

### 3. Data Operations (data-op.html)
The main interface for managing benchmark records.

#### Hierarchy Structure
| Level | Name | Description |
|-------|------|-------------|
| Level 1 | Benchmark | Top level (e.g., resnet50, bert) |
| Level 2 | Arch | Architecture variant (e.g., 16T r2p1, 8T r3p0) |
| Level 3 | Configuration | Configuration type (e.g., fp32, int8, shape224) |

#### Features
- **Add/Delete**: Create or remove items at each hierarchy level
- **Searchable Dropdowns**: Filter options in long lists
- **Record Management**:
  - Date and Duration (ms) fields
  - Extra custom fields (e.g., Power, MAC Utilization)
  - Edit and delete existing records
- **Dynamic Layout**: Panels rearrange based on selection state
- **Date Search**: Filter existing records by date (e.g., `2026-04`)
- **Expandable Fields Panel**: Extra fields area scrolls independently when content overflows

#### Form Indicators
- The Save/Clear button area highlights (orange border) when form has entered data

### 4. Data Visualization (chart.html)
Generate performance charts from recorded data.

#### Features
- **Multi-series Line Charts**: Plot multiple Arch/Configuration combinations with gradient area fills
- **Y-Axis Metrics**:
  - Selecting a single Arch: shows all its custom extra fields
  - Selecting multiple Archs: shows only common extra fields (intersection), otherwise defaults to Duration (ms)
- **Interactive Tooltips**: Hover to see detailed values with elegant dark rounded tooltips
- **Fullscreen Mode**: Expand chart for better viewing
- **Select All/Deselect All**: Quick selection controls
- **Collapsible Sections**: Vendor sections can be expanded/collapsed

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

### Adding a New Record

1. Navigate to **Data Operations**
2. Select or create a **Benchmark** (Level 1)
3. Select or create an **Arch** (Level 2)
4. Select or create a **Configuration** (Level 3)
5. Fill in the **Date** and **Duration**
6. Optionally add custom fields via **+ Add Field**
7. Click **Save Record**

### Adding Custom Fields

Custom fields (like Power, MAC Utilization) are specific to each Benchmark-Arch combination:
1. Select a Benchmark and Arch
2. Click **+ Add Field** in the Record Details panel
3. Enter field name (e.g., "Power(W)" or "MAC Utilization (%)")
4. Fill in values when saving records

### Viewing Charts

1. Navigate to **Data Visualization**
2. Select a **Benchmark**
3. Check the Arch/Configuration combinations to plot
4. Choose Y-Axis metric (Duration or custom field)
5. Click **Draw Chart**
6. Optionally enter **fullscreen** for larger view
7. Hover over data points for tooltips

## Storage

Data is stored in browser **localStorage**:
- `benchmark_data`: Main benchmark records
- `benchmark_extra_fields`: Custom field definitions per Benchmark-Arch

## Data Import/Export

### Export
1. Go to **Data Management**
2. Click **Export**
3. JSON file downloads automatically

### Import
1. Go to **Data Management**
2. Click **Import**
3. Select a JSON backup file
4. Confirm overwrite existing data

## Browser Compatibility

Works best with modern browsers (Chrome, Firefox, Edge, Safari). Requires localStorage support.

## File Structure

```
perf_manager/
├── index.html          # Home page
├── data.html           # Data import/export
├── data-op.html        # Data operations
├── chart.html          # Data visualization
├── data.js             # Shared data utilities
├── data-op.js          # Data operations logic
├── chart.js            # Chart rendering logic
├── styles.css          # Global styles
└── README.md           # This file
```

## Design System

The UI uses a cohesive color scheme based on ElementUI principles:

| Color | Usage |
|-------|-------|
| Primary (#409EFF) | Main actions, links, active states |
| Success (#67C23A) | Success states, positive actions |
| Warning (#E6A23C) | Warning states, form dirty indicators |
| Danger (#F56C6C) | Delete actions, danger zones |
| Info (#909399) | Secondary actions, disabled states |

All colors are defined as CSS variables for consistency across the application.
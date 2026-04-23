# Performance Manager

> Built with AI via vibe coding.

管理并可视化基准测试性能数据的Web工具。

## 功能

- **首页** (`index.html`) - 入口页面，导航和数据状态概览
- **数据管理** (`data.html`) - JSON导入/导出/清除数据
- **数据操作** (`data-op.html`) - 添加/编辑基准测试记录
- **数据可视化** (`chart.html`) - 性能图表绘制

## 数据层级

Benchmark → Arch → Configuration

| 层级 | 示例 |
|------|------|
| Benchmark | resnet50, bert |
| Arch | 16T r2p1, 8T r3p0 |
| Configuration | fp32, int8, shape224 |

## 数据结构

```json
{
  "benchmark": {
    "arch": {
      "config": [{ "date": "2026-04-19", "duration": 123.456, "extras": {} }]
    }
  }
}
```

## 使用

1. 进入 **Data Operations** 选择或创建 Benchmark → Arch → Configuration
2. 填写日期和耗时，可添加自定义字段
3. 点击 **Save Record**

## 可视化

1. 进入 **Data Visualization** 选择 Benchmark
2. 勾选要对比的 Arch/Configuration 组合
3. 选择Y轴指标，点击 **Draw Chart**

## 存储

使用浏览器 **IndexedDB** 存储数据，完全**离线可用**。

## 文件结构

```
perf_manager/
├── index.html          # 首页
├── html/
│   ├── data.html       # 数据管理
│   ├── data-op.html    # 数据操作
│   └── chart.html      # 图表
├── css/styles.css
└── js/
    ├── db.js           # IndexedDB封装
    ├── data.js         # 数据工具
    ├── data-op.js      # 操作逻辑
    └── chart.js        # 图表渲染
```

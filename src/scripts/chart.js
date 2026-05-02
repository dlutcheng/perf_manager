const CHART_COLORS = [
    '#00d4aa', '#f87171', '#38bdf8', '#fbbf24', '#c084fc',
    '#a3e635', '#fb923c', '#22d3ee', '#f472b6', '#34d399',
    '#818cf8', '#facc15'
];

const DARK_THEME = {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'Outfit, sans-serif' },
    title: { textStyle: { color: '#e2e8f0' } },
    legend: { textStyle: { color: '#94a3b8' } },
    tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(0, 212, 170, 0.3)',
        textStyle: { color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' },
        extraCssText: 'box-shadow: 0 4px 24px rgba(0,0,0,0.4); border-radius: 8px;'
    }
};

let chartInstances = {};

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getOrCreateChart(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    if (chartInstances[containerId]) {
        return chartInstances[containerId];
    }

    const chart = echarts.init(container, null, { renderer: 'canvas' });
    chartInstances[containerId] = chart;
    return chart;
}

window.disposeChart = function(containerId) {
    if (chartInstances[containerId]) {
        chartInstances[containerId].dispose();
        delete chartInstances[containerId];
    }
};

window.renderLineChart = function(datasets, labels, yAxis, benchmark, containerId, stateObj) {
    if (!containerId) containerId = 'chartCanvas';
    if (!stateObj) stateObj = {};

    const chart = getOrCreateChart(containerId);
    if (!chart) return;

    const titleMap = { duration: 'Duration (ms)' };
    if (typeof extraFields !== 'undefined') {
        extraFields.forEach(field => {
            titleMap['extra_' + field.id] = field.name;
        });
    }

    const allValues = datasets.flatMap(d => d.values);
    if (allValues.length === 0) {
        chart.setOption({
            backgroundColor: 'transparent',
            graphic: [{
                type: 'text',
                left: 'center',
                top: 'center',
                style: { text: 'No Data', fill: '#64748b', font: '15px Outfit, sans-serif' }
            }]
        });
        return;
    }

    const series = datasets.map((dataset, index) => {
        const data = dataset.values.map((val, idx) => {
            const value = val !== null && val !== undefined ? val : 0;
            return [dataset.dates[idx], value];
        });

        const color = dataset.color?.line || CHART_COLORS[index % CHART_COLORS.length];

        let maxVal = -Infinity, minVal = Infinity;
        let maxIdx = -1, minIdx = -1;
        data.forEach((item, idx) => {
            const val = item[1];
            if (val > 0) {
                if (val > maxVal) { maxVal = val; maxIdx = idx; }
                if (val < minVal) { minVal = val; minIdx = idx; }
            }
        });

        const markPointData = [];
        if (maxIdx >= 0) {
            markPointData.push({
                name: 'Max',
                coord: [data[maxIdx][0], maxVal],
                value: maxVal,
                symbolOffset: [0, -20]
            });
        }
        if (minIdx >= 0 && minIdx !== maxIdx) {
            markPointData.push({
                name: 'Min',
                coord: [data[minIdx][0], minVal],
                value: minVal,
                symbolOffset: [0, 20]
            });
        }

        return {
            name: dataset.label,
            type: 'line',
            data: data,
            smooth: true,
            symbol: 'circle',
            symbolSize: 8,
            showAllSymbol: true,
            lineStyle: { width: 2.5, color: color },
            itemStyle: { color: '#0f172a', borderColor: color, borderWidth: 2.5 },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: hexToRgba(color, 0.20) },
                    { offset: 1, color: hexToRgba(color, 0) }
                ])
            },
            emphasis: {
                itemStyle: { borderWidth: 3, shadowBlur: 10, shadowColor: color }
            },
            markPoint: {
                symbol: 'rect',
                symbolSize: [70, 36],
                symbolOffset: [0, -15],
                label: {
                    show: true,
                    color: '#fff',
                    fontSize: 12,
                    fontFamily: 'JetBrains Mono, monospace',
                    formatter: function(param) {
                        const date = param.data && param.data.coord ? param.data.coord[0] : '';
                        const shortDate = date ? date.substring(2) : '';
                        return `${shortDate}\n${param.value.toFixed(2)}`;
                    }
                },
                itemStyle: {
                    color: color,
                    borderRadius: 4
                },
                data: markPointData
            },
            animationDuration: 800,
            animationEasing: 'cubicOut'
        };
    });

    chart.clear();
    chart.setOption({
        backgroundColor: 'transparent',
        textStyle: DARK_THEME.textStyle,
        tooltip: {
            trigger: 'axis',
            backgroundColor: DARK_THEME.tooltip.backgroundColor,
            borderColor: DARK_THEME.tooltip.borderColor,
            textStyle: DARK_THEME.tooltip.textStyle,
            extraCssText: DARK_THEME.tooltip.extraCssText,
            axisPointer: {
                type: 'line',
                lineStyle: { color: 'rgba(0, 212, 170, 0.4)', type: 'dashed' }
            },
            formatter: function(params) {
                let result = params[0].axisValue + '<br/>';
                params.forEach(p => {
                    const seriesColor = datasets.find(d => d.label === p.seriesName)?.color?.line || CHART_COLORS[0];
                    const marker = `<span style="display:inline-block;margin-right:5px;border-radius:50%;width:10px;height:10px;background-color:${seriesColor};"></span>`;
                    const val = Array.isArray(p.value) ? p.value[1] : p.value;
                    const value = val != null ? val.toFixed(3) : 'N/A';
                    result += `${marker} ${p.seriesName}: ${value}<br/>`;
                });
                return result;
            }
        },
        legend: {
            top: 20,
            data: datasets.map(d => d.label),
            textStyle: { color: '#94a3b8', fontFamily: 'Outfit, sans-serif' },
            itemWidth: 14,
            itemHeight: 14,
            itemGap: 20
        },
        grid: { top: 60, right: 60, bottom: 80, left: 100 },
        xAxis: {
            type: 'category',
            data: labels,
            boundaryGap: false,
            axisLine: { lineStyle: { color: '#1e293b' } },
            axisTick: { lineStyle: { color: '#1e293b' } },
            axisLabel: {
                color: '#94a3b8',
                fontFamily: 'JetBrains Mono, monospace',
                rotate: 45,
                interval: Math.ceil(labels.length / 15)
            },
            name: 'Date',
            nameLocation: 'middle',
            nameGap: 50,
            nameTextStyle: { color: '#cbd5e1', fontFamily: 'Outfit, sans-serif' }
        },
        yAxis: {
            type: 'value',
            name: titleMap[yAxis] || yAxis,
            nameTextStyle: { color: '#cbd5e1', fontFamily: 'Outfit, sans-serif' },
            axisLine: { show: true, lineStyle: { color: '#1e293b' } },
            axisTick: { lineStyle: { color: '#1e293b' } },
            axisLabel: {
                color: '#94a3b8',
                fontFamily: 'JetBrains Mono, monospace',
                formatter: function(value) {
                    if (value === 0) return '0';
                    if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
                    if (value >= 1) return value.toFixed(1);
                    if (value >= 0.01) return value.toFixed(3);
                    return value.toFixed(6);
                }
            },
            splitLine: { lineStyle: { color: '#1e293b' } }
        },
        dataZoom: labels.length > 1 ? [
            {
                type: 'inside',
                xAxisIndex: 0,
                zoomOnMouseWheel: true,
                moveOnMouseWheel: false,
                moveOnMouseMove: false,
                zoomLock: false,
                start: 0,
                end: 100,
                minValueSpan: 1
            }
        ] : [],
        series: series,
        animationDuration: 800,
        animationEasing: 'cubicOut'
    });

    const zoomRateId = containerId + '_zoomRate';
    let zoomRateEl = document.getElementById(zoomRateId);
    if (!zoomRateEl) {
        zoomRateEl = document.createElement('div');
        zoomRateEl.id = zoomRateId;
        zoomRateEl.style.cssText = 'position:absolute;top:10px;right:10px;color:#94a3b8;font-family:JetBrains Mono,monospace;font-size:12px;z-index:10;pointer-events:none;';
        document.getElementById(containerId).style.position = 'relative';
        document.getElementById(containerId).appendChild(zoomRateEl);
    }

    if (labels.length > 1) {
        chart.on('dataZoom', function(params) {
            const option = chart.getOption();
            const start = option.dataZoom[0].start;
            const end = option.dataZoom[0].end;
            const rate = (100 / (end - start)).toFixed(1);
            zoomRateEl.textContent = rate + 'x';
        });
        zoomRateEl.textContent = '1.0x';
        zoomRateEl.style.display = 'block';
    } else {
        zoomRateEl.style.display = 'none';
    }

    stateObj.chart = chart;
};

window.animateLineChart = function(datasets, labels, yAxis, benchmark, containerId, stateObj) {
    window.renderLineChart(datasets, labels, yAxis, benchmark, containerId, stateObj);
};

window.renderOpChart = function(allOperators, leftOps, rightOps, dateLeft, dateRight, containerId, stateObj) {
    if (!containerId) containerId = 'chartCanvas';
    if (!stateObj) stateObj = {};

    const chart = getOrCreateChart(containerId);
    if (!chart) return;

    if (allOperators.length === 0) {
        chart.setOption({
            backgroundColor: 'transparent',
            graphic: [{
                type: 'text',
                left: 'center',
                top: 'center',
                style: { text: 'No Operators Data', fill: '#64748b', font: '15px Outfit, sans-serif' }
            }]
        });
        return;
    }

    const isSingleMode = stateObj.isSingleMode;
    const maxPairCount = stateObj.maxPairCount || 1;

    chart.clear();

    if (isSingleMode) {
        const pieSeries = [];
        const pieTitles = [];

        for (let p = 0; p < maxPairCount; p++) {
            const pieData = [];
            allOperators.forEach((op, idx) => {
                const leftOp = leftOps.get(op);
                const timeVal = leftOp?.pairs?.[p]?.time ?? 0;
                const ratioVal = leftOp?.pairs?.[p]?.ratio ?? 0;
                const color = CHART_COLORS[idx % CHART_COLORS.length];
                pieData.push({
                    name: op,
                    value: timeVal,
                    ratio: ratioVal,
                    itemStyle: { color: color },
                    labelLine: {
                        lineStyle: {
                            color: color
                        }
                    }
                });
            });

            const centerX = maxPairCount === 1 ? '50%' : `${(100 / maxPairCount) * p + (100 / maxPairCount / 2)}%`;
            const titleText = maxPairCount > 1 ? `core${p}` : dateLeft;

            pieTitles.push({
                text: titleText,
                left: centerX,
                top: '85%',
                textAlign: 'center',
                textStyle: {
                    color: '#94a3b8',
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: 14
                }
            });

            pieSeries.push({
                name: titleText,
                type: 'pie',
                roseType: 'area',
                radius: ['15%', '55%'],
                center: [centerX, '45%'],
                data: pieData,
                itemStyle: {
                    borderRadius: 4,
                    borderColor: '#0f172a',
                    borderWidth: 2
                },
                label: {
                    show: true,
                    alignTo: 'labelLine',
                    formatter: function(param) {
                        const ratioPercent = param.data.ratio != null ? (param.data.ratio * 100).toFixed(2) + '%' : 'N/A';
                    return `{name|${param.name}}\n{time|time: ${param.value.toFixed(2)}}\n{ratio|ratio: ${ratioPercent}}`;
                    },
                    rich: {
                        name: {
                            color: '#e2e8f0',
                            fontSize: 11,
                            fontWeight: 'bold',
                            fontFamily: 'JetBrains Mono, monospace'
                        },
                        time: {
                            color: '#94a3b8',
                            fontSize: 10,
                            fontFamily: 'JetBrains Mono, monospace'
                        },
                        ratio: {
                            color: '#94a3b8',
                            fontSize: 10,
                            fontFamily: 'JetBrains Mono, monospace'
                        }
                    }
                },
                labelLine: {
                    smooth: 0.2,
                    length: 15,
                    length2: 20
                },
                emphasis: {
                    itemStyle: {
                        shadowBlur: 20,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                },
                animationType: 'scale',
                animationEasing: 'elasticOut',
                animationDelay: function(idx) {
                    return Math.random() * 200;
                }
            });
        }

        chart.setOption({
            backgroundColor: 'transparent',
            textStyle: DARK_THEME.textStyle,
            title: pieTitles,
            tooltip: {
                trigger: 'item',
                backgroundColor: DARK_THEME.tooltip.backgroundColor,
                borderColor: DARK_THEME.tooltip.borderColor,
                textStyle: DARK_THEME.tooltip.textStyle,
                extraCssText: DARK_THEME.tooltip.extraCssText,
                formatter: function(param) {
                    const color = param.color;
                    const marker = `<span style="display:inline-block;margin-right:5px;border-radius:50%;width:10px;height:10px;background-color:${color};"></span>`;
                    const ratioPercent = param.data.ratio != null ? (param.data.ratio * 100).toFixed(2) + '%' : 'N/A';
                    return `${marker} <strong>${param.name}</strong><br/>time: ${param.value.toFixed(2)}<br/>ratio: ${ratioPercent}`;
                }
            },
            legend: {
                show: false
            },
            series: pieSeries,
            animationDuration: 1000,
            animationEasing: 'cubicOut'
        });
    } else {
        let maxTime = 0;
        for (const op of allOperators) {
            const leftOp = leftOps.get(op);
            const rightOp = rightOps.get(op);
            for (let p = 0; p < maxPairCount; p++) {
                const lt = leftOp?.pairs?.[p]?.time;
                const rt = rightOp?.pairs?.[p]?.time;
                if (lt != null && lt > maxTime) maxTime = lt;
                if (rt != null && rt > maxTime) maxTime = rt;
            }
        }

        const timeMargin = (maxTime || 1) * 0.1;
        const adjustedMaxTime = maxTime + timeMargin;

        const series = [];
        const legendData = [];

        for (let p = 0; p < maxPairCount; p++) {
            const leftData = allOperators.map(op => {
                const leftOp = leftOps.get(op);
                const timeVal = leftOp?.pairs?.[p]?.time;
                return timeVal != null ? timeVal : 0;
            });

            const pairLabel = maxPairCount > 1 ? ` core${p}` : '';
            const leftSeriesName = `${dateLeft}${pairLabel}`;
            legendData.push(leftSeriesName);

            series.push({
                name: leftSeriesName,
                type: 'bar',
                data: leftData,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#00d4aa' },
                        { offset: 1, color: 'rgba(0, 212, 170, 0.4)' }
                    ]),
                    borderRadius: [2, 2, 0, 0]
                },
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 212, 170, 0.5)'
                    }
                },
                barGap: '10%',
                barCategoryGap: '30%',
                animationDuration: 800,
                animationEasing: 'cubicOut'
            });

            const rightData = allOperators.map(op => {
                const rightOp = rightOps.get(op);
                const timeVal = rightOp?.pairs?.[p]?.time;
                return timeVal != null ? timeVal : 0;
            });

            const rightSeriesName = `${dateRight}${pairLabel}`;
            legendData.push(rightSeriesName);

            series.push({
                name: rightSeriesName,
                type: 'bar',
                data: rightData,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#f87171' },
                        { offset: 1, color: 'rgba(248, 113, 113, 0.4)' }
                    ]),
                    borderRadius: [2, 2, 0, 0]
                },
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(248, 113, 113, 0.5)'
                    }
                },
                barGap: '10%',
                barCategoryGap: '30%',
                animationDuration: 800,
                animationEasing: 'cubicOut'
            });
        }

        chart.setOption({
            backgroundColor: 'transparent',
            textStyle: DARK_THEME.textStyle,
            tooltip: {
                trigger: 'axis',
                backgroundColor: DARK_THEME.tooltip.backgroundColor,
                borderColor: DARK_THEME.tooltip.borderColor,
                textStyle: DARK_THEME.tooltip.textStyle,
                extraCssText: DARK_THEME.tooltip.extraCssText,
                axisPointer: { type: 'shadow' }
            },
            legend: {
                top: 20,
                data: legendData,
                textStyle: { color: '#94a3b8', fontFamily: 'Outfit, sans-serif' },
                itemWidth: 14,
                itemHeight: 14,
                itemGap: 20
            },
            grid: { top: 60, right: 60, bottom: 160, left: 100 },
            xAxis: {
                type: 'category',
                data: allOperators,
                axisLine: { lineStyle: { color: '#1e293b' } },
                axisTick: { lineStyle: { color: '#1e293b' } },
                axisLabel: {
                    color: '#94a3b8',
                    fontFamily: 'JetBrains Mono, monospace',
                    rotate: 45,
                    interval: 0
                },
                name: 'Operators',
                nameLocation: 'middle',
                nameGap: 140,
                nameTextStyle: { color: '#cbd5e1', fontFamily: 'Outfit, sans-serif' }
            },
            yAxis: {
                type: 'value',
                max: adjustedMaxTime || 1,
                name: 'Time (ms)',
                nameTextStyle: { color: '#cbd5e1', fontFamily: 'Outfit, sans-serif' },
                axisLine: { show: true, lineStyle: { color: '#1e293b' } },
                axisTick: { lineStyle: { color: '#1e293b' } },
                axisLabel: {
                    color: '#94a3b8',
                    fontFamily: 'JetBrains Mono, monospace',
                    formatter: function(value) {
                        if (value === 0) return '0';
                        if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
                        if (value >= 1) return value.toFixed(1);
                        if (value >= 0.01) return value.toFixed(3);
                        return value.toFixed(6);
                    }
                },
                splitLine: { lineStyle: { color: '#1e293b' } }
            },
            series: series,
            animationDuration: 800,
            animationEasing: 'cubicOut'
        });
    }

    stateObj.chart = chart;
};

window.animateOpChart = function(allOperators, leftOps, rightOps, dateLeft, dateRight, containerId, stateObj) {
    window.renderOpChart(allOperators, leftOps, rightOps, dateLeft, dateRight, containerId, stateObj);
};

window.renderRoseChart = function(data, containerId, title) {
    if (!containerId) containerId = 'chartCanvas';

    const chart = getOrCreateChart(containerId);
    if (!chart) return;

    if (!data || data.length === 0) {
        chart.setOption({
            backgroundColor: 'transparent',
            graphic: [{
                type: 'text',
                left: 'center',
                top: 'center',
                style: { text: 'No Data', fill: '#64748b', font: '15px Outfit, sans-serif' }
            }]
        });
        return;
    }

    const roseData = data.map((item, index) => ({
        value: item.value,
        name: item.name,
        itemStyle: {
            color: CHART_COLORS[index % CHART_COLORS.length]
        }
    }));

    chart.setOption({
        backgroundColor: 'transparent',
        textStyle: DARK_THEME.textStyle,
        tooltip: {
            trigger: 'item',
            backgroundColor: DARK_THEME.tooltip.backgroundColor,
            borderColor: DARK_THEME.tooltip.borderColor,
            textStyle: DARK_THEME.tooltip.textStyle,
            extraCssText: DARK_THEME.tooltip.extraCssText,
            formatter: '{b}: {c} ({d}%)'
        },
        legend: {
            orient: 'vertical',
            left: 'left',
            top: 'center',
            textStyle: { color: '#94a3b8', fontFamily: 'Outfit, sans-serif' },
            itemWidth: 14,
            itemHeight: 14,
            itemGap: 12
        },
        series: [{
            name: title || 'Data',
            type: 'pie',
            radius: ['20%', '75%'],
            center: ['60%', '50%'],
            roseType: 'area',
            itemStyle: {
                borderRadius: 4,
                borderColor: '#0f172a',
                borderWidth: 2
            },
            label: {
                color: '#94a3b8',
                fontFamily: 'JetBrains Mono, monospace'
            },
            emphasis: {
                label: {
                    show: true,
                    fontSize: 14,
                    fontWeight: 'bold',
                    color: '#e2e8f0'
                },
                itemStyle: {
                    shadowBlur: 20,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            },
            data: roseData,
            animationType: 'scale',
            animationEasing: 'elasticOut',
            animationDelay: function(idx) {
                return Math.random() * 200;
            }
        }]
    });

    return chart;
};

window.renderOpChartCurrent = function(containerId, stateObj) {
    const chart = chartInstances[containerId];
    if (chart) {
        chart.dispatchAction({ type: 'hideTip' });
    }
};

window.onLineChartMouseMove = function(e, containerId, stateObj) {
    const chart = chartInstances[containerId];
    if (chart) {
        chart.dispatchAction({ type: 'showTip', x: e.clientX, y: e.clientY });
    }
};

window.onLineChartMouseLeave = function(containerId, stateObj) {
    const chart = chartInstances[containerId];
    if (chart) {
        chart.dispatchAction({ type: 'hideTip' });
    }
};

window.onOpChartMouseMove = function(e, containerId, stateObj) {
};

window.resizeCharts = function() {
    Object.values(chartInstances).forEach(chart => {
        if (chart && chart.resize) {
            chart.resize();
        }
    });
};

window.addEventListener('resize', window.resizeCharts);

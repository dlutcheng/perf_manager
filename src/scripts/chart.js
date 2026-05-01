window.animateOpChart = function(allOperators, leftOps, rightOps, dateLeft, dateRight, canvasId, stateObj) {
    if (!stateObj) stateObj = {};
    if (stateObj.animationId) {
        cancelAnimationFrame(stateObj.animationId);
        stateObj.animationId = null;
    }

    const duration = 800;
    const startTime = performance.now();

    function frame(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        window.renderOpChart(allOperators, leftOps, rightOps, dateLeft, dateRight, eased, canvasId, stateObj);

        if (progress < 1) {
            stateObj.animationId = requestAnimationFrame(frame);
        } else {
            stateObj.animationId = null;
        }
    }

    stateObj.animationId = requestAnimationFrame(frame);
};

window.renderOpChart = function(allOperators, leftOps, rightOps, dateLeft, dateRight, animProgress, canvasId, stateObj) {
    if (animProgress === undefined) animProgress = 1;
    if (!canvasId) canvasId = 'chartCanvas';
    if (!stateObj) stateObj = {};

    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');

    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const padding = { top: 60, right: 80, bottom: 160, left: 100 };

    canvas.width = rect.width - 40 || window.innerWidth - 40;
    canvas.height = rect.height - 40 || window.innerHeight - 90;

    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;

    stateObj.padding = padding;
    stateObj.chartWidth = chartWidth;
    stateObj.chartHeight = chartHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (allOperators.length === 0) {
        ctx.font = '15px "Outfit", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText('No Operators Data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const isSingleMode = stateObj.isSingleMode;
    const maxPairCount = stateObj.maxPairCount || 1;
    const totalBarSlots = isSingleMode ? maxPairCount : 2 * maxPairCount;

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

    const groupWidth = chartWidth / allOperators.length;
    const singleBarWidth = Math.min(groupWidth / (totalBarSlots + 1), 30);
    const intraGap = Math.min(singleBarWidth * 0.15, 3);

    const xPosition = (index) => padding.left + groupWidth * index + groupWidth / 2;
    const yTimePosition = (value) => padding.top + chartHeight - ((value) / adjustedMaxTime) * chartHeight;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartHeight / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();

        const timeVal = adjustedMaxTime - (adjustedMaxTime / gridLines) * i;
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'right';
        ctx.fillText(timeVal.toFixed(2), padding.left - 12, y + 4);
    }

    ctx.font = '14px "Outfit", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.fillText('Operators', canvas.width / 2, canvas.height - 12);

    ctx.save();
    ctx.translate(30, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Time (ms)', 0, 0);
    ctx.restore();

    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    allOperators.forEach((op, index) => {
        const x = xPosition(index);
        ctx.save();
        ctx.translate(x, padding.top + chartHeight + 14);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(op, 0, 0);
        ctx.restore();
    });

    const visibleCount = Math.max(1, Math.ceil(allOperators.length * animProgress));

    const leftTimeColor = '#00d4aa';
    const rightTimeColor = '#f87171';

    const leftBlockWidth = maxPairCount * singleBarWidth + (maxPairCount - 1) * intraGap;
    const interGroupGap = isSingleMode ? 0 : Math.min(singleBarWidth * 0.5, 6);

    for (let i = 0; i < visibleCount; i++) {
        const op = allOperators[i];
        const cx = xPosition(i);
        const leftOp = leftOps.get(op);
        const rightOp = rightOps.get(op);
        const baseY = padding.top + chartHeight;

        const leftBlockStart = isSingleMode
            ? cx - leftBlockWidth / 2
            : cx - leftBlockWidth - interGroupGap / 2;
        for (let p = 0; p < maxPairCount; p++) {
            const timeVal = leftOp?.pairs?.[p]?.time;
            if (timeVal == null) continue;
            const animVal = timeVal * animProgress;
            const barY = yTimePosition(animVal);
            const barX = leftBlockStart + p * (singleBarWidth + intraGap);

            const grad = ctx.createLinearGradient(0, barY, 0, baseY);
            grad.addColorStop(0, leftTimeColor);
            grad.addColorStop(1, 'rgba(0, 212, 170, 0.4)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(barX, barY, singleBarWidth, baseY - barY, [2, 2, 0, 0]);
            ctx.fill();
        }

        if (!isSingleMode) {
            const rightBlockStart = cx + interGroupGap / 2;
            for (let p = 0; p < maxPairCount; p++) {
                const timeVal = rightOp?.pairs?.[p]?.time;
                if (timeVal == null) continue;
                const animVal = timeVal * animProgress;
                const barY = yTimePosition(animVal);
                const barX = rightBlockStart + p * (singleBarWidth + intraGap);

                const grad = ctx.createLinearGradient(0, barY, 0, baseY);
                grad.addColorStop(0, rightTimeColor);
                grad.addColorStop(1, 'rgba(248, 113, 113, 0.4)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.roundRect(barX, barY, singleBarWidth, baseY - barY, [2, 2, 0, 0]);
                ctx.fill();
            }
        }
    }

    const legendY = padding.top - 30;
    const legendItems = isSingleMode
        ? [{ label: `${dateLeft}`, color: leftTimeColor }]
        : [
            { label: `${dateLeft}`, color: leftTimeColor },
            { label: `${dateRight}`, color: rightTimeColor }
        ];

    let legendX = padding.left;
    ctx.font = '12px "Outfit", sans-serif';
    legendItems.forEach(item => {
        const labelWidth = ctx.measureText(item.label).width;
        const itemWidth = 20 + labelWidth + 24;

        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.roundRect(legendX, legendY, 14, 14, 3);
        ctx.fill();

        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.fillText(item.label, legendX + 20, legendY + 12);
        legendX += itemWidth;
    });
};

window.animateLineChart = function(datasets, labels, yAxis, benchmark, canvasId, stateObj) {
    if (!stateObj) stateObj = {};
    if (stateObj.animationId) {
        cancelAnimationFrame(stateObj.animationId);
        stateObj.animationId = null;
    }

    const duration = 800;
    const startTime = performance.now();

    function frame(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        window.renderLineChart(datasets, labels, yAxis, benchmark, eased, canvasId, stateObj);

        if (progress < 1) {
            stateObj.animationId = requestAnimationFrame(frame);
        } else {
            stateObj.animationId = null;
        }
    }

    stateObj.animationId = requestAnimationFrame(frame);
};

window.renderLineChart = function(datasets, labels, yAxis, benchmark, animProgress, canvasId, stateObj) {
    if (animProgress === undefined) animProgress = 1;
    if (!canvasId) canvasId = 'chartCanvas';
    if (!stateObj) stateObj = {};

    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');

    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const padding = { top: 40, right: 50, bottom: 80, left: 100 };

    canvas.width = rect.width - 40 || window.innerWidth - 40;
    canvas.height = rect.height - 40 || window.innerHeight - 90;

    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;

    stateObj.padding = padding;
    stateObj.chartWidth = chartWidth;
    stateObj.chartHeight = chartHeight;
    stateObj.xPosition = (index) => padding.left + (chartWidth / (labels.length - 1 || 1)) * index;
    stateObj.yPosition = (value) => {
        const maxVal = Math.max(...stateObj.datasets.flatMap(d => d.values), 0);
        const minVal = Math.min(...stateObj.datasets.flatMap(d => d.values), 0);
        const range = maxVal - minVal || 1;
        const margin = range * 0.1;
        const adjustedMax = maxVal + margin;
        const adjustedMin = Math.max(0, minVal - margin);
        return padding.top + chartHeight - ((value - adjustedMin) / (adjustedMax - adjustedMin || 1)) * chartHeight;
    };

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const titleMap = {
        duration: 'Duration (ms)'
    };
    if (typeof extraFields !== 'undefined') {
        extraFields.forEach(field => {
            titleMap['extra_' + field.id] = field.name;
        });
    }

    if (labels.length === 0) {
        ctx.font = '15px "Outfit", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText('No Data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const allValues = datasets.flatMap(d => d.values);
    if (allValues.length === 0) {
        ctx.font = '15px "Outfit", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText('No Data', canvas.width / 2, canvas.height / 2);
        return;
    }

    let maxValue = Math.max(...allValues, 0);
    let minValue = Math.min(...allValues, 0);
    const valueRange = maxValue - minValue || 1;
    const yMargin = valueRange * 0.1;
    maxValue += yMargin;
    minValue = Math.max(0, minValue - yMargin);

    const xPosition = (index) => padding.left + (chartWidth / (labels.length - 1 || 1)) * index;
    const yPosition = (value) => padding.top + chartHeight - ((value - minValue) / (maxValue - minValue || 1)) * chartHeight;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartHeight / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();

        const value = maxValue - ((maxValue - minValue) / gridLines) * i;
        ctx.font = '13px "JetBrains Mono", monospace';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'right';
        ctx.fillText(value.toFixed(3), padding.left - 15, y + 5);
    }

    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    const labelStep = Math.ceil(labels.length / 15);
    labels.forEach((label, index) => {
        if (index % labelStep === 0 || index === labels.length - 1) {
            const x = xPosition(index);
            ctx.save();
            ctx.translate(x, padding.top + chartHeight + 25);
            ctx.rotate(-Math.PI / 6);
            ctx.fillText(label, 0, 0);
            ctx.restore();
        }
    });

    ctx.font = '14px "Outfit", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.fillText('Date', canvas.width / 2, canvas.height - 15);

    ctx.save();
    ctx.translate(30, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(titleMap[yAxis] || yAxis, 0, 0);
    ctx.restore();

    const totalPoints = labels.length;
    const visibleCount = Math.max(1, Math.ceil(totalPoints * animProgress));

    datasets.forEach((dataset, datasetIndex) => {
        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
        gradient.addColorStop(0, dataset.color.fill.replace('0.12', '0.20'));
        gradient.addColorStop(1, dataset.color.fill.replace('0.12', '0'));

        const points = [];
        dataset.dates.forEach((date, index) => {
            const labelIndex = labels.indexOf(date);
            if (labelIndex < visibleCount) {
                const x = xPosition(labelIndex);
                const y = yPosition(dataset.values[index]);
                points.push({ x, y, labelIndex });
            }
        });

        if (points.length === 0) return;

        if (points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
            ctx.lineTo(points[0].x, padding.top + chartHeight);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        ctx.strokeStyle = dataset.color.line;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.stroke();

        points.forEach((point) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = '#0f172a';
            ctx.fill();
            ctx.strokeStyle = dataset.color.line;
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    });

    const highlightAnnotations = [];

    if (animProgress >= 1) {
        datasets.forEach((dataset, datasetIndex) => {
            if (dataset.values.length <= 1) return;

            let maxVal = -Infinity, minVal = Infinity;
            let maxIdx = -1, minIdx = -1;
            dataset.values.forEach((val, idx) => {
                if (val >= maxVal) { maxVal = val; maxIdx = idx; }
                if (val <= minVal) { minVal = val; minIdx = idx; }
            });

            const maxDate = dataset.dates[maxIdx];
            const minDate = dataset.dates[minIdx];
            const maxLabelIdx = labels.indexOf(maxDate);
            const minLabelIdx = labels.indexOf(minDate);
            const maxX = xPosition(maxLabelIdx);
            const maxY = yPosition(maxVal);
            const minX = xPosition(minLabelIdx);
            const minY = yPosition(minVal);

            ctx.beginPath();
            ctx.arc(maxX, maxY, 7, 0, 2 * Math.PI);
            ctx.fillStyle = dataset.color.line;
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(minX, minY, 7, 0, 2 * Math.PI);
            ctx.fillStyle = dataset.color.line;
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2;
            ctx.stroke();

            highlightAnnotations.push({
                x: maxX, y: maxY, value: maxVal, date: maxDate,
                label: dataset.label, color: dataset.color.line, type: 'MAX'
            });
            highlightAnnotations.push({
                x: minX, y: minY, value: minVal, date: minDate,
                label: dataset.label, color: dataset.color.line, type: 'MIN'
            });
        });
    }

    stateObj.highlightAnnotations = [];

    highlightAnnotations.forEach(ann => {
        const tagText = `${ann.type}: ${ann.value.toFixed(3)}`;
        const dateText = ann.date;
        const labelText = ann.label;

        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        const tagWidth = Math.max(ctx.measureText(tagText).width, ctx.measureText(dateText).width, ctx.measureText(labelText).width) + 16;
        const tagHeight = 48;
        const tagOffsetY = ann.type === 'MAX' ? -(tagHeight + 10) : 14;

        let tagX = ann.x - tagWidth / 2;
        let tagY = ann.y + tagOffsetY;

        if (tagX < padding.left) tagX = padding.left;
        if (tagX + tagWidth > canvas.width - padding.right) tagX = canvas.width - padding.right - tagWidth;
        if (tagY < padding.top) tagY = padding.top;
        if (tagY + tagHeight > padding.top + chartHeight) tagY = padding.top + chartHeight - tagHeight;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(tagX, tagY, tagWidth, tagHeight, 4);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.fillStyle = ann.color;
        ctx.textAlign = 'left';
        ctx.fillText(tagText, tagX + 8, tagY + 14);

        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(dateText, tagX + 8, tagY + 28);

        ctx.font = '10px "Outfit", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText(labelText, tagX + 8, tagY + 42);

        stateObj.highlightAnnotations.push({ x: tagX, y: tagY, width: tagWidth, height: tagHeight });
    });

    const legendY = padding.top - 15;
    let legendX = padding.left;
    let legendRow = 0;
    const legendLineHeight = 20;
    const legendColorBox = 15;
    const legendSpacing = 5;

    datasets.forEach((dataset) => {
        const labelWidth = ctx.measureText(dataset.label).width;
        const legendItemWidth = legendColorBox + legendSpacing + labelWidth + 10;

        if (legendX + legendItemWidth > canvas.width - padding.right) {
            legendX = padding.left;
            legendRow++;
        }

        const finalX = legendX;
        const finalY = legendY - legendRow * legendLineHeight;

        ctx.fillStyle = dataset.color.line;
        ctx.beginPath();
        ctx.roundRect(finalX, finalY, legendColorBox, legendColorBox, 3);
        ctx.fill();

        ctx.font = '12px "Outfit", sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.fillText(dataset.label, finalX + legendColorBox + legendSpacing, finalY + 12);

        legendX += legendItemWidth + 10;
    });
};

window.wrapText = function(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let row = 0;
    words.forEach(word => {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== '') {
            ctx.fillText(line.trim(), x, y + row * lineHeight);
            line = word + ' ';
            row++;
        } else {
            line = testLine;
        }
    });
    ctx.fillText(line.trim(), x, y + row * lineHeight);
    return row + 1;
};

window.measureTextRows = function(ctx, text, maxWidth) {
    const words = text.split(' ');
    let line = '';
    let row = 0;
    words.forEach(word => {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== '') {
            line = word + ' ';
            row++;
        } else {
            line = testLine;
        }
    });
    return row + 1;
};

window.onLineChartMouseMove = function(e, canvasId, stateObj) {
    if (stateObj.labels.length === 0) return;

    const canvas = document.getElementById(canvasId);
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { padding, chartWidth, chartHeight, labels, datasets } = stateObj;

    if (mouseX < padding.left || mouseX > padding.left + chartWidth ||
        mouseY < padding.top || mouseY > padding.top + chartHeight) {
        window.renderLineChart(datasets, labels, stateObj.yAxis, stateObj.benchmark, 1, canvasId, stateObj);
        return;
    }

    const relativeX = mouseX - padding.left;
    const nearestIndex = Math.round(relativeX / (chartWidth / (labels.length - 1 || 1)));
    const clampedIndex = Math.max(0, Math.min(labels.length - 1, nearestIndex));
    const nearestLabel = labels[clampedIndex];
    const nearestX = padding.left + (chartWidth / (labels.length - 1 || 1)) * clampedIndex;

    let maxValue = Math.max(...datasets.flatMap(d => d.values), 0);
    let minValue = Math.min(...datasets.flatMap(d => d.values), 0);
    const valueRange = maxValue - minValue || 1;
    const yMargin = valueRange * 0.1;
    maxValue += yMargin;
    minValue = Math.max(0, minValue - yMargin);

    const actualYPosition = (value) => padding.top + chartHeight - ((value - minValue) / (maxValue - minValue || 1)) * chartHeight;

    window.renderLineChart(datasets, labels, stateObj.yAxis, stateObj.benchmark, 1, canvasId, stateObj);

    const ctx = canvas.getContext('2d');

    ctx.strokeStyle = 'rgba(0, 212, 170, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(nearestX, padding.top);
    ctx.lineTo(nearestX, padding.top + chartHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    const dataPointsAtNearestDate = [];
    datasets.forEach(dataset => {
        dataset.dates.forEach((date, index) => {
            if (date === nearestLabel) {
                dataPointsAtNearestDate.push({
                    label: dataset.label,
                    value: dataset.values[index],
                    color: dataset.color.line,
                    x: nearestX,
                    y: actualYPosition(dataset.values[index])
                });
            }
        });
    });

    if (dataPointsAtNearestDate.length > 0) {
        let tooltipX = nearestX + 20;
        let tooltipY = Math.min(...dataPointsAtNearestDate.map(p => p.y));

        const titleMap = {
            duration: 'Duration (ms)'
        };
        if (typeof extraFields !== 'undefined') {
            extraFields.forEach(field => {
                titleMap['extra_' + field.id] = field.name;
            });
        }

        const maxLabelWidth = Math.max(
            ...dataPointsAtNearestDate.map(p => ctx.measureText(p.label).width),
            ctx.measureText(stateObj.benchmark).width,
            ctx.measureText(titleMap[stateObj.yAxis] || stateObj.yAxis).width
        );
        const tooltipWidth = Math.min(maxLabelWidth + 80, 300);
        const lineHeight = 16;
        const textMaxWidth = tooltipWidth - 30;

        if (tooltipX + tooltipWidth > canvas.width) {
            tooltipX = canvas.width - tooltipWidth - 10;
        }
        if (tooltipX < 10) tooltipX = 10;
        if (tooltipY < padding.top + 80) {
            tooltipY = padding.top + 80;
        }

        ctx.font = 'bold 12px "Outfit", sans-serif';
        const rows0 = window.measureTextRows(ctx, stateObj.benchmark, textMaxWidth);
        const rows1 = window.measureTextRows(ctx, titleMap[stateObj.yAxis] || stateObj.yAxis, textMaxWidth);
        const rows2 = window.measureTextRows(ctx, nearestLabel, textMaxWidth);

        let measuredY = tooltipY + 10 + (rows0 + rows1 + rows2) * lineHeight + 10;
        const dataRows = [];
        dataPointsAtNearestDate.forEach((point) => {
            ctx.font = '12px "JetBrains Mono", monospace';
            const text = `${point.label}: ${point.value.toFixed(3)}`;
            const textRows = window.measureTextRows(ctx, text, textMaxWidth - 18);
            dataRows.push(textRows);
            measuredY += Math.max(textRows * lineHeight, 20);
        });

        const tooltipHeight = measuredY - tooltipY + 10;

        const annotations = stateObj.highlightAnnotations || [];
        const rectsOverlap = (r1, r2) => {
            return r1.x < r2.x + r2.width && r1.x + r1.width > r2.x &&
                   r1.y < r2.y + r2.height && r1.y + r1.height > r2.y;
        };

        const tooltipRect = { x: tooltipX - 5, y: tooltipY - 5, width: tooltipWidth, height: tooltipHeight };
        let overlaps = annotations.some(ann => rectsOverlap(tooltipRect, ann));

        if (overlaps) {
            const candidates = [
                { x: nearestX + 20, y: tooltipY },
                { x: nearestX - tooltipWidth - 15, y: tooltipY },
                { x: tooltipX, y: padding.top + 5 },
                { x: tooltipX, y: padding.top + chartHeight - tooltipHeight - 5 },
                { x: nearestX + 20, y: padding.top + chartHeight - tooltipHeight - 5 },
                { x: nearestX - tooltipWidth - 15, y: padding.top + chartHeight - tooltipHeight - 5 },
                { x: padding.left + 5, y: tooltipY },
                { x: canvas.width - tooltipWidth - padding.right - 5, y: tooltipY }
            ];

            for (const candidate of candidates) {
                let cx = candidate.x;
                let cy = candidate.y;
                if (cx < padding.left) cx = padding.left;
                if (cx + tooltipWidth > canvas.width - padding.right) cx = canvas.width - padding.right - tooltipWidth;
                if (cy < padding.top) cy = padding.top;
                if (cy + tooltipHeight > padding.top + chartHeight) cy = padding.top + chartHeight - tooltipHeight;

                const testRect = { x: cx - 5, y: cy - 5, width: tooltipWidth, height: tooltipHeight };
                if (!annotations.some(ann => rectsOverlap(testRect, ann))) {
                    tooltipX = cx;
                    tooltipY = cy;
                    overlaps = false;
                    break;
                }
            }
        }

        ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
        ctx.beginPath();
        ctx.roundRect(tooltipX - 5, tooltipY - 5, tooltipWidth, tooltipHeight, 6);
        ctx.fill();

        ctx.font = 'bold 12px "Outfit", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'left';
        window.wrapText(ctx, stateObj.benchmark, tooltipX, tooltipY + 10, textMaxWidth, lineHeight);
        window.wrapText(ctx, titleMap[stateObj.yAxis] || stateObj.yAxis, tooltipX, tooltipY + 10 + rows0 * lineHeight, textMaxWidth, lineHeight);
        window.wrapText(ctx, nearestLabel, tooltipX, tooltipY + 10 + (rows0 + rows1) * lineHeight, textMaxWidth, lineHeight);

        let currentY = tooltipY + 10 + (rows0 + rows1 + rows2) * lineHeight + 10;
        dataPointsAtNearestDate.forEach((point, i) => {
            ctx.font = '12px "JetBrains Mono", monospace';
            ctx.fillStyle = point.color;
            ctx.beginPath();
            ctx.roundRect(tooltipX, currentY - 8, 12, 12, 2);
            ctx.fill();

            ctx.fillStyle = '#e2e8f0';
            const text = `${point.label}: ${point.value.toFixed(3)}`;
            window.wrapText(ctx, text, tooltipX + 18, currentY, textMaxWidth - 18, lineHeight);
            currentY += Math.max(dataRows[i] * lineHeight, 20);
        });
    }
};

window.onLineChartMouseLeave = function(canvasId, stateObj) {
    if (stateObj.labels.length === 0) return;
    window.renderLineChart(stateObj.datasets, stateObj.labels, stateObj.yAxis, stateObj.benchmark, 1, canvasId, stateObj);
};

window.onOpChartMouseMove = function(e, canvasId, stateObj) {
    if (stateObj.operators.length === 0) return;

    const canvas = document.getElementById(canvasId);
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { padding, chartWidth, chartHeight, operators, leftData, rightData, leftDate, rightDate, maxPairCount } = stateObj;
    const isSingleMode = !rightData || rightData.length === 0;

    if (mouseX < padding.left || mouseX > padding.left + chartWidth ||
        mouseY < padding.top || mouseY > padding.top + chartHeight) {
        window.renderOpChartCurrent(canvasId, stateObj);
        return;
    }

    const groupWidth = chartWidth / operators.length;
    const nearestIndex = Math.floor((mouseX - padding.left) / groupWidth);
    const clampedIndex = Math.max(0, Math.min(operators.length - 1, nearestIndex));

    const leftOps = new Map(leftData.map(d => [d.operator, d]));
    const rightOps = isSingleMode ? new Map() : new Map(rightData.map(d => [d.operator, d]));

    window.renderOpChartCurrent(canvasId, stateObj);

    const ctx = canvas.getContext('2d');
    const cx = padding.left + groupWidth * clampedIndex + groupWidth / 2;

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, padding.top);
    ctx.lineTo(cx, padding.top + chartHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    const op = operators[clampedIndex];
    const leftOp = leftOps.get(op);
    const rightOp = rightOps.get(op);
    const pairCount = maxPairCount || 1;

    let maxTime = 0;
    for (const o of operators) {
        const lo = leftOps.get(o);
        const ro = rightOps.get(o);
        for (let p = 0; p < pairCount; p++) {
            const lt = lo?.pairs?.[p]?.time;
            const rt = ro?.pairs?.[p]?.time;
            if (lt != null && lt > maxTime) maxTime = lt;
            if (rt != null && rt > maxTime) maxTime = rt;
        }
    }
    const timeMargin = (maxTime || 1) * 0.1;
    const adjustedMaxTime = maxTime + timeMargin;
    const yTimePos = (v) => padding.top + chartHeight - (v / adjustedMaxTime) * chartHeight;

    const lines = [
        { text: op, bold: true, color: '#e2e8f0' }
    ];

    for (let p = 0; p < pairCount; p++) {
        const pairLabel = pairCount > 1 ? ` #${p + 1}` : '';
        lines.push({ text: `── ${leftDate}${pairLabel} ──`, bold: false, color: '#00d4aa' });
        const lt = leftOp?.pairs?.[p]?.time;
        const lr = leftOp?.pairs?.[p]?.ratio;
        lines.push({ text: `  Time: ${lt != null ? lt.toFixed(3) : 'N/A'}`, bold: false, color: '#00d4aa' });
        lines.push({ text: `  Ratio: ${lr != null ? (lr * 100).toFixed(1) + '%' : 'N/A'}`, bold: false, color: '#34d399' });
    }

    if (!isSingleMode) {
        for (let p = 0; p < pairCount; p++) {
            const pairLabel = pairCount > 1 ? ` #${p + 1}` : '';
            lines.push({ text: `── ${rightDate}${pairLabel} ──`, bold: false, color: '#f87171' });
            const rt = rightOp?.pairs?.[p]?.time;
            const rr = rightOp?.pairs?.[p]?.ratio;
            lines.push({ text: `  Time: ${rt != null ? rt.toFixed(3) : 'N/A'}`, bold: false, color: '#f87171' });
            lines.push({ text: `  Ratio: ${rr != null ? (rr * 100).toFixed(1) + '%' : 'N/A'}`, bold: false, color: '#fca5a5' });
        }
    }

    const lineHeight = 18;
    const tooltipWidth = 280;
    const tooltipHeight = lines.length * lineHeight + 16;
    let tooltipX = cx + 20;
    let tooltipY = padding.top + 20;

    if (tooltipX + tooltipWidth > canvas.width - padding.right) {
        tooltipX = cx - tooltipWidth - 20;
    }
    if (tooltipY + tooltipHeight > padding.top + chartHeight) {
        tooltipY = padding.top + chartHeight - tooltipHeight - 10;
    }

    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tooltipX - 8, tooltipY - 8, tooltipWidth, tooltipHeight, 6);
    ctx.fill();
    ctx.stroke();

    let currentY = tooltipY + 4;
    lines.forEach(line => {
        ctx.font = line.bold ? 'bold 12px "JetBrains Mono", monospace' : '12px "JetBrains Mono", monospace';
        ctx.fillStyle = line.color;
        ctx.textAlign = 'left';
        ctx.fillText(line.text, tooltipX, currentY + 12);
        currentY += lineHeight;
    });

    const totalBarSlots = isSingleMode ? pairCount : 2 * pairCount;
    const singleBarWidth = Math.min(groupWidth / (totalBarSlots + 1), 30);
    const intraGap = Math.min(singleBarWidth * 0.15, 3);
    const leftBlockWidth = pairCount * singleBarWidth + (pairCount - 1) * intraGap;
    const interGroupGap = isSingleMode ? 0 : Math.min(singleBarWidth * 0.5, 6);
    const leftBlockStart = isSingleMode
        ? cx - leftBlockWidth / 2
        : cx - leftBlockWidth - interGroupGap / 2;

    for (let p = 0; p < pairCount; p++) {
        const lt = leftOp?.pairs?.[p]?.time;
        if (lt != null) {
            const y = yTimePos(lt);
            const barX = leftBlockStart + p * (singleBarWidth + intraGap);
            ctx.beginPath();
            ctx.arc(barX + singleBarWidth / 2, y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = '#0f172a';
            ctx.fill();
            ctx.strokeStyle = '#00d4aa';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    if (!isSingleMode) {
        const rightBlockStart = cx + interGroupGap / 2;
        for (let p = 0; p < pairCount; p++) {
            const rt = rightOp?.pairs?.[p]?.time;
            if (rt != null) {
                const y = yTimePos(rt);
                const barX = rightBlockStart + p * (singleBarWidth + intraGap);
                ctx.beginPath();
                ctx.arc(barX + singleBarWidth / 2, y, 4, 0, 2 * Math.PI);
                ctx.fillStyle = '#0f172a';
                ctx.fill();
                ctx.strokeStyle = '#f87171';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }
};

window.renderOpChartCurrent = function(canvasId, stateObj) {
    const leftOps = new Map(stateObj.leftData.map(d => [d.operator, d]));
    const rightOps = stateObj.rightData && stateObj.rightData.length > 0
        ? new Map(stateObj.rightData.map(d => [d.operator, d]))
        : new Map();
    const leftLabel = stateObj.leftDate || stateObj.leftLabel || '';
    const rightLabel = stateObj.rightDate || stateObj.rightLabel || '';
    window.renderOpChart(stateObj.operators, leftOps, rightOps, leftLabel, rightLabel, 1, canvasId, stateObj);
};

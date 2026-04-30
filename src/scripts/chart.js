let data = {};
let extraFields = [];
let allExtraFieldsCache = {};
let chartMode = 'normal';
let currentPanel = 'trends';
let opChartMode = 'single';
let chartChoices = {};

function addChoicesInputId(selectId, inputId) {
    const select = document.getElementById(selectId);
    if (select) {
        const container = select.closest('.choices');
        if (container) {
            const searchInput = container.querySelector('.choices__input--cloned');
            if (searchInput) {
                searchInput.id = inputId;
                searchInput.name = inputId;
            }
        }
    }
}

let chartState = {
    datasets: [],
    labels: [],
    benchmark: '',
    yAxis: '',
    padding: null,
    chartWidth: 0,
    chartHeight: 0,
    xPosition: null,
    yPosition: null,
    highlightAnnotations: [],
    animationId: null
};

let opDataHierarchyCache = null;

async function getOpDataHierarchy() {
    if (opDataHierarchyCache) {
        return opDataHierarchyCache;
    }
    const allData = await loadAllOperatorsData();
    const hierarchy = {};
    for (const [benchmark, vendors] of Object.entries(allData)) {
        hierarchy[benchmark] = {};
        for (const [vendor, configs] of Object.entries(vendors)) {
            const validConfigs = [];
            for (const [config, dates] of Object.entries(configs)) {
                let hasData = false;
                for (const dateArr of Object.values(dates)) {
                    if (Array.isArray(dateArr) && dateArr.some(item => item && (Array.isArray(item) ? item.length > 0 : Object.keys(item).length > 0))) {
                        hasData = true;
                        break;
                    }
                }
                if (hasData) {
                    validConfigs.push(config);
                }
            }
            if (validConfigs.length > 0) {
                hierarchy[benchmark][vendor] = validConfigs;
            }
        }
        if (Object.keys(hierarchy[benchmark]).length === 0) {
            delete hierarchy[benchmark];
        }
    }
    opDataHierarchyCache = hierarchy;
    return hierarchy;
}

function clearOpDataHierarchyCache() {
    opDataHierarchyCache = null;
}

const COLORS = [
    { line: '#00d4aa', fill: 'rgba(0, 212, 170, 0.12)' },
    { line: '#f87171', fill: 'rgba(248, 113, 113, 0.12)' },
    { line: '#38bdf8', fill: 'rgba(56, 189, 248, 0.12)' },
    { line: '#fbbf24', fill: 'rgba(251, 191, 36, 0.12)' },
    { line: '#c084fc', fill: 'rgba(192, 132, 252, 0.12)' },
    { line: '#a3e635', fill: 'rgba(163, 230, 53, 0.12)' },
    { line: '#fb923c', fill: 'rgba(251, 146, 60, 0.12)' },
    { line: '#22d3ee', fill: 'rgba(34, 211, 238, 0.12)' },
    { line: '#f472b6', fill: 'rgba(244, 114, 182, 0.12)' },
    { line: '#34d399', fill: 'rgba(52, 211, 153, 0.12)' },
    { line: '#818cf8', fill: 'rgba(129, 140, 248, 0.12)' },
    { line: '#facc15', fill: 'rgba(250, 204, 21, 0.12)' }
];

document.addEventListener('DOMContentLoaded', async () => {
    await initDatabase();
    await refreshDataAndFields();
    setupEventListeners();
    setupOperatorsEventListeners();

    const chOpts = { searchEnabled: true, searchPlaceholderValue: 'Search...',
        shouldSort: false, itemSelectText: '', allowHTML: false };
    chartChoices.benchmark = new Choices(document.getElementById('chartBenchmarkSelect'), { ...chOpts, placeholderValue: '-- Select Benchmark --' });
    chartChoices.opBenchmark = new Choices(document.getElementById('opBenchmarkSelect'), { ...chOpts, placeholderValue: '-- Select Benchmark --' });
    chartChoices.opVendor = new Choices(document.getElementById('opVendorSelect'), { ...chOpts, placeholderValue: '-- Select Arch --' });
    chartChoices.opConfig = new Choices(document.getElementById('opConfigSelect'), { ...chOpts, placeholderValue: '-- Select Configuration --' });
    chartChoices.yAxis = new Choices(document.getElementById('yAxisSelect'), { ...chOpts, placeholderValue: 'Duration (ms)' });
    chartChoices.opDateLeft = new Choices(document.getElementById('opDateLeft'), { ...chOpts, placeholderValue: '-- Select Date --' });
    chartChoices.opDateRight = new Choices(document.getElementById('opDateRight'), { ...chOpts, placeholderValue: '-- Select Date --' });
    chartChoices.opVendor.disable();
    chartChoices.opConfig.disable();
    chartChoices.opDateLeft.disable();
    chartChoices.opDateRight.disable();

    addChoicesInputId('chartBenchmarkSelect', 'choices-search-chart-benchmark');
    addChoicesInputId('opBenchmarkSelect', 'choices-search-op-benchmark');
    addChoicesInputId('opVendorSelect', 'choices-search-op-vendor');
    addChoicesInputId('opConfigSelect', 'choices-search-op-config');
    addChoicesInputId('yAxisSelect', 'choices-search-y-axis');
    addChoicesInputId('opDateLeft', 'choices-search-op-date-left');
    addChoicesInputId('opDateRight', 'choices-search-op-date-right');

    populateBenchmarkSelect();
    populateYAxisSelect();
    await populateOpBenchmarkSelect();

    initPanelFromUrl();
});

async function refreshDataAndFields() {
    try {
        data = await loadBenchmarkData() || {};
        allExtraFieldsCache = await loadAllExtraFields() || {};
    } catch (error) {
        data = {};
        allExtraFieldsCache = {};
    }
}

document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
        await refreshDataAndFields();
        populateBenchmarkSelect();
        populateYAxisSelect();
        await populateOpBenchmarkSelect();
    }
});

window.addEventListener('benchmarkDataImported', async () => {
    clearOpDataHierarchyCache();
    await refreshDataAndFields();
    populateBenchmarkSelect();
    populateYAxisSelect();
    await populateOpBenchmarkSelect();
});

window.addEventListener('benchmarkDataChanged', async () => {
    clearOpDataHierarchyCache();
    await refreshDataAndFields();
    populateBenchmarkSelect();
    populateYAxisSelect();
    await populateOpBenchmarkSelect();
});

function getExtraFieldsForVendor(benchmark, vendor) {
    return allExtraFieldsCache[benchmark]?.[vendor] || [];
}

function getExtraFieldsUnionForVendors(benchmark, vendors) {
    const fieldsMap = new Map();
    vendors.forEach(vendor => {
        const vendorFields = getExtraFieldsForVendor(benchmark, vendor);
        vendorFields.forEach(field => {
            if (!fieldsMap.has(field.id)) {
                fieldsMap.set(field.id, { id: field.id, name: field.name, type: field.type || 'float' });
            }
        });
    });
    return Array.from(fieldsMap.values());
}

function getExtraFieldsIntersectionForVendors(benchmark, vendors) {
    if (vendors.length === 0) return [];

    let intersection = null;
    vendors.forEach(vendor => {
        const vendorFields = getExtraFieldsForVendor(benchmark, vendor);
        const vendorFieldIds = new Set(vendorFields.map(f => f.id));

        if (intersection === null) {
            intersection = vendorFieldIds;
        } else {
            intersection = new Set([...intersection].filter(id => vendorFieldIds.has(id)));
        }
    });

    if (!intersection || intersection.size === 0) return [];

    const firstVendorFields = getExtraFieldsForVendor(benchmark, vendors[0]);
    return firstVendorFields
        .filter(f => intersection.has(f.id))
        .map(f => ({ id: f.id, name: f.name, type: f.type || 'float' }));
}

function populateYAxisSelect() {
    const items = [{ value: 'duration', label: 'Duration (ms)' }];
    extraFields.forEach(field => {
        const fieldType = field.type || 'float';
        if (fieldType !== 'string') {
            items.push({ value: 'extra_' + field.id, label: field.name });
        }
    });

    const savedYAxis = chartState.yAxis || document.getElementById('yAxisSelect')?.value || 'duration';

    if (chartChoices.yAxis) {
        chartChoices.yAxis.clearStore();
        chartChoices.yAxis.setChoices(items, 'value', 'label', true);
        const validValues = items.map(i => i.value);
        if (validValues.includes(savedYAxis)) {
            chartChoices.yAxis.setChoiceByValue(savedYAxis);
        } else {
            chartChoices.yAxis.setChoiceByValue('duration');
            chartState.yAxis = 'duration';
        }
    } else {
        const yAxisSelect = document.getElementById('yAxisSelect');
        yAxisSelect.innerHTML = '';
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.value;
            option.textContent = item.label;
            yAxisSelect.appendChild(option);
        });
        const validValues = items.map(i => i.value);
        yAxisSelect.value = validValues.includes(savedYAxis) ? savedYAxis : 'duration';
        if (!validValues.includes(savedYAxis)) {
            chartState.yAxis = 'duration';
        }
    }
}

window.updateChartYAxisOptions = async function(benchmark, vendor) {
    if (benchmark && vendor) {
        extraFields = getExtraFieldsForVendor(benchmark, vendor);
    }
    populateYAxisSelect();
};

function setupEventListeners() {
    document.getElementById('chartBenchmarkSelect').addEventListener('change', onBenchmarkChange);
    document.getElementById('drawChartBtn').addEventListener('click', function() {
        this.classList.remove('btn-pulse');
        void this.offsetWidth;
        this.classList.add('btn-pulse');
        enterFullscreen();
    });
    document.getElementById('selectAllBtn').addEventListener('click', selectAll);
    document.getElementById('deselectAllBtn').addEventListener('click', deselectAll);

    const canvas = document.getElementById('chartCanvas');
    canvas.addEventListener('mousemove', function(e) {
        if (chartMode === 'operators') {
            onOpCanvasMouseMove(e);
        } else {
            onCanvasMouseMove(e);
        }
    });
    canvas.addEventListener('mouseleave', function(e) {
        if (chartMode === 'operators') {
            if (opChartState.operators.length === 0) return;
            renderOpChartCurrent();
        } else {
            onCanvasMouseLeave();
        }
    });

    document.getElementById('chartFullscreen').addEventListener('click', exitFullscreen);
}

function populateBenchmarkSelect() {
    const items = Object.keys(data).sort().map(b => ({ value: b, label: b }));
    chartChoices.benchmark.clearStore();
    chartChoices.benchmark.setChoices(items, 'value', 'label', true);
}

function toggleVendor(vendorId) {
    const content = document.getElementById(`vendor-content-${vendorId}`);
    const arrow = document.getElementById(`vendor-arrow-${vendorId}`);
    if (content.style.display === 'none') {
        content.style.display = 'block';
        arrow.textContent = '▼';
    } else {
        content.style.display = 'none';
        arrow.textContent = '▶';
    }
}

function onBenchmarkChange() {
    const benchmark = document.getElementById('chartBenchmarkSelect').value;
    const selectionPanel = document.getElementById('selectionPanel');
    const vendorConfigurationCheckboxes = document.getElementById('vendorConfigurationCheckboxes');
    const drawChartBtn = document.getElementById('drawChartBtn');

    if (!benchmark) {
        selectionPanel.style.display = 'none';
        drawChartBtn.disabled = true;
        extraFields = [];
        populateYAxisSelect();
        return;
    }

    selectionPanel.style.display = 'block';
    drawChartBtn.disabled = true;

    vendorConfigurationCheckboxes.innerHTML = '';

    if (!data[benchmark]) {
        vendorConfigurationCheckboxes.innerHTML = '<p class="empty-message">No data for this Benchmark</p>';
        return;
    }

    const vendors = Object.keys(data[benchmark]).sort();

    vendors.forEach((vendor, vendorIndex) => {
        const vendorDiv = document.createElement('div');
        vendorDiv.className = 'vendor-section';

        const vendorHeader = document.createElement('div');
        vendorHeader.className = 'vendor-header';

        const vendorCheckbox = document.createElement('div');
        vendorCheckbox.className = 'checkbox-item';
        vendorCheckbox.innerHTML = `
            <input type="checkbox" id="vendor_${vendorIndex}" value="${vendor}" onchange="onVendorCheckboxChange('${vendor}')">
            <label for="vendor_${vendorIndex}">${vendor}</label>
        `;
        vendorHeader.appendChild(vendorCheckbox);

        const collapseBtn = document.createElement('button');
        collapseBtn.type = 'button';
        collapseBtn.className = 'collapse-btn';
        collapseBtn.id = `vendor-arrow-${vendorIndex}`;
        collapseBtn.textContent = '▼';
        collapseBtn.onclick = () => toggleVendor(`${vendorIndex}`);
        vendorHeader.appendChild(collapseBtn);

        vendorDiv.appendChild(vendorHeader);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'configuration-content';
        contentDiv.id = `vendor-content-${vendorIndex}`;

        const configurationList = document.createElement('div');
        configurationList.className = 'configuration-list';

        const configurations = Object.keys(data[benchmark][vendor]).sort();
        configurations.forEach((configuration) => {
            if (data[benchmark][vendor][configuration].length > 0) {
                const configurationCheckbox = document.createElement('div');
                configurationCheckbox.className = 'checkbox-item';
                configurationCheckbox.innerHTML = `
                    <input type="checkbox" class="configuration-checkbox" data-vendor="${vendor}" data-configuration="${configuration}" onchange="onConfigurationCheckboxChange(this)">
                    <label>${configuration}</label>
                `;
                configurationList.appendChild(configurationCheckbox);
            }
        });

        contentDiv.appendChild(configurationList);
        vendorDiv.appendChild(contentDiv);
        vendorConfigurationCheckboxes.appendChild(vendorDiv);
    });

    if (vendorConfigurationCheckboxes.children.length === 0) {
        vendorConfigurationCheckboxes.innerHTML = '<p class="empty-message">No data for this Benchmark</p>';
    }
}

function onVendorCheckboxChange(vendor) {
    const checkbox = document.getElementById(`vendor_${Object.keys(data[document.getElementById('chartBenchmarkSelect').value]).sort().indexOf(vendor)}`);
    const configurationCheckboxes = document.querySelectorAll(`.configuration-checkbox[data-vendor="${vendor}"]`);
    configurationCheckboxes.forEach(pc => {
        pc.checked = checkbox.checked;
    });

    updateDrawButtonState();
    updateExtraFieldsFromSelection();
}

function onConfigurationCheckboxChange(configurationCheckbox) {
    const vendor = configurationCheckbox.dataset.vendor;
    const allConfigurationCheckboxes = document.querySelectorAll(`.configuration-checkbox[data-vendor="${vendor}"]`);
    const anyChecked = Array.from(allConfigurationCheckboxes).some(cb => cb.checked);

    const vendorIndex = Object.keys(data[document.getElementById('chartBenchmarkSelect').value]).sort().indexOf(vendor);
    const vendorCheckbox = document.getElementById(`vendor_${vendorIndex}`);
    vendorCheckbox.checked = anyChecked;

    updateDrawButtonState();
    updateExtraFieldsFromSelection();
}

function updateExtraFieldsFromSelection() {
    const benchmark = document.getElementById('chartBenchmarkSelect').value;
    const selectedVendors = new Set();
    document.querySelectorAll('.configuration-checkbox:checked').forEach(cb => {
        selectedVendors.add(cb.dataset.vendor);
    });

    if (selectedVendors.size > 0) {
        const vendors = Array.from(selectedVendors);
        if (selectedVendors.size === 1) {
            extraFields = getExtraFieldsUnionForVendors(benchmark, vendors);
        } else {
            extraFields = getExtraFieldsIntersectionForVendors(benchmark, vendors);
        }
    } else {
        extraFields = [];
    }

    populateYAxisSelect();
}

function updateDrawButtonState() {
    const selectedItems = document.querySelectorAll('.configuration-checkbox:checked');
    document.getElementById('drawChartBtn').disabled = selectedItems.length === 0;
}

function selectAll() {
    document.querySelectorAll('.configuration-checkbox').forEach(cb => cb.checked = true);
    document.querySelectorAll('[id^="vendor_"]').forEach(cb => cb.checked = true);
    updateDrawButtonState();
    updateExtraFieldsFromSelection();
}

function deselectAll() {
    document.querySelectorAll('.configuration-checkbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('[id^="vendor_"]').forEach(cb => cb.checked = false);
    updateDrawButtonState();
    updateExtraFieldsFromSelection();
}

function enterFullscreen() {
    chartMode = 'normal';
    document.getElementById('mainContainer').style.display = 'none';
    document.getElementById('chartFullscreen').classList.add('visible');
    updateExtraFieldsFromSelection();
    drawChart();
}

function exitFullscreen() {
    document.getElementById('chartFullscreen').classList.remove('visible');
    document.getElementById('mainContainer').style.display = 'block';
}

function drawChart() {
    const benchmark = document.getElementById('chartBenchmarkSelect').value;
    const yAxis = document.getElementById('yAxisSelect').value;
    const selectedItems = document.querySelectorAll('.configuration-checkbox:checked');

    const datasets = [];
    let colorIndex = 0;

    selectedItems.forEach(item => {
        const vendor = item.dataset.vendor;
        const configuration = item.dataset.configuration;
        const records = data[benchmark][vendor][configuration];

        const sortedRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));

        const dataPoints = sortedRecords.map(r => {
            if (yAxis === 'duration') {
                return r.duration;
            } else if (yAxis.startsWith('extra_')) {
                const fieldId = yAxis.replace('extra_', '');
                return r.extras && r.extras[fieldId] ? r.extras[fieldId].value : 0;
            }
            return 0;
        });

        datasets.push({
            label: `${vendor} - ${configuration}`,
            dates: sortedRecords.map(r => r.date),
            values: dataPoints,
            color: COLORS[colorIndex % COLORS.length]
        });

        colorIndex++;
    });

    const allLabels = [...new Set(datasets.flatMap(d => d.dates))].sort();

    chartState.datasets = datasets;
    chartState.labels = allLabels;
    chartState.benchmark = benchmark;
    chartState.yAxis = yAxis;

    animateChart(datasets, allLabels, yAxis, benchmark);
}

function animateChart(datasets, labels, yAxis, benchmark) {
    if (chartState.animationId) {
        cancelAnimationFrame(chartState.animationId);
        chartState.animationId = null;
    }

    const duration = 800;
    const startTime = performance.now();

    function frame(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        renderChart(datasets, labels, yAxis, benchmark, eased);

        if (progress < 1) {
            chartState.animationId = requestAnimationFrame(frame);
        } else {
            chartState.animationId = null;
        }
    }

    chartState.animationId = requestAnimationFrame(frame);
}

function renderChart(datasets, labels, yAxis, benchmark, animProgress) {
    if (animProgress === undefined) animProgress = 1;

    const canvas = document.getElementById('chartCanvas');
    const ctx = canvas.getContext('2d');

    const container = document.getElementById('chartContainer');
    const rect = container.getBoundingClientRect();
    const padding = { top: 40, right: 50, bottom: 80, left: 100 };

    canvas.width = rect.width - 40 || window.innerWidth - 40;
    canvas.height = rect.height - 40 || window.innerHeight - 90;

    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;

    chartState.padding = padding;
    chartState.chartWidth = chartWidth;
    chartState.chartHeight = chartHeight;
    chartState.xPosition = (index) => padding.left + (chartWidth / (labels.length - 1 || 1)) * index;
    chartState.yPosition = (value) => {
        const maxVal = Math.max(...chartState.datasets.flatMap(d => d.values), 0);
        const minVal = Math.min(...chartState.datasets.flatMap(d => d.values), 0);
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
    extraFields.forEach(field => {
        titleMap['extra_' + field.id] = field.name;
    });

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

    chartState.highlightAnnotations = [];

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

        chartState.highlightAnnotations.push({ x: tagX, y: tagY, width: tagWidth, height: tagHeight });
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
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
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
}

function measureTextRows(ctx, text, maxWidth) {
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
}

function onCanvasMouseMove(e) {
    if (chartState.labels.length === 0) return;

    const canvas = document.getElementById('chartCanvas');
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { padding, chartWidth, chartHeight, labels, datasets, xPosition } = chartState;

    if (mouseX < padding.left || mouseX > padding.left + chartWidth ||
        mouseY < padding.top || mouseY > padding.top + chartHeight) {
        renderChart(datasets, labels, chartState.yAxis, chartState.benchmark);
        return;
    }

    const relativeX = mouseX - padding.left;
    const nearestIndex = Math.round(relativeX / (chartWidth / (labels.length - 1 || 1)));
    const clampedIndex = Math.max(0, Math.min(labels.length - 1, nearestIndex));
    const nearestLabel = labels[clampedIndex];
    const nearestX = xPosition(clampedIndex);

    let maxValue = Math.max(...datasets.flatMap(d => d.values), 0);
    let minValue = Math.min(...datasets.flatMap(d => d.values), 0);
    const valueRange = maxValue - minValue || 1;
    const yMargin = valueRange * 0.1;
    maxValue += yMargin;
    minValue = Math.max(0, minValue - yMargin);

    const actualYPosition = (value) => padding.top + chartHeight - ((value - minValue) / (maxValue - minValue || 1)) * chartHeight;

    renderChart(datasets, labels, chartState.yAxis, chartState.benchmark);

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
        extraFields.forEach(field => {
            titleMap['extra_' + field.id] = field.name;
        });

        const maxLabelWidth = Math.max(
            ...dataPointsAtNearestDate.map(p => ctx.measureText(p.label).width),
            ctx.measureText(chartState.benchmark).width,
            ctx.measureText(titleMap[chartState.yAxis] || chartState.yAxis).width
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
        const rows0 = measureTextRows(ctx, chartState.benchmark, textMaxWidth);
        const rows1 = measureTextRows(ctx, titleMap[chartState.yAxis] || chartState.yAxis, textMaxWidth);
        const rows2 = measureTextRows(ctx, nearestLabel, textMaxWidth);

        let measuredY = tooltipY + 10 + (rows0 + rows1 + rows2) * lineHeight + 10;
        const dataRows = [];
        dataPointsAtNearestDate.forEach((point) => {
            ctx.font = '12px "JetBrains Mono", monospace';
            const text = `${point.label}: ${point.value.toFixed(3)}`;
            const textRows = measureTextRows(ctx, text, textMaxWidth - 18);
            dataRows.push(textRows);
            measuredY += Math.max(textRows * lineHeight, 20);
        });

        const tooltipHeight = measuredY - tooltipY + 10;

        const annotations = chartState.highlightAnnotations || [];
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
        wrapText(ctx, chartState.benchmark, tooltipX, tooltipY + 10, textMaxWidth, lineHeight);
        wrapText(ctx, titleMap[chartState.yAxis] || chartState.yAxis, tooltipX, tooltipY + 10 + rows0 * lineHeight, textMaxWidth, lineHeight);
        wrapText(ctx, nearestLabel, tooltipX, tooltipY + 10 + (rows0 + rows1) * lineHeight, textMaxWidth, lineHeight);

        let currentY = tooltipY + 10 + (rows0 + rows1 + rows2) * lineHeight + 10;
        dataPointsAtNearestDate.forEach((point, i) => {
            ctx.font = '12px "JetBrains Mono", monospace';
            ctx.fillStyle = point.color;
            ctx.beginPath();
            ctx.roundRect(tooltipX, currentY - 8, 12, 12, 2);
            ctx.fill();

            ctx.fillStyle = '#e2e8f0';
            const text = `${point.label}: ${point.value.toFixed(3)}`;
            wrapText(ctx, text, tooltipX + 18, currentY, textMaxWidth - 18, lineHeight);
            currentY += Math.max(dataRows[i] * lineHeight, 20);
        });
    }
}

function onCanvasMouseLeave() {
    if (chartState.labels.length === 0) return;
    renderChart(chartState.datasets, chartState.labels, chartState.yAxis, chartState.benchmark);
}

window.addEventListener('resize', () => {
    if (document.getElementById('chartFullscreen').classList.contains('visible')) {
        if (chartMode === 'operators') {
            drawOpChart();
        } else {
            drawChart();
        }
    }
});

let opChartState = {
    leftData: null,
    rightData: null,
    leftDate: '',
    rightDate: '',
    benchmark: '',
    vendor: '',
    configuration: '',
    operators: [],
    maxPairCount: 1,
    isSingleMode: false,
    padding: null,
    chartWidth: 0,
    chartHeight: 0,
    animationId: null
};

function setupOperatorsEventListeners() {
    document.getElementById('opBenchmarkSelect').addEventListener('change', onOpBenchmarkChange);
    document.getElementById('opVendorSelect').addEventListener('change', onOpVendorChange);
    document.getElementById('opConfigSelect').addEventListener('change', onOpConfigChange);
    document.getElementById('opDateLeft').addEventListener('change', onOpDateChange);
    document.getElementById('opDateRight').addEventListener('change', onOpDateChange);
    document.getElementById('opDrawBtn').addEventListener('click', function() {
        this.classList.remove('btn-pulse');
        void this.offsetWidth;
        this.classList.add('btn-pulse');
        enterOpFullscreen();
    });

    window.setOpMode('single');
}

window.setOpMode = function(mode) {
    opChartMode = mode;
    document.getElementById('opModeSingle').classList.toggle('active', mode === 'single');
    document.getElementById('opModeCompare').classList.toggle('active', mode === 'compare');

    const rightGroup = document.getElementById('opDateRightGroup');
    const leftLabel = document.getElementById('opDateLeftLabel');

    if (mode === 'single') {
        rightGroup.style.display = 'none';
        leftLabel.textContent = 'Date:';
    } else {
        rightGroup.style.display = '';
        leftLabel.textContent = 'Date (Left):';
    }

    onOpDateChange();
};

async function populateOpBenchmarkSelect() {
    const opHierarchy = await getOpDataHierarchy();
    const benchmarks = Object.keys(opHierarchy).sort();
    const items = benchmarks.map(b => ({ value: b, label: b }));
    chartChoices.opBenchmark.clearStore();
    chartChoices.opBenchmark.setChoices(items, 'value', 'label', true);
}

async function onOpBenchmarkChange() {
    const benchmark = document.getElementById('opBenchmarkSelect').value;

    chartChoices.opVendor.clearStore();
    chartChoices.opConfig.clearStore();
    chartChoices.opConfig.disable();
    chartChoices.opDateLeft.clearStore();
    chartChoices.opDateLeft.disable();
    chartChoices.opDateRight.clearStore();
    chartChoices.opDateRight.disable();
    if (benchmark) chartChoices.opVendor.enable(); else chartChoices.opVendor.disable();
    document.getElementById('opDrawBtn').disabled = true;

    if (benchmark) {
        const opHierarchy = await getOpDataHierarchy();
        const vendors = opHierarchy[benchmark] ? Object.keys(opHierarchy[benchmark]).sort() : [];
        const vItems = vendors.map(v => ({ value: v, label: v }));
        chartChoices.opVendor.setChoices(vItems, 'value', 'label', true);
    }
}

async function onOpVendorChange() {
    const benchmark = document.getElementById('opBenchmarkSelect').value;
    const vendor = document.getElementById('opVendorSelect').value;

    chartChoices.opConfig.clearStore();
    if (vendor) chartChoices.opConfig.enable(); else chartChoices.opConfig.disable();
    chartChoices.opDateLeft.clearStore();
    chartChoices.opDateLeft.disable();
    chartChoices.opDateRight.clearStore();
    chartChoices.opDateRight.disable();
    document.getElementById('opDrawBtn').disabled = true;

    if (benchmark && vendor) {
        const opHierarchy = await getOpDataHierarchy();
        const configs = opHierarchy[benchmark]?.[vendor] || [];
        const cItems = configs.map(c => ({ value: c, label: c }));
        chartChoices.opConfig.setChoices(cItems, 'value', 'label', true);
    }
}

async function onOpConfigChange() {
    const benchmark = document.getElementById('opBenchmarkSelect').value;
    const vendor = document.getElementById('opVendorSelect').value;
    const configuration = document.getElementById('opConfigSelect').value;

    chartChoices.opDateLeft.clearStore();
    chartChoices.opDateRight.clearStore();
    document.getElementById('opDrawBtn').disabled = true;

    if (!benchmark || !vendor || !configuration) {
        chartChoices.opDateLeft.disable();
        chartChoices.opDateRight.disable();
        return;
    }

    const dateEntries = await getOperatorsDatesForConfig(benchmark, vendor, configuration);

    if (dateEntries.length === 0) {
        chartChoices.opDateLeft.disable();
        chartChoices.opDateRight.disable();
        return;
    }
    chartChoices.opDateLeft.enable();
    chartChoices.opDateRight.enable();

    const dateItems = dateEntries.map(entry => ({ value: entry.date + '|' + entry.index, label: entry.label }));
    chartChoices.opDateLeft.setChoices(dateItems, 'value', 'label', true);
    chartChoices.opDateRight.setChoices(dateItems, 'value', 'label', true);
}

async function onOpDateChange() {
    const dateLeft = document.getElementById('opDateLeft').value;
    const dateRight = document.getElementById('opDateRight').value;

    if (opChartMode === 'single') {
        if (!dateLeft) {
            document.getElementById('opDrawBtn').disabled = true;
            return;
        }
        const benchmark = document.getElementById('opBenchmarkSelect').value;
        const vendor = document.getElementById('opVendorSelect').value;
        const configuration = document.getElementById('opConfigSelect').value;
        const [leftDate, leftIdx] = dateLeft.split('|');
        const leftData = await getOperatorsDataForRecord(benchmark, vendor, configuration, leftDate, parseInt(leftIdx));
        document.getElementById('opDrawBtn').disabled = !leftData;
    } else {
        if (!dateLeft || !dateRight) {
            document.getElementById('opDrawBtn').disabled = true;
            return;
        }
        const benchmark = document.getElementById('opBenchmarkSelect').value;
        const vendor = document.getElementById('opVendorSelect').value;
        const configuration = document.getElementById('opConfigSelect').value;
        const [leftDate, leftIdx] = dateLeft.split('|');
        const [rightDate, rightIdx] = dateRight.split('|');
        const leftData = await getOperatorsDataForRecord(benchmark, vendor, configuration, leftDate, parseInt(leftIdx));
        const rightData = await getOperatorsDataForRecord(benchmark, vendor, configuration, rightDate, parseInt(rightIdx));
        document.getElementById('opDrawBtn').disabled = !leftData || !rightData;
    }
}

function enterOpFullscreen() {
    chartMode = 'operators';
    document.getElementById('mainContainer').style.display = 'none';
    document.getElementById('chartFullscreen').classList.add('visible');
    drawOpChart();
}

function drawOpChart() {
    const benchmark = document.getElementById('opBenchmarkSelect').value;
    const vendor = document.getElementById('opVendorSelect').value;
    const configuration = document.getElementById('opConfigSelect').value;
    const dateLeftVal = document.getElementById('opDateLeft').value;
    const dateRightVal = document.getElementById('opDateRight').value;

    const [leftDate, leftIdx] = dateLeftVal.split('|');

    if (opChartMode === 'single') {
        getOperatorsDataForRecord(benchmark, vendor, configuration, leftDate, parseInt(leftIdx)).then(leftData => {
            if (!leftData) return;

            const leftOps = new Map(leftData.map(d => [d.operator, d]));
            const allOperators = [...leftOps.keys()].sort();

            let maxPairCount = 0;
            for (const op of allOperators) {
                const lp = leftOps.get(op)?.pairs?.length || 0;
                if (lp > maxPairCount) maxPairCount = lp;
            }
            if (maxPairCount === 0) maxPairCount = 1;

            const leftLabel = document.getElementById('opDateLeft').selectedOptions[0]?.text || leftDate;

            opChartState.leftData = leftData;
            opChartState.rightData = [];
            opChartState.leftDate = leftLabel;
            opChartState.rightDate = '';
            opChartState.benchmark = benchmark;
            opChartState.vendor = vendor;
            opChartState.configuration = configuration;
            opChartState.operators = allOperators;
            opChartState.maxPairCount = maxPairCount;
            opChartState.isSingleMode = true;

            const rightOps = new Map();
            animateOpChart(allOperators, leftOps, rightOps, leftLabel, '');
        });
    } else {
        const [rightDate, rightIdx] = dateRightVal.split('|');

        getOperatorsDataForRecord(benchmark, vendor, configuration, leftDate, parseInt(leftIdx)).then(leftData => {
            getOperatorsDataForRecord(benchmark, vendor, configuration, rightDate, parseInt(rightIdx)).then(rightData => {
                if (!leftData || !rightData) return;

                const leftOps = new Map(leftData.map(d => [d.operator, d]));
                const rightOps = new Map(rightData.map(d => [d.operator, d]));
                const allOperators = [...new Set([...leftOps.keys(), ...rightOps.keys()])].sort();

                let maxPairCount = 0;
                for (const op of allOperators) {
                    const lp = leftOps.get(op)?.pairs?.length || 0;
                    const rp = rightOps.get(op)?.pairs?.length || 0;
                    const cnt = Math.max(lp, rp);
                    if (cnt > maxPairCount) maxPairCount = cnt;
                }
                if (maxPairCount === 0) maxPairCount = 1;

                const leftLabel = document.getElementById('opDateLeft').selectedOptions[0]?.text || leftDate;
                const rightLabel = document.getElementById('opDateRight').selectedOptions[0]?.text || rightDate;

                opChartState.leftData = leftData;
                opChartState.rightData = rightData;
                opChartState.leftDate = leftLabel;
                opChartState.rightDate = rightLabel;
                opChartState.benchmark = benchmark;
                opChartState.vendor = vendor;
                opChartState.configuration = configuration;
                opChartState.operators = allOperators;
                opChartState.maxPairCount = maxPairCount;
                opChartState.isSingleMode = false;

                animateOpChart(allOperators, leftOps, rightOps, leftLabel, rightLabel);
            });
        });
    }
}

function animateOpChart(allOperators, leftOps, rightOps, dateLeft, dateRight) {
    if (opChartState.animationId) {
        cancelAnimationFrame(opChartState.animationId);
        opChartState.animationId = null;
    }

    const duration = 800;
    const startTime = performance.now();

    function frame(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        renderOpChart(allOperators, leftOps, rightOps, dateLeft, dateRight, eased);

        if (progress < 1) {
            opChartState.animationId = requestAnimationFrame(frame);
        } else {
            opChartState.animationId = null;
        }
    }

    opChartState.animationId = requestAnimationFrame(frame);
}

function renderOpChart(allOperators, leftOps, rightOps, dateLeft, dateRight, animProgress) {
    if (animProgress === undefined) animProgress = 1;

    const canvas = document.getElementById('chartCanvas');
    const ctx = canvas.getContext('2d');

    const container = document.getElementById('chartContainer');
    const rect = container.getBoundingClientRect();
    const padding = { top: 60, right: 80, bottom: 160, left: 100 };

    canvas.width = rect.width - 40 || window.innerWidth - 40;
    canvas.height = rect.height - 40 || window.innerHeight - 90;

    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;

    opChartState.padding = padding;
    opChartState.chartWidth = chartWidth;
    opChartState.chartHeight = chartHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (allOperators.length === 0) {
        ctx.font = '15px "Outfit", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText('No Operators Data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const isSingleMode = opChartState.isSingleMode;
    const maxPairCount = opChartState.maxPairCount || 1;
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
}

function onOpCanvasMouseMove(e) {
    if (opChartState.operators.length === 0) return;

    const canvas = document.getElementById('chartCanvas');
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { padding, chartWidth, chartHeight, operators, leftData, rightData, leftDate, rightDate, maxPairCount, isSingleMode } = opChartState;

    if (mouseX < padding.left || mouseX > padding.left + chartWidth ||
        mouseY < padding.top || mouseY > padding.top + chartHeight) {
        renderOpChartCurrent();
        return;
    }

    const groupWidth = chartWidth / operators.length;
    const nearestIndex = Math.floor((mouseX - padding.left) / groupWidth);
    const clampedIndex = Math.max(0, Math.min(operators.length - 1, nearestIndex));

    const leftOps = new Map(leftData.map(d => [d.operator, d]));
    const rightOps = new Map(rightData.map(d => [d.operator, d]));

    renderOpChartCurrent();

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
}

function renderOpChartCurrent() {
    const leftOps = new Map(opChartState.leftData.map(d => [d.operator, d]));
    const rightOps = opChartState.rightData && opChartState.rightData.length > 0
        ? new Map(opChartState.rightData.map(d => [d.operator, d]))
        : new Map();
    renderOpChart(opChartState.operators, leftOps, rightOps, opChartState.leftDate, opChartState.rightDate, 1);
}

function initPanelFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const panel = params.get('panel');
    currentPanel = '';
    if (panel === 'compare') {
        switchPanel('compare');
    } else {
        switchPanel('trends');
    }
}

window.switchPanel = function(panelId) {
    if (currentPanel === panelId) return;
    currentPanel = panelId;
    const trendPanel = document.getElementById('trendPanel');
    const comparePanel = document.getElementById('comparePanel');

    trendPanel.style.display = 'none';
    comparePanel.style.display = 'none';

    if (panelId === 'compare') {
        comparePanel.classList.remove('panel-animate-in');
        comparePanel.style.display = 'block';
        void comparePanel.offsetWidth;
        comparePanel.classList.add('panel-animate-in');
    } else {
        trendPanel.classList.remove('panel-animate-in');
        trendPanel.style.display = 'block';
        void trendPanel.offsetWidth;
        trendPanel.classList.add('panel-animate-in');
    }

    updateSubTabActiveState(panelId);
};

function updateSubTabActiveState(panelId) {
    const tabBar = document.getElementById('subTabBar');
    if (!tabBar) return;
    tabBar.querySelectorAll('.sub-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.panel === panelId);
    });
}


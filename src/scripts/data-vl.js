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
            window.onOpChartMouseMove(e, 'chartCanvas', opChartState);
        } else {
            window.onLineChartMouseMove(e, 'chartCanvas', chartState);
        }
    });
    canvas.addEventListener('mouseleave', function(e) {
        if (chartMode === 'operators') {
            if (opChartState.operators.length === 0) return;
            window.renderOpChartCurrent('chartCanvas', opChartState);
        } else {
            window.onLineChartMouseLeave('chartCanvas', chartState);
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

    window.animateLineChart(datasets, allLabels, yAxis, benchmark, 'chartCanvas', chartState);
}

window.addEventListener('resize', () => {
    if (document.getElementById('chartFullscreen').classList.contains('visible')) {
        if (chartMode === 'operators') {
            drawOpChart();
        } else {
            window.animateLineChart(chartState.datasets, chartState.labels, chartState.yAxis, chartState.benchmark, 'chartCanvas', chartState);
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
            window.animateOpChart(allOperators, leftOps, rightOps, leftLabel, '', 'chartCanvas', opChartState);
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

                window.animateOpChart(allOperators, leftOps, rightOps, leftLabel, rightLabel, 'chartCanvas', opChartState);
            });
        });
    }
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


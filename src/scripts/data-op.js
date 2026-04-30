let data = {};
let editingRecord = null;
let extraFields = [];
let currentBenchmark = '';
let currentVendor = '';
let operatorsDateIndices = [];
let selectedOpRows = [];
let selectedSingleOpRow = null;
let sortStates = {
    date: 0,
    duration: 0
};
let dateFilter = '';
let pagination = {
    currentPage: 1,
    pageSize: 25,
    customPageSize: ''
};
let currentPanel = 'operations';
let choices = {};

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
let shouldAnimateTable = false;
let visibleExtraFieldIds = [];

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

let opCompareState = {
    leftData: null,
    rightData: null,
    leftLabel: '',
    rightLabel: '',
    operators: [],
    maxPairCount: 1,
    isSingleMode: false,
    padding: null,
    chartWidth: 0,
    chartHeight: 0,
    animationId: null
};

let trendState = {
    datasets: [],
    labels: [],
    yAxis: '',
    benchmark: '',
    padding: null,
    chartWidth: 0,
    chartHeight: 0,
    animationId: null,
    highlightAnnotations: []
};

let selectedTrendField = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initDatabase();
    await loadData();
    initApp();
});

window.addEventListener('benchmarkDataImported', async () => {
    await loadData();
    rebuildAllChoices();
});

window.addEventListener('benchmarkDataChanged', async () => {
    await loadData();
    rebuildAllChoices();
});

async function rebuildAllChoices() {
    populateBenchmarkSelects();
    if (choices.vendor) { choices.vendor.disable(); choices.vendor.clearStore(); }
    if (choices.configuration) { choices.configuration.disable(); choices.configuration.clearStore(); }
}

async function loadData() {
    try {
        data = await loadBenchmarkData() || {};
    } catch (error) {
        data = {};
    }
}

function initApp() {
    setupEventListeners();
    setupFormDirtyDetection();

    const choiceOpts = { searchEnabled: true, searchPlaceholderValue: 'Search...',
        shouldSort: false, itemSelectText: '', allowHTML: false };
    choices.benchmark = new Choices(document.getElementById('benchmarkSelect'), { ...choiceOpts, placeholderValue: '-- Select Benchmark --' });
    choices.vendor = new Choices(document.getElementById('vendorSelect'), { ...choiceOpts, placeholderValue: '-- Select Arch --' });
    choices.configuration = new Choices(document.getElementById('configurationSelect'), { ...choiceOpts, placeholderValue: '-- Select Configuration --' });
    choices.vendor.disable();
    choices.configuration.disable();

    addChoicesInputId('benchmarkSelect', 'choices-search-benchmark');
    addChoicesInputId('vendorSelect', 'choices-search-vendor');
    addChoicesInputId('configurationSelect', 'choices-search-configuration');

    choices.fieldFilter = new Choices(document.getElementById('fieldFilterSelect'), {
        removeItemButton: true,
        searchEnabled: true,
        searchPlaceholderValue: 'Search fields...',
        shouldSort: false,
        itemSelectText: '',
        allowHTML: false,
        placeholderValue: 'Select fields to display...',
        placeholder: true
    });
    choices.fieldFilter.disable();
    addChoicesInputId('fieldFilterSelect', 'choices-search-field-filter');
    setTimeout(syncFieldFilterPlaceholder, 100);

    document.getElementById('fieldFilterSelect').addEventListener('change', () => {
        const selected = choices.fieldFilter.getValue(true);
        visibleExtraFieldIds = Array.isArray(selected) ? selected.map(id => String(id)) : [];
        const activeSort = Object.keys(sortStates).find(key => sortStates[key] !== 0);
        if (activeSort && activeSort !== 'date' && activeSort !== 'duration'
            && visibleExtraFieldIds.length > 0 && !visibleExtraFieldIds.includes(String(activeSort))) {
            Object.keys(sortStates).forEach(key => { sortStates[key] = 0; });
        }
        syncFieldFilterPlaceholder();

        const applyBtn = document.getElementById('applyFieldFilterBtn');
        if (applyBtn) {
            applyBtn.disabled = false;
        }
    });

    const fieldFilterContainer = document.getElementById('fieldFilterSelect')?.closest('.choices');
    if (fieldFilterContainer) {
        fieldFilterContainer.addEventListener('focusin', () => {
            requestAnimationFrame(syncFieldFilterPlaceholder);
        });
    }

    populateBenchmarkSelects();
    document.getElementById('recordDate').value = getLocalDateString(new Date());
    initPanelFromUrl();
}

async function loadExtraFields() {
    try {
        return await loadAllExtraFields() || {};
    } catch (error) {
        return {};
    }
}

async function getExtraFieldsForVendor(benchmark, vendor) {
    const allVendorFields = await loadExtraFields();
    return allVendorFields[benchmark]?.[vendor] || [];
}

function syncFieldFilterPlaceholder() {
    const container = document.getElementById('fieldFilterSelect')?.closest('.choices');
    if (!container) return;
    const list = container.querySelector('.choices__list--multiple');
    const searchInput = container.querySelector('.choices__input--cloned');
    const hasItems = visibleExtraFieldIds.length > 0;
    if (list) {
        list.classList.toggle('has-items', hasItems);
    }
    if (searchInput) {
        if (hasItems) {
            searchInput.style.cssText = 'opacity:0!important;pointer-events:none!important;position:absolute!important;left:0!important;top:0!important;width:100%!important;height:100%!important;min-width:0!important;padding:0!important;margin:0!important;border:none!important;flex:none!important;overflow:hidden!important;display:block!important;z-index:-1!important;';
        } else {
            searchInput.style.cssText = '';
        }
    }
}

function updateFieldFilterChoices() {
    if (!choices.fieldFilter) return;
    const fieldItems = extraFields.map(f => ({ value: String(f.id), label: f.name }));
    choices.fieldFilter.clearStore();
    if (fieldItems.length > 0) {
        choices.fieldFilter.setChoices(fieldItems, 'value', 'label', true);
        choices.fieldFilter.enable();
    } else {
        choices.fieldFilter.disable();
    }
    visibleExtraFieldIds = [];
    choices.fieldFilter.removeActiveItems();
    setTimeout(syncFieldFilterPlaceholder, 0);
}

function applyFieldFilter() {
    shouldAnimateTable = true;
    displayRecords();
    syncFieldFilterPlaceholder();
    const applyBtn = document.getElementById('applyFieldFilterBtn');
    if (applyBtn) {
        applyBtn.disabled = true;
    }
}

async function saveData() {
    try {
        await dbSaveBenchmarkData(data);
    } catch (error) {
        alertError('Failed to save data');
    }
}

function setupEventListeners() {
    document.getElementById('benchmarkSelect').addEventListener('change', onBenchmarkChange);
    document.getElementById('vendorSelect').addEventListener('change', onVendorChange);
    document.getElementById('configurationSelect').addEventListener('change', onConfigurationChange);

    document.getElementById('addBenchmarkBtn').addEventListener('click', addBenchmark);
    document.getElementById('addVendorBtn').addEventListener('click', addVendor);
    document.getElementById('addConfigurationBtn').addEventListener('click', addConfiguration);

    document.getElementById('deleteBenchmarkBtn').addEventListener('click', deleteBenchmark);
    document.getElementById('deleteVendorBtn').addEventListener('click', deleteVendor);
    document.getElementById('deleteConfigurationBtn').addEventListener('click', deleteConfiguration);

    document.getElementById('saveRecordBtn').addEventListener('click', saveRecord);
    document.getElementById('clearFormBtn').addEventListener('click', clearForm);
    document.getElementById('loadXlsxBtn').addEventListener('click', loadExternalXlsx);

    document.getElementById('addFieldBtn').addEventListener('click', addExtraField);

    document.getElementById('recordsList').addEventListener('click', (e) => {
        if (e.target.classList.contains('trend-radio')) return;
        const th = e.target.closest('th');
        if (th && th.classList.contains('sortable')) {
            const fieldId = th.getAttribute('data-field');
            if (fieldId) {
                toggleSortInternal(fieldId);
            }
        }
    });

    document.getElementById('opCompareFullscreen').addEventListener('click', (e) => {
        if (e.target.id === 'opCompareCanvas') return;
        exitOpCompareFullscreen();
    });

    document.getElementById('opCompareCanvas').addEventListener('click', () => {
        exitOpCompareFullscreen();
    });

    document.getElementById('trendFullscreen').addEventListener('click', (e) => {
        if (e.target.id === 'trendCanvas') return;
        exitTrendFullscreen();
    });

    document.getElementById('trendCanvas').addEventListener('click', () => {
        exitTrendFullscreen();
    });

    document.getElementById('opCompareCanvas').addEventListener('mousemove', (e) => {
        window.onOpChartMouseMove(e, 'opCompareCanvas', opCompareState);
    });
    document.getElementById('opCompareCanvas').addEventListener('mouseleave', () => {
        if (opCompareState.operators.length > 0) {
            window.renderOpChartCurrent('opCompareCanvas', opCompareState);
        }
    });

    document.getElementById('trendCanvas').addEventListener('mousemove', (e) => {
        window.onLineChartMouseMove(e, 'trendCanvas', trendState);
    });
    document.getElementById('trendCanvas').addEventListener('mouseleave', () => {
        window.onLineChartMouseLeave('trendCanvas', trendState);
    });

    window.addEventListener('resize', () => {
        if (document.getElementById('opCompareFullscreen').classList.contains('visible')) {
            const leftOps = new Map(opCompareState.leftData.map(d => [d.operator, d]));
            const isSingleMode = !opCompareState.rightData || opCompareState.rightData.length === 0;
            if (isSingleMode) {
                const emptyRightOps = new Map();
                window.animateOpChart(opCompareState.operators, leftOps, emptyRightOps, opCompareState.leftLabel, '', 'opCompareCanvas', opCompareState);
            } else {
                const rightOps = new Map(opCompareState.rightData.map(d => [d.operator, d]));
                window.animateOpChart(opCompareState.operators, leftOps, rightOps, opCompareState.leftLabel, opCompareState.rightLabel, 'opCompareCanvas', opCompareState);
            }
        }
    });
}

function populateBenchmarkSelects() {
    const items = Object.keys(data).sort().map(b => ({ value: b, label: b }));
    choices.benchmark.clearStore();
    choices.benchmark.setChoices(items, 'value', 'label', true);
}

async function onBenchmarkChange() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    currentBenchmark = benchmark;
    currentVendor = '';

    choices.vendor.clearStore();
    choices.configuration.clearStore();
    choices.configuration.disable();
    if (benchmark) choices.vendor.enable(); else choices.vendor.disable();

    document.getElementById('newVendor').disabled = !benchmark;

    document.getElementById('addVendorBtn').disabled = !benchmark;
    document.getElementById('deleteBenchmarkBtn').disabled = !benchmark;
    document.getElementById('addConfigurationBtn').disabled = true;
    document.getElementById('deleteConfigurationBtn').disabled = true;
    document.getElementById('saveRecordBtn').disabled = true;
    document.getElementById('loadXlsxBtn').disabled = true;
    document.getElementById('addFieldBtn').disabled = true;
    document.getElementById('deleteVendorBtn').disabled = true;

    pagination.currentPage = 1;

    if (benchmark && data[benchmark]) {
        const vendorItems = Object.keys(data[benchmark]).sort().map(v => ({ value: v, label: v }));
        choices.vendor.setChoices(vendorItems, 'value', 'label', true);
    }

    extraFields = [];
    operatorsDateIndices = [];
    selectedOpRows = [];
    resetSubPanels();
    renderExtraFields();
    updateFieldFilterChoices();
    displayRecords();
    switchPanel('operations');
}

async function onVendorChange() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    currentVendor = vendor;

    choices.configuration.clearStore();
    if (vendor) choices.configuration.enable(); else choices.configuration.disable();

    document.getElementById('newConfiguration').disabled = !vendor;

    document.getElementById('addConfigurationBtn').disabled = !vendor;
    document.getElementById('deleteConfigurationBtn').disabled = !vendor;
    document.getElementById('saveRecordBtn').disabled = true;
    document.getElementById('loadXlsxBtn').disabled = true;
    document.getElementById('addFieldBtn').disabled = !vendor;
    document.getElementById('deleteVendorBtn').disabled = !vendor;

    pagination.currentPage = 1;

    if (benchmark && vendor && data[benchmark]?.[vendor]) {
        const configItems = Object.keys(data[benchmark][vendor]).sort().map(c => ({ value: c, label: c }));
        choices.configuration.setChoices(configItems, 'value', 'label', true);
    }

    extraFields = await getExtraFieldsForVendor(benchmark, vendor);
    operatorsDateIndices = [];
    selectedOpRows = [];
    resetSubPanels();
    renderExtraFields();
    updateFieldFilterChoices();
    displayRecords();
    switchPanel('operations');
}

async function onConfigurationChange() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;

    document.getElementById('saveRecordBtn').disabled = !configuration;
    document.getElementById('loadXlsxBtn').disabled = !configuration;
    document.getElementById('addFieldBtn').disabled = !configuration;

    pagination.currentPage = 1;

    if (benchmark && vendor && configuration) {
        operatorsDateIndices = [];
        selectedOpRows = [];
        loadOperatorsIndices(benchmark, vendor, configuration);
        updateSubmenuStates(true);
        renderExtraFields();
    } else {
        operatorsDateIndices = [];
        selectedOpRows = [];
        resetSubPanels();
        renderExtraFields();
        displayRecords();
        switchPanel('operations');
    }
}

async function loadOperatorsIndices(benchmark, vendor, configuration) {
    operatorsDateIndices = await getOperatorsDatesForConfig(benchmark, vendor, configuration);
    displayRecords();
}

async function addBenchmark() {
    const name = document.getElementById('newBenchmark').value.trim();
    if (!name) {
        alertError('Please enter Benchmark name');
        return;
    }
    if (data[name]) {
        alertError('Benchmark already exists');
        return;
    }

    data[name] = {};
    await saveData();
    populateBenchmarkSelects();

    choices.benchmark.setChoiceByValue(name);
    document.getElementById('newBenchmark').value = '';
    resetSubPanels();
    await onBenchmarkChange();
}

async function addVendor() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const name = document.getElementById('newVendor').value.trim();
    if (!name) {
        alertError('Please enter Arch name');
        return;
    }
    if (!data[benchmark]) {
        data[benchmark] = {};
    }
    if (data[benchmark][name]) {
        alertError('Arch already exists');
        return;
    }

    data[benchmark][name] = {};
    await saveData();

    const vItems = Object.keys(data[benchmark]).sort().map(v => ({ value: v, label: v }));
    choices.vendor.setChoices(vItems, 'value', 'label', true);
    choices.vendor.setChoiceByValue(name);
    document.getElementById('newVendor').value = '';
    resetSubPanels();
    await onVendorChange();
}

async function addConfiguration() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const name = document.getElementById('newConfiguration').value.trim();
    if (!name) {
        alertError('Please enter Configuration name');
        return;
    }
    if (!data[benchmark][vendor]) {
        data[benchmark][vendor] = {};
    }
    if (data[benchmark][vendor][name]) {
        alertError('Configuration already exists');
        return;
    }

    data[benchmark][vendor][name] = [];
    await saveData();

    const cItems = Object.keys(data[benchmark][vendor]).sort().map(c => ({ value: c, label: c }));
    choices.configuration.setChoices(cItems, 'value', 'label', true);
    choices.configuration.setChoiceByValue(name);
    document.getElementById('newConfiguration').value = '';
    resetSubPanels();
    await onConfigurationChange();
}

async function deleteBenchmark() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    if (!benchmark) return;

    if (!await confirmDanger('Delete', `Delete Benchmark "${benchmark}"? All related data will be deleted.`)) {
        return;
    }

    delete data[benchmark];

    await deleteExtraFieldsForBenchmark(benchmark);
    await deleteOperatorsDataForBenchmark(benchmark);
    await saveData();
    notifyDataChanged();
    populateBenchmarkSelects();
    resetSubPanels();
    await onBenchmarkChange();
}

async function deleteVendor() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    if (!benchmark || !vendor) return;

    if (!await confirmDanger('Delete', `Delete Arch "${vendor}"? All related data will be deleted.`)) {
        return;
    }

    delete data[benchmark][vendor];

    await deleteExtraFieldsForVendor(benchmark, vendor);
    await deleteOperatorsDataForVendor(benchmark, vendor);
    await saveData();
    notifyDataChanged();

    const vItems = Object.keys(data[benchmark]).sort().map(v => ({ value: v, label: v }));
    choices.vendor.setChoices(vItems, 'value', 'label', true);

    resetSubPanels();
    await onVendorChange();
}

async function deleteConfiguration() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;
    if (!benchmark || !vendor || !configuration) return;

    if (!await confirmDanger('Delete', `Delete Configuration "${configuration}"? All related data will be deleted.`)) {
        return;
    }

    delete data[benchmark][vendor][configuration];

    await saveData();
    notifyDataChanged();

    const cfgItems = Object.keys(data[benchmark][vendor]).sort().map(p => ({ value: p, label: p }));
    choices.configuration.setChoices(cfgItems, 'value', 'label', true);

    resetSubPanels();
    await onConfigurationChange();
}

function notifyDataChanged() {
    window.dispatchEvent(new CustomEvent('benchmarkDataChanged'));
    if (typeof window.updateChartYAxisOptions === 'function') {
        window.updateChartYAxisOptions();
    }
}

async function saveRecord() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;

    const date = document.getElementById('recordDate').value;
    const duration = parseFloat(document.getElementById('recordDuration').value) || 0;

    if (!date) {
        alertError('Please select a date');
        return;
    }

    const record = { date, duration, extras: {} };

    extraFields.forEach(field => {
        const input = document.getElementById(`extra_${field.id}`);
        if (input) {
            let value;
            if (field.type === 'string') {
                value = input.value;
            } else if (field.type === 'int') {
                value = parseInt(input.value) || 0;
            } else {
                value = parseFloat(input.value) || 0;
            }
            record.extras[field.id] = { name: field.name, value };
        }
    });

    if (editingRecord !== null) {
        const oldRecord = data[benchmark][vendor][configuration][editingRecord];
        const oldDate = oldRecord?.date;
        const newDate = date;
        const recordIndex = editingRecord;

        data[benchmark][vendor][configuration][recordIndex] = record;
        editingRecord = null;
        document.getElementById('saveRecordBtn').textContent = 'Save Record';

        if (oldDate && newDate && oldDate !== newDate) {
            try {
                const allOpsData = await loadAllOperatorsData();
                const configData = allOpsData[benchmark]?.[vendor]?.[configuration];
                if (configData && configData[oldDate]) {
                    const oldArr = configData[oldDate];
                    const opsForRecord = oldArr[recordIndex] || null;

                    if (opsForRecord) {
                        if (!configData[newDate]) {
                            configData[newDate] = [];
                        }
                        configData[newDate][recordIndex] = opsForRecord;
                        oldArr[recordIndex] = undefined;

                        const nonEmpty = oldArr.filter(item => item !== undefined && item !== null);
                        if (nonEmpty.length === 0) {
                            delete configData[oldDate];
                        }

                        await saveOperatorsAllData(allOpsData);
                    }
                }
            } catch (error) {
                console.error('Failed to migrate operators data:', error);
            }
        }
    } else {
        data[benchmark][vendor][configuration].push(record);
    }

    await saveData();
    operatorsDateIndices = await getOperatorsDatesForConfig(benchmark, vendor, configuration);
    clearForm();
    displayRecords();
}

function clearForm() {
    const today = getLocalDateString(new Date());
    document.getElementById('recordDate').value = today;
    document.getElementById('recordDuration').value = '';

    extraFields.forEach(field => {
        const input = document.getElementById(`extra_${field.id}`);
        if (input) {
            input.value = '';
        }
    });

    editingRecord = null;
    document.getElementById('saveRecordBtn').textContent = 'Save Record';
    document.getElementById('btnGroup').classList.remove('dirty');
}

function renderExtraFields() {
    const container = document.getElementById('extraFieldsList');
    container.innerHTML = '';

    extraFields.forEach(field => {
        const div = document.createElement('div');
        div.className = 'extra-field-item';
        const fieldType = field.type || 'float';
        const inputType = fieldType === 'string' ? 'text' : 'number';
        const stepAttr = fieldType === 'int' ? '1' : '0.001';
        const placeholder = fieldType === 'string' ? 'Text value' : 'Value';
        div.innerHTML = `
            <input type="text" class="field-name-input" name="fieldName_${field.id}" value="${field.name}" placeholder="Field Name (Unit)" onchange="updateExtraFieldName(${field.id}, this.value)">
            <input type="${inputType}" class="field-value-input" id="extra_${field.id}" name="extra_${field.id}" step="${stepAttr}" placeholder="${placeholder}">
            <button type="button" class="remove-field-btn" onclick="removeExtraField(${field.id})">Delete</button>
        `;
        container.appendChild(div);
    });
}

async function addExtraField() {
    const name = await promptField();
    if (!name) return;

    const typeVal = await promptFieldType();
    if (!typeVal) return;
    const type = parseInt(typeVal);

    const id = Date.now();
    const typeMap = { 1: 'int', 2: 'float', 3: 'string' };
    extraFields.push({ id, name, type: typeMap[type] });
    await saveExtraFieldsForVendor(currentBenchmark, currentVendor, extraFields);

    const container = document.getElementById('extraFieldsList');
    const div = document.createElement('div');
    div.className = 'extra-field-item';
    const inputType = type === 3 ? 'text' : type === 1 ? 'number' : 'number';
    const stepAttr = type === 1 ? '1' : '0.001';
    div.innerHTML = `
        <input type="text" class="field-name-input" value="${name}" placeholder="Field Name (Unit)" onchange="updateExtraFieldName(${id}, this.value)">
        <input type="${inputType}" class="field-value-input" id="extra_${id}" step="${stepAttr}" placeholder="${type === 3 ? 'Text value' : 'Value'}">
        <button type="button" class="remove-field-btn" onclick="removeExtraField(${id})">Delete</button>
    `;
    container.appendChild(div);

    updateYAxisOptions();
}

async function updateExtraFieldName(id, newName) {
    const field = extraFields.find(f => f.id === id);
    if (field) {
        field.name = newName;
        await saveExtraFieldsForVendor(currentBenchmark, currentVendor, extraFields);
        updateYAxisOptions();
    }
}

async function removeExtraField(id) {
    if (!await confirmDanger('Delete', 'Delete this field?')) return;

    extraFields = extraFields.filter(f => f.id !== id);
    await saveExtraFieldsForVendor(currentBenchmark, currentVendor, extraFields);

    const vendorData = data[currentBenchmark]?.[currentVendor];
    if (vendorData) {
        Object.values(vendorData).forEach(records => {
            records.forEach(record => {
                if (record.extras?.[id] !== undefined) {
                    delete record.extras[id];
                }
            });
        });
        await saveData();
    }

    renderExtraFields();
    updateFieldFilterChoices();
    updateYAxisOptions();
    displayRecords();
}

function updateYAxisOptions() {
    if (typeof window.updateChartYAxisOptions === 'function') {
        window.updateChartYAxisOptions(currentBenchmark, currentVendor);
    }
}

function filterRecordsByDate() {
    const input = document.getElementById('dateSearchInput');
    dateFilter = input.value.trim();
    selectedOpRows = [];
    pagination.currentPage = 1;
    shouldAnimateTable = true;
    displayRecords();
}

function displayRecords() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;
    const container = document.getElementById('recordsList');
    const subtitle = document.getElementById('recordsSubtitle');

    subtitle.textContent = benchmark && vendor && configuration
        ? `${benchmark} - ${vendor} - ${configuration}`
        : '';

    if (!benchmark || !vendor || !configuration) {
        container.innerHTML = '<p class="empty-message">Select Benchmark, Arch and Configuration first</p>';
        document.getElementById('paginationControls').innerHTML = '';
        return;
    }

    const records = data[benchmark]?.[vendor]?.[configuration] || [];

    let filteredRecords = [...records];
    if (dateFilter) {
        filteredRecords = filteredRecords.filter(r => r.date.includes(dateFilter));
    }

    if (filteredRecords.length === 0) {
        container.innerHTML = dateFilter
            ? '<p class="empty-message">No records found for the specified date</p>'
            : '<p class="empty-message">No records</p>';
        document.getElementById('paginationControls').innerHTML = '';
        return;
    }

    const activeSort = Object.keys(sortStates).find(key => sortStates[key] !== 0);

    if (activeSort) {
        filteredRecords.sort((a, b) => {
            let aVal, bVal;
            const state = sortStates[activeSort];

            if (activeSort === 'date') {
                aVal = new Date(a.date);
                bVal = new Date(b.date);
            } else if (activeSort === 'duration') {
                aVal = a.duration;
                bVal = b.duration;
            } else {
                const field = extraFields.find(f => f.id === parseInt(activeSort));
                const fieldType = field?.type || 'float';
                const aExtra = a.extras?.[activeSort];
                const bExtra = b.extras?.[activeSort];
                if (fieldType === 'string') {
                    aVal = aExtra?.value || '';
                    bVal = bExtra?.value || '';
                } else {
                    aVal = aExtra?.value || 0;
                    bVal = bExtra?.value || 0;
                }
            }

            if (state === 1) {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
            }
        });
    }

    const totalCount = filteredRecords.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pagination.pageSize));
    if (pagination.currentPage > totalPages) {
        pagination.currentPage = totalPages;
    }
    if (pagination.currentPage < 1) {
        pagination.currentPage = 1;
    }
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
    const endIndex = Math.min(startIndex + pagination.pageSize, totalCount);
    const pageRecords = filteredRecords.slice(startIndex, endIndex);

    const listEl = document.getElementById('recordsList');
    if (listEl && listEl.clientWidth === 0) {
        requestAnimationFrame(() => displayRecords());
        return;
    }

    const visibleFields = visibleExtraFieldIds.length > 0
        ? extraFields.filter(f => visibleExtraFieldIds.includes(String(f.id)))
        : [];

    const colCount = 2 + visibleFields.length + 1;

    let colgroup = '<colgroup>';
    colgroup += '<col style="width: 130px;">';
    colgroup += '<col style="width: 150px;">';
    for (let i = 2; i < colCount - 1; i++) {
        colgroup += '<col style="width: 140px;">';
    }
    colgroup += '<col style="width: 200px;">';
    colgroup += '</colgroup>';

    const tableClass = 'table-fixed-layout';
    let html = `<table class="${tableClass}">` + colgroup + '<thead><tr>';
    html += `<th class="sortable" data-field="date">Date${getSortArrow('date')}</th>`;

    const durationChecked = selectedTrendField === 'duration' ? ' checked' : '';
    html += `<th class="sortable" data-field="duration">
        <input type="radio" class="trend-radio" name="trendField" data-field="duration" value="duration"${durationChecked} onclick="onTrendFieldSelect(this)">
        <span class="th-label">Duration (ms)${getSortArrow('duration')}</span>
    </th>`;

    visibleFields.forEach(field => {
        if (!sortStates.hasOwnProperty(field.id)) {
            sortStates[field.id] = 0;
        }
        const fieldType = field.type || 'float';
        if (fieldType !== 'string') {
            const fieldChecked = selectedTrendField === `extra_${field.id}` ? ' checked' : '';
            html += `<th class="sortable" data-field="${field.id}">
                <input type="radio" class="trend-radio" name="trendField" data-field="extra_${field.id}" value="extra_${field.id}"${fieldChecked} onclick="onTrendFieldSelect(this)">
                <span class="th-label">${field.name}${getSortArrow(field.id)}</span>
            </th>`;
        } else {
            html += `<th class="sortable" data-field="${field.id}">${field.name}${getSortArrow(field.id)}</th>`;
        }
    });

    html += '<th>Action</th></tr></thead><tbody>';

    const opsRowCount = pageRecords.filter((record) => {
        const originalIndex = records.indexOf(record);
        return operatorsDateIndices.some(d => d.date === record.date && d.index === originalIndex);
    }).length;

    pageRecords.forEach((record) => {
        const originalIndex = records.indexOf(record);
        const hasOps = operatorsDateIndices.some(d => d.date === record.date && d.index === originalIndex);
        const rowClass = hasOps ? 'has-operators' : '';
        const isChecked = selectedOpRows.some(r => r.date === record.date && r.index === originalIndex);
        const checkedAttr = isChecked ? ' checked' : '';
        html += `<tr class="${rowClass}">
            <td>${record.date}</td>
            <td>${record.duration.toFixed(3)}</td>`;

        visibleFields.forEach(field => {
            const fieldType = field.type || 'float';
            const extra = record.extras?.[field.id];
            let displayValue;
            if (fieldType === 'string') {
                displayValue = extra ? extra.value : '';
            } else if (fieldType === 'int') {
                displayValue = extra ? extra.value : 0;
            } else {
                displayValue = extra ? extra.value.toFixed(3) : '0.000';
            }
            html += `<td>${displayValue}</td>`;
        });

        const isSingleChecked = selectedSingleOpRow && selectedSingleOpRow.date === record.date && selectedSingleOpRow.index === originalIndex;
        const singleCheckedAttr = isSingleChecked ? ' checked' : '';
        const radioHtml = hasOps
            ? `<input type="radio" class="op-single-cb" name="opSingleRadio" data-date="${record.date}" data-index="${originalIndex}"${singleCheckedAttr} onchange="onOpSingleCheck(this)">`
            : '';
        const checkboxHtml = hasOps && opsRowCount > 1
            ? `<input type="checkbox" class="op-compare-cb" data-date="${record.date}" data-index="${originalIndex}"${checkedAttr} onchange="onOpCompareCheck(this)">`
            : '';
        html += `<td class="action-cell">
            ${radioHtml}
            ${checkboxHtml}
            <button class="edit-btn" onclick="editRecord(${originalIndex})">Edit</button>
            <button class="delete-btn" onclick="deleteRecord(${originalIndex})">Delete</button>
        </td></tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    if (shouldAnimateTable) {
        const table = container.querySelector('table');
        if (table) {
            table.classList.add('table-page-animate');
            const maxDelay = Math.min(pageRecords.length, 11) * 30 + 350;
            setTimeout(() => {
                table.classList.remove('table-page-animate');
            }, maxDelay);
        }
        shouldAnimateTable = false;
    }

    renderPagination(totalCount, totalPages);
}

function getSortArrow(fieldId) {
    const state = sortStates[fieldId];
    if (state === 0) return '';
    if (state === 1) return ' ▲';
    if (state === -1) return ' ▼';
    return '';
}

function toggleSortInternal(fieldId) {
    if (sortStates[fieldId] === undefined || sortStates[fieldId] === 0) {
        Object.keys(sortStates).forEach(key => {
            sortStates[key] = 0;
        });
        sortStates[fieldId] = 1;
    } else if (sortStates[fieldId] === 1) {
        sortStates[fieldId] = -1;
    } else {
        sortStates[fieldId] = 0;
    }
    selectedOpRows = [];
    pagination.currentPage = 1;
    shouldAnimateTable = true;
    displayRecords();
}

function editRecord(index) {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;

    const record = data[benchmark][vendor][configuration][index];

    document.getElementById('recordDate').value = record.date;
    document.getElementById('recordDuration').value = record.duration;

    extraFields.forEach(field => {
        const fieldType = field.type || 'float';
        const input = document.getElementById(`extra_${field.id}`);
        if (input) {
            const extra = record.extras?.[field.id];
            if (fieldType === 'string') {
                input.value = extra ? extra.value : '';
            } else {
                input.value = extra ? extra.value : '0';
            }
        }
    });

    editingRecord = index;
    document.getElementById('saveRecordBtn').textContent = 'Update Record';
    document.getElementById('btnGroup').classList.add('dirty');

    document.getElementById('recordExtraFields').style.display = 'block';
    document.getElementById('toggleIcon').textContent = '▲';
    document.getElementById('toggleIcon').nextElementSibling.textContent = 'Hide More Fields';

    window.switchPanel('record-details');
    document.getElementById('recordDetailPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteRecord(index) {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;

    if (!await confirmDanger('Delete', 'Delete this record?')) {
        return;
    }

    const record = data[benchmark][vendor][configuration][index];
    if (record) {
        await deleteOperatorsDataForRecord(benchmark, vendor, configuration, record.date, index);
    }

    data[benchmark][vendor][configuration].splice(index, 1);
    await saveData();
    selectedOpRows = [];
    operatorsDateIndices = await getOperatorsDatesForConfig(benchmark, vendor, configuration);
    displayRecords();
}

function setupFormDirtyDetection() {
    ['recordDate', 'recordDuration'].forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', updateDirtyState);
            field.addEventListener('change', updateDirtyState);
        }
    });
}

function updateDirtyState() {
    const fields = ['recordDate', 'recordDuration'];
    const btnGroup = document.getElementById('btnGroup');
    let isDirty = fields.some(fieldId => {
        const field = document.getElementById(fieldId);
        return field?.value?.trim() !== '';
    });

    if (!isDirty) {
        isDirty = extraFields.some(field => {
            const input = document.getElementById(`extra_${field.id}`);
            return input?.value?.trim() !== '';
        });
    }

    btnGroup.classList.toggle('dirty', isDirty);
}

function toggleRecordExtra() {
    const extraFieldsEl = document.getElementById('recordExtraFields');
    const toggleIcon = document.getElementById('toggleIcon');
    if (extraFieldsEl.style.display === 'none') {
        extraFieldsEl.style.display = 'block';
        toggleIcon.textContent = '▲';
        toggleIcon.nextElementSibling.textContent = 'Hide More Fields';
    } else {
        extraFieldsEl.style.display = 'none';
        toggleIcon.textContent = '▼';
        toggleIcon.nextElementSibling.textContent = 'Show More Fields';
    }
}

window.getExtraFields = function() {
    return extraFields;
};

window.toggleSort = toggleSortInternal;

window.getCurrentBenchmarkVendor = function() {
    return { benchmark: currentBenchmark, vendor: currentVendor };
};

window.reloadExtraFields = async function() {
    if (currentBenchmark && currentVendor) {
        extraFields = await getExtraFieldsForVendor(currentBenchmark, currentVendor);
        renderExtraFields();
        updateFieldFilterChoices();
        updateYAxisOptions();
    }
};

function renderPagination(totalCount, totalPages) {
    const container = document.getElementById('paginationControls');
    if (totalCount === 0) {
        container.innerHTML = '';
        return;
    }

    const currentPage = pagination.currentPage;
    const pageSize = pagination.pageSize;
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalCount);

    let html = '<div class="pagination-info">';
    html += `<span class="pagination-total">${startItem}-${endItem} of ${totalCount}</span>`;
    html += '<span class="pagination-size-label">Rows per page:</span>';
    html += '<div class="pagination-size-selector">';
    html += `<button class="page-size-btn${pageSize === 25 ? ' active' : ''}" onclick="changePageSize(25)">25</button>`;
    html += `<button class="page-size-btn${pageSize === 50 ? ' active' : ''}" onclick="changePageSize(50)">50</button>`;
    html += `<button class="page-size-btn${pageSize === 100 ? ' active' : ''}" onclick="changePageSize(100)">100</button>`;
    html += '<div class="custom-page-size">';
    html += `<input type="number" id="customPageSizeInput" min="1" max="500" placeholder="Custom" value="${pagination.customPageSize}" onkeydown="if(event.key==='Enter')applyCustomPageSize()">`;
    html += '</div>';
    html += '</div>';
    html += '</div>';

    if (totalPages > 1) {
        html += '<div class="pagination-nav">';

        html += `<button class="page-nav-btn" onclick="goToPage(1)"${currentPage === 1 ? ' disabled' : ''} title="First page">&#171;</button>`;
        html += `<button class="page-nav-btn" onclick="goToPage(${currentPage - 1})"${currentPage === 1 ? ' disabled' : ''} title="Previous page">&#8249;</button>`;

        const maxVisiblePages = 7;
        let startPage, endPage;

        if (totalPages <= maxVisiblePages) {
            startPage = 1;
            endPage = totalPages;
        } else {
            const halfVisible = Math.floor(maxVisiblePages / 2);
            startPage = Math.max(1, currentPage - halfVisible);
            endPage = startPage + maxVisiblePages - 1;

            if (endPage > totalPages) {
                endPage = totalPages;
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }
        }

        if (startPage > 1) {
            html += `<button class="page-nav-btn" onclick="goToPage(1)">1</button>`;
            if (startPage > 2) {
                html += '<span class="page-ellipsis">...</span>';
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            if (i === currentPage) {
                html += `<button class="page-nav-btn active" disabled>${i}</button>`;
            } else {
                html += `<button class="page-nav-btn" onclick="goToPage(${i})">${i}</button>`;
            }
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += '<span class="page-ellipsis">...</span>';
            }
            html += `<button class="page-nav-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
        }

        html += `<button class="page-nav-btn" onclick="goToPage(${currentPage + 1})"${currentPage === totalPages ? ' disabled' : ''} title="Next page">&#8250;</button>`;
        html += `<button class="page-nav-btn" onclick="goToPage(${totalPages})"${currentPage === totalPages ? ' disabled' : ''} title="Last page">&#187;</button>`;

        html += '<div class="page-jump">';
        html += `<input type="number" id="pageJumpInput" min="1" max="${totalPages}" placeholder="Page" onkeydown="if(event.key==='Enter')applyPageJump()">`;
        html += '</div>';

        html += '</div>';
    }

    container.innerHTML = html;
}

function goToPage(page) {
    selectedOpRows = [];
    pagination.currentPage = page;
    shouldAnimateTable = true;
    displayRecords();
}

function changePageSize(size) {
    selectedOpRows = [];
    pagination.pageSize = size;
    pagination.customPageSize = '';
    pagination.currentPage = 1;
    shouldAnimateTable = true;
    displayRecords();
}

function applyCustomPageSize() {
    const input = document.getElementById('customPageSizeInput');
    const value = parseInt(input.value);
    if (!value || value < 1) {
        alertError('Please enter a valid number (>= 1)');
        return;
    }
    if (value > 500) {
        alertError('Maximum 500 rows per page');
        return;
    }
    pagination.pageSize = value;
    pagination.customPageSize = value;
    selectedOpRows = [];
    pagination.currentPage = 1;
    shouldAnimateTable = true;
    displayRecords();
}

function applyPageJump() {
    const input = document.getElementById('pageJumpInput');
    const value = parseInt(input.value);
    if (!value || value < 1) {
        alertError('Please enter a valid page number');
        return;
    }
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;
    const records = data[benchmark]?.[vendor]?.[configuration] || [];
    let filteredCount = records.length;
    if (dateFilter) {
        filteredCount = records.filter(r => r.date.includes(dateFilter)).length;
    }
    const totalPages = Math.max(1, Math.ceil(filteredCount / pagination.pageSize));
    if (value > totalPages) {
        alertError(`Page number exceeds maximum (${totalPages})`);
        return;
    }
    pagination.currentPage = value;
    selectedOpRows = [];
    shouldAnimateTable = true;
    displayRecords();
}

function detectValueType(rawValue) {
    if (rawValue == null) return { type: 'string', value: '' };
    const str = String(rawValue).trim();
    if (str === '') return { type: 'string', value: '' };

    const hasPercent = str.endsWith('%');
    const numStr = hasPercent ? str.slice(0, -1).trim() : str;

    if (/^-?\d+$/.test(numStr)) {
        const intVal = parseInt(numStr, 10);
        if (hasPercent) {
            return { type: 'float', value: intVal };
        }
        return { type: 'int', value: intVal };
    }

    const dotCount = (numStr.match(/\./g) || []).length;
    if (dotCount === 1 && /^-?\d+\.\d+$/.test(numStr)) {
        const floatVal = parseFloat(numStr);
        return { type: 'float', value: floatVal };
    }

    return { type: 'string', value: str };
}

function parseSummaryData(workbook) {
    const sheetName = workbook.SheetNames.find(name => name === 'Summary Data');
    if (!sheetName) return null;

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!jsonData || jsonData.length < 2) return null;

    const keys = jsonData[0];
    const values = jsonData[1];

    if (!keys || !values) return null;

    const result = { duration: 0, extras: [] };

    for (let i = 0; i < keys.length; i++) {
        const key = String(keys[i]).trim();
        const rawValue = values[i];

        if (!key) continue;

        if (/(total|inference)\s*time/i.test(key)) {
            const parsed = detectValueType(rawValue);
            result.duration = parsed.type === 'string' ? 0 : parsed.value;
        } else {
            const parsed = detectValueType(rawValue);
            result.extras.push({ name: key, type: parsed.type, value: parsed.value });
        }
    }

    return result;
}

function parseOperatorsData(workbook) {
    const sheetName = workbook.SheetNames.find(name => {
        const lower = name.trim().toLowerCase();
        return (lower.includes('operat') || lower.includes('plugin')) && lower.includes('data');
    });
    if (!sheetName) return null;

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!jsonData || jsonData.length < 3) return null;

    const operators = [];
    let maxPairs = 0;

    for (let i = 2; i < jsonData.length; i++) {
        const row = jsonData[i];
        const operatorName = row[0] != null ? String(row[0]).trim() : '';
        if (!operatorName) continue;

        const pairs = [];
        let col = 1;
        while (col < row.length) {
            const timeRaw = row[col];
            const ratioRaw = row[col + 1];

            let timeVal = null;
            if (timeRaw != null && String(timeRaw).trim() !== '') {
                const parsed = detectValueType(timeRaw);
                timeVal = parsed.type === 'string' ? null : parsed.value;
            }

            let ratioVal = null;
            if (ratioRaw != null && String(ratioRaw).trim() !== '') {
                const parsed = detectValueType(ratioRaw);
                ratioVal = parsed.type === 'string' ? null : parsed.value;
            }

            if (timeVal !== null || ratioVal !== null) {
                pairs.push({ time: timeVal, ratio: ratioVal });
            } else {
                break;
            }

            col += 2;
        }

        if (pairs.length > 0) {
            if (pairs.length > maxPairs) maxPairs = pairs.length;
            operators.push({ operator: operatorName, pairs });
        }
    }

    for (const op of operators) {
        while (op.pairs.length < maxPairs) {
            op.pairs.push({ time: null, ratio: null });
        }
    }

    return operators.length > 0 ? operators : null;
}

function recordSignature(record, extraFieldDefs) {
    const parts = [record.date, String(record.duration)];
    const namedExtras = Object.entries(record.extras).map(([fieldId, fieldData]) => {
        const fieldDef = extraFieldDefs.find(f => String(f.id) === String(fieldId));
        const name = fieldDef ? fieldDef.name : fieldData.name || '';
        return { name, value: fieldData.value };
    });
    namedExtras.sort((a, b) => a.name.localeCompare(b.name));
    for (const extra of namedExtras) {
        parts.push(`${extra.name}=${extra.value}`);
    }
    return parts.join('|');
}

function parsedSignature(parsed, date) {
    const parts = [date, String(parsed.duration)];
    const sortedExtras = parsed.extras.slice().sort((a, b) => a.name.localeCompare(b.name));
    for (const extra of sortedExtras) {
        parts.push(`${extra.name}=${extra.value}`);
    }
    return parts.join('|');
}

async function loadExternalXlsx() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;

    if (!benchmark || !vendor || !configuration) {
        alertError('Please select Benchmark, Arch and Configuration first');
        return;
    }

    if (!window.showDirectoryPicker) {
        alertError('Your browser does not support the File System Access API. Please use a modern browser (Chrome, Edge).');
        return;
    }

    let dirHandle;
    try {
        dirHandle = await window.showDirectoryPicker();
    } catch (e) {
        return;
    }

    const btn = document.getElementById('loadXlsxBtn');
    const progressBar = document.getElementById('xlsxProgressBar');
    const progressFill = document.getElementById('xlsxProgressFill');
    const progressText = document.getElementById('xlsxProgressText');

    btn.classList.add('loading');
    btn.textContent = 'Loading...';
    progressBar.classList.add('active');
    progressText.classList.add('active');

    try {
        const xlsxFiles = [];
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.xlsx')) {
                xlsxFiles.push(entry);
            }
        }

        if (xlsxFiles.length === 0) {
            alertInfo('No .xlsx files found in the selected folder');
            return;
        }

        const today = getLocalDateString(new Date());
        const existingRecords = data[benchmark]?.[vendor]?.[configuration] || [];
        const existingSigs = new Set(existingRecords.map(r => recordSignature(r, extraFields)));

        const parsedResults = [];
        const operatorsDataMap = [];
        const seenSigs = new Set();
        let duplicatesSkipped = 0;
        let noSummaryData = 0;

        for (let i = 0; i < xlsxFiles.length; i++) {
            const fileEntry = xlsxFiles[i];
            const pct = Math.round(((i + 1) / xlsxFiles.length) * 100);
            progressFill.style.width = pct + '%';
            progressText.textContent = `Parsing ${fileEntry.name} (${i + 1}/${xlsxFiles.length})`;

            try {
                const file = await fileEntry.getFile();
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });

                const parsed = parseSummaryData(workbook);
                if (!parsed) {
                    noSummaryData++;
                    continue;
                }

                const sig = parsedSignature(parsed, today);
                if (seenSigs.has(sig) || existingSigs.has(sig)) {
                    duplicatesSkipped++;
                    continue;
                }

                seenSigs.add(sig);
                const operatorsData = parseOperatorsData(workbook);
                parsedResults.push(parsed);
                operatorsDataMap.push(operatorsData);
            } catch (err) {
                console.error(`Failed to parse ${fileEntry.name}:`, err);
            }
        }

        if (parsedResults.length === 0) {
            let msg = 'No new records to import.';
            if (noSummaryData > 0) msg += `\n${noSummaryData} file(s) had no "Summary Data" sheet.`;
            if (duplicatesSkipped > 0) msg += `\n${duplicatesSkipped} duplicate(s) skipped.`;
            alertInfo(msg);
            return;
        }

        const allNewFieldNames = new Set();
        for (const parsed of parsedResults) {
            for (const extra of parsed.extras) {
                allNewFieldNames.add(extra.name);
            }
        }

        const updatedExtraFields = extraFields.slice();
        for (const name of allNewFieldNames) {
            const existing = updatedExtraFields.find(f => f.name === name);
            if (!existing) {
                const newId = Date.now() + Math.floor(Math.random() * 10000);
                let determinedType = 'float';
                for (const parsed of parsedResults) {
                    const matched = parsed.extras.find(e => e.name === name);
                    if (matched) {
                        determinedType = matched.type;
                        break;
                    }
                }
                updatedExtraFields.push({ id: newId, name, type: determinedType });
            }
        }

        for (let idx = 0; idx < parsedResults.length; idx++) {
            const parsed = parsedResults[idx];
            const record = {
                date: today,
                duration: parsed.duration,
                extras: {}
            };

            for (const extra of parsed.extras) {
                const fieldDef = updatedExtraFields.find(f => f.name === extra.name);
                if (fieldDef) {
                    record.extras[fieldDef.id] = { name: extra.name, value: extra.value };
                }
            }

            if (!data[benchmark][vendor][configuration]) {
                data[benchmark][vendor][configuration] = [];
            }
            data[benchmark][vendor][configuration].push(record);

            const operatorsData = operatorsDataMap[idx];
            if (operatorsData) {
                const recordIndex = data[benchmark][vendor][configuration].length - 1;
                await saveOperatorsDataForRecord(benchmark, vendor, configuration, today, recordIndex, operatorsData);
            }
        }

        extraFields = updatedExtraFields;
        await saveExtraFieldsForVendor(benchmark, vendor, extraFields);
        await saveData();

        operatorsDateIndices = await getOperatorsDatesForConfig(benchmark, vendor, configuration);
        renderExtraFields();
        updateFieldFilterChoices();
        displayRecords();
        notifyDataChanged();

        let msg = `Successfully imported ${parsedResults.length} record(s).`;
        if (duplicatesSkipped > 0) msg += `\n${duplicatesSkipped} duplicate(s) skipped.`;
        if (noSummaryData > 0) msg += `\n${noSummaryData} file(s) had no "Summary Data" sheet.`;
        alertOk(msg);
    } catch (error) {
        console.error('XLSX loading error:', error);
        alertError('Failed to load XLSX files: ' + error.message);
    } finally {
        btn.classList.remove('loading');
        btn.textContent = 'Load External XLSX';
        progressBar.classList.remove('active');
        progressText.classList.remove('active');
        progressFill.style.width = '0%';
    }
}

function onOpCompareCheck(cb) {
    const date = cb.dataset.date;
    const index = parseInt(cb.dataset.index);
    if (cb.checked) {
        if (selectedOpRows.length >= 2) {
            cb.checked = false;
            return;
        }
        selectedOpRows.push({ date, index });
    } else {
        selectedOpRows = selectedOpRows.filter(r => !(r.date === date && r.index === index));
    }
    if (selectedOpRows.length === 2) {
        enterOpCompareFullscreen();
    }
}

function onOpSingleCheck(cb) {
    const date = cb.dataset.date;
    const index = parseInt(cb.dataset.index);
    if (cb.checked) {
        selectedSingleOpRow = { date, index };
        enterOpSingleFullscreen();
    } else {
        selectedSingleOpRow = null;
    }
}

function clearOpSelection() {
    selectedOpRows = [];
    selectedSingleOpRow = null;
    document.querySelectorAll('.op-compare-cb').forEach(cb => {
        cb.checked = false;
    });
    document.querySelectorAll('.op-single-cb').forEach(cb => {
        cb.checked = false;
    });
}

async function enterOpCompareFullscreen() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;

    if (!benchmark || !vendor || !configuration || selectedOpRows.length !== 2) return;

    const left = selectedOpRows[0];
    const right = selectedOpRows[1];

    const leftData = await getOperatorsDataForRecord(benchmark, vendor, configuration, left.date, left.index);
    const rightData = await getOperatorsDataForRecord(benchmark, vendor, configuration, right.date, right.index);

    if (!leftData || !rightData) {
        alertError('Failed to load operators data for comparison');
        clearOpSelection();
        return;
    }

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

    const leftEntry = operatorsDateIndices.find(e => e.date === left.date && e.index === left.index);
    const rightEntry = operatorsDateIndices.find(e => e.date === right.date && e.index === right.index);
    const leftLabel = leftEntry ? leftEntry.label : left.date;
    const rightLabel = rightEntry ? rightEntry.label : right.date;

    opCompareState.leftData = leftData;
    opCompareState.rightData = rightData;
    opCompareState.leftLabel = leftLabel;
    opCompareState.rightLabel = rightLabel;
    opCompareState.operators = allOperators;
    opCompareState.maxPairCount = maxPairCount;
    opCompareState.isSingleMode = false;

    document.getElementById('opCompareFullscreen').classList.add('visible');
    window.animateOpChart(allOperators, leftOps, rightOps, leftLabel, rightLabel, 'opCompareCanvas', opCompareState);
}

async function enterOpSingleFullscreen() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;

    if (!benchmark || !vendor || !configuration || !selectedSingleOpRow) return;

    const row = selectedSingleOpRow;
    const singleData = await getOperatorsDataForRecord(benchmark, vendor, configuration, row.date, row.index);

    if (!singleData) {
        alertError('Failed to load operators data');
        clearOpSelection();
        return;
    }

    const singleOps = new Map(singleData.map(d => [d.operator, d]));
    const allOperators = [...singleOps.keys()].sort();

    let maxPairCount = 0;
    for (const op of allOperators) {
        const sp = singleOps.get(op)?.pairs?.length || 0;
        if (sp > maxPairCount) maxPairCount = sp;
    }
    if (maxPairCount === 0) maxPairCount = 1;

    const entry = operatorsDateIndices.find(e => e.date === row.date && e.index === row.index);
    const label = entry ? entry.label : row.date;

    opCompareState.leftData = singleData;
    opCompareState.rightData = [];
    opCompareState.leftLabel = label;
    opCompareState.rightLabel = '';
    opCompareState.operators = allOperators;
    opCompareState.maxPairCount = maxPairCount;
    opCompareState.isSingleMode = true;

    document.getElementById('opCompareFullscreen').classList.add('visible');
    const emptyRightOps = new Map();
    window.animateOpChart(allOperators, singleOps, emptyRightOps, label, '', 'opCompareCanvas', opCompareState);
}

function exitOpCompareFullscreen() {
    if (opCompareState.animationId) {
        cancelAnimationFrame(opCompareState.animationId);
        opCompareState.animationId = null;
    }
    document.getElementById('opCompareFullscreen').classList.remove('visible');
    clearOpSelection();
}

function onTrendFieldSelect(radio) {
    const field = radio.value;
    selectedTrendField = field;
    drawTrendChart();
}

function drawTrendChart() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;

    if (!benchmark || !vendor || !configuration || !selectedTrendField) return;

    const allRecords = data[benchmark]?.[vendor]?.[configuration] || [];
    if (allRecords.length === 0) return;

    const sortedRecords = [...allRecords].sort((a, b) => new Date(a.date) - new Date(b.date));

    const dataPoints = sortedRecords.map(r => {
        if (selectedTrendField === 'duration') {
            return r.duration;
        } else if (selectedTrendField.startsWith('extra_')) {
            const fieldId = selectedTrendField.replace('extra_', '');
            return r.extras && r.extras[fieldId] ? r.extras[fieldId].value : 0;
        }
        return 0;
    });

    const dates = sortedRecords.map(r => r.date);
    const allLabels = [...new Set(dates)].sort();

    const COLORS = [
        { line: '#38bdf8', fill: 'rgba(56, 189, 248, 0.12)' },
        { line: '#f472b6', fill: 'rgba(244, 114, 182, 0.12)' },
        { line: '#a78bfa', fill: 'rgba(167, 139, 250, 0.12)' },
        { line: '#34d399', fill: 'rgba(52, 211, 153, 0.12)' },
        { line: '#fbbf24', fill: 'rgba(251, 191, 36, 0.12)' },
        { line: '#f87171', fill: 'rgba(248, 113, 113, 0.12)' }
    ];

    const labelMap = {
        duration: 'Duration (ms)'
    };
    extraFields.forEach(field => {
        labelMap['extra_' + field.id] = field.name;
    });

    const dataset = {
        label: labelMap[selectedTrendField] || selectedTrendField,
        dates: dates,
        values: dataPoints,
        color: COLORS[0]
    };

    trendState.datasets = [dataset];
    trendState.labels = allLabels;
    trendState.yAxis = selectedTrendField;
    trendState.benchmark = benchmark;

    document.getElementById('trendFullscreen').classList.add('visible');
    window.animateLineChart([dataset], allLabels, selectedTrendField, benchmark, 'trendCanvas', trendState);
}

function exitTrendFullscreen() {
    if (trendState.animationId) {
        cancelAnimationFrame(trendState.animationId);
        trendState.animationId = null;
    }
    document.getElementById('trendFullscreen').classList.remove('visible');
    selectedTrendField = null;
    document.querySelectorAll('.trend-radio').forEach(r => r.checked = false);
}

function renderTrendChartCurrent() {
    window.renderLineChart(trendState.datasets, trendState.labels, trendState.yAxis, trendState.benchmark, 1, 'trendCanvas', trendState);
}

function initPanelFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const panel = params.get('panel');
    if (panel && ['operations', 'record-details', 'existing-records'].includes(panel)) {
        const allSelected = isAllSelected();
        if (allSelected || panel === 'operations') {
            currentPanel = '';
            switchPanel(panel);
        } else {
            currentPanel = '';
            switchPanel('operations');
        }
    } else {
        currentPanel = '';
        switchPanel('operations');
    }
}

window.switchPanel = function(panelId) {
    if (currentPanel === panelId) return;
    const tabBar = document.getElementById('subTabBar');
    if (tabBar) {
        const targetTab = tabBar.querySelector(`.sub-tab[data-panel="${panelId}"]`);
        if (targetTab && targetTab.classList.contains('disabled')) return;
    }
    currentPanel = panelId;
    const opPanel = document.getElementById('dataOperationPanel');
    const rdPanel = document.getElementById('recordDetailPanel');
    const rlPanel = document.getElementById('recordsListPanel');

    opPanel.style.display = 'none';
    rdPanel.style.display = 'none';
    rlPanel.style.display = 'none';

    let targetPanel;
    let needDisplayRecords = false;
    if (panelId === 'operations') {
        targetPanel = opPanel;
    } else if (panelId === 'record-details') {
        targetPanel = rdPanel;
    } else if (panelId === 'existing-records') {
        targetPanel = rlPanel;
        if (isAllSelected()) {
            needDisplayRecords = true;
        }
    }

    if (targetPanel) {
        targetPanel.classList.remove('panel-animate-in');
        targetPanel.style.display = 'block';
        void targetPanel.offsetWidth;
        targetPanel.classList.add('panel-animate-in');
    }

    if (needDisplayRecords) {
        displayRecords();
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

function isAllSelected() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;
    return !!(benchmark && vendor && configuration);
}

function updateSubmenuStates(enabled) {
    const tabBar = document.getElementById('subTabBar');
    if (!tabBar) return;
    tabBar.querySelectorAll('.sub-tab').forEach(tab => {
        const panel = tab.dataset.panel;
        if (panel === 'operations') return;
        if (enabled) {
            tab.classList.remove('disabled');
        } else {
            tab.classList.add('disabled');
        }
    });
}

function resetSubPanels() {
    updateSubmenuStates(false);

    document.getElementById('recordDate').value = getLocalDateString(new Date());
    document.getElementById('recordDuration').value = '';
    document.getElementById('dateSearchInput').value = '';
    dateFilter = '';
    editingRecord = null;
    document.getElementById('saveRecordBtn').textContent = 'Save Record';

    const recordsList = document.getElementById('recordsList');
    if (recordsList) {
        recordsList.innerHTML = '';
    }

    const paginationControls = document.getElementById('paginationControls');
    if (paginationControls) {
        paginationControls.innerHTML = '';
    }

    const subtitle = document.getElementById('recordsSubtitle');
    if (subtitle) {
        subtitle.textContent = '';
    }
}


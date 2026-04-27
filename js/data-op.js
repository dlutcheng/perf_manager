let data = {};
let editingRecord = null;
let extraFields = [];
let currentBenchmark = '';
let currentVendor = '';
let operatorsDateIndices = [];
let selectedOpRows = [];
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

let opCompareState = {
    leftData: null,
    rightData: null,
    leftLabel: '',
    rightLabel: '',
    operators: [],
    maxPairCount: 1,
    padding: null,
    chartWidth: 0,
    chartHeight: 0,
    animationId: null
};

document.addEventListener('DOMContentLoaded', async () => {
    await initDatabase();
    await loadData();
    initApp();
});

async function loadData() {
    try {
        data = await loadBenchmarkData() || {};
    } catch (error) {
        data = {};
    }
}

function initApp() {
    setupEventListeners();
    populateBenchmarkSelects();
    setupFormDirtyDetection();
    document.getElementById('recordDate').value = new Date().toISOString().split('T')[0];
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

async function saveData() {
    try {
        await dbSaveBenchmarkData(data);
    } catch (error) {
        alert('Failed to save data');
    }
}

function filterSelect(selectId, searchId) {
    const select = document.getElementById(selectId);
    const search = document.getElementById(searchId);
    const filter = search.value.toLowerCase();

    for (let i = 0; i < select.options.length; i++) {
        const option = select.options[i];
        const text = option.text.toLowerCase();
        const value = option.value.toLowerCase();

        if (text.includes(filter) || value.includes(filter)) {
            option.style.display = '';
        } else {
            option.style.display = 'none';
        }
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
        if (e.target.classList.contains('sortable')) {
            const fieldId = e.target.getAttribute('data-field');
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

    document.getElementById('opCompareCanvas').addEventListener('mousemove', onOpCompareCanvasMouseMove);
    document.getElementById('opCompareCanvas').addEventListener('mouseleave', () => {
        if (opCompareState.operators.length > 0) {
            renderOpCompareChartCurrent();
        }
    });

    window.addEventListener('resize', () => {
        if (document.getElementById('opCompareFullscreen').classList.contains('visible')) {
            const leftOps = new Map(opCompareState.leftData.map(d => [d.operator, d]));
            const rightOps = new Map(opCompareState.rightData.map(d => [d.operator, d]));
            animateOpCompareChart(opCompareState.operators, leftOps, rightOps, opCompareState.leftLabel, opCompareState.rightLabel);
        }
    });
}

function populateBenchmarkSelects() {
    const benchmarkSelect = document.getElementById('benchmarkSelect');
    benchmarkSelect.innerHTML = '<option value="">-- Select Benchmark --</option>';
    Object.keys(data).sort().forEach(benchmark => {
        benchmarkSelect.innerHTML += `<option value="${benchmark}">${benchmark}</option>`;
    });
}

async function onBenchmarkChange() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendorSelect = document.getElementById('vendorSelect');

    currentBenchmark = benchmark;
    currentVendor = '';

    vendorSelect.innerHTML = '<option value="">-- Select Arch --</option>';
    vendorSelect.disabled = !benchmark;

    document.getElementById('vendorSearch').value = '';
    document.getElementById('vendorSearch').disabled = !benchmark;

    document.getElementById('newVendor').disabled = !benchmark;

    document.getElementById('configurationSelect').innerHTML = '<option value="">-- Select Configuration --</option>';
    document.getElementById('configurationSelect').disabled = true;

    document.getElementById('configurationSearch').value = '';
    document.getElementById('configurationSearch').disabled = true;

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
        Object.keys(data[benchmark]).sort().forEach(vendor => {
            vendorSelect.innerHTML += `<option value="${vendor}">${vendor}</option>`;
        });
    }

    extraFields = [];
    operatorsDateIndices = [];
    selectedOpRows = [];
    resetSubPanels();
    renderExtraFields();
    displayRecords();
    switchPanel('operations');
}

async function onVendorChange() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configurationSelect = document.getElementById('configurationSelect');

    currentVendor = vendor;

    configurationSelect.innerHTML = '<option value="">-- Select Configuration --</option>';
    configurationSelect.disabled = !vendor;

    document.getElementById('configurationSearch').value = '';
    document.getElementById('configurationSearch').disabled = !vendor;

    document.getElementById('newConfiguration').disabled = !vendor;

    document.getElementById('addConfigurationBtn').disabled = !vendor;
    document.getElementById('deleteConfigurationBtn').disabled = !vendor;
    document.getElementById('saveRecordBtn').disabled = true;
    document.getElementById('loadXlsxBtn').disabled = true;
    document.getElementById('addFieldBtn').disabled = !vendor;
    document.getElementById('deleteVendorBtn').disabled = !vendor;

    pagination.currentPage = 1;

    if (benchmark && vendor && data[benchmark]?.[vendor]) {
        Object.keys(data[benchmark][vendor]).sort().forEach(configuration => {
            configurationSelect.innerHTML += `<option value="${configuration}">${configuration}</option>`;
        });
    }

    extraFields = await getExtraFieldsForVendor(benchmark, vendor);
    operatorsDateIndices = [];
    selectedOpRows = [];
    resetSubPanels();
    renderExtraFields();
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
        alert('Please enter Benchmark name');
        return;
    }
    if (data[name]) {
        alert('Benchmark already exists');
        return;
    }

    data[name] = {};
    await saveData();
    populateBenchmarkSelects();

    document.getElementById('benchmarkSelect').value = name;
    document.getElementById('newBenchmark').value = '';
    resetSubPanels();
    await onBenchmarkChange();
}

async function addVendor() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const name = document.getElementById('newVendor').value.trim();
    if (!name) {
        alert('Please enter Arch name');
        return;
    }
    if (!data[benchmark]) {
        data[benchmark] = {};
    }
    if (data[benchmark][name]) {
        alert('Arch already exists');
        return;
    }

    data[benchmark][name] = {};
    await saveData();

    const vendorSelect = document.getElementById('vendorSelect');
    vendorSelect.innerHTML = '<option value="">-- Select Arch --</option>';
    Object.keys(data[benchmark]).sort().forEach(vendor => {
        vendorSelect.innerHTML += `<option value="${vendor}">${vendor}</option>`;
    });

    vendorSelect.value = name;
    document.getElementById('newVendor').value = '';
    resetSubPanels();
    await onVendorChange();
}

async function addConfiguration() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const name = document.getElementById('newConfiguration').value.trim();
    if (!name) {
        alert('Please enter Configuration name');
        return;
    }
    if (!data[benchmark][vendor]) {
        data[benchmark][vendor] = {};
    }
    if (data[benchmark][vendor][name]) {
        alert('Configuration already exists');
        return;
    }

    data[benchmark][vendor][name] = [];
    await saveData();

    const configurationSelect = document.getElementById('configurationSelect');
    configurationSelect.innerHTML = '<option value="">-- Select Configuration --</option>';
    Object.keys(data[benchmark][vendor]).sort().forEach(configuration => {
        configurationSelect.innerHTML += `<option value="${configuration}">${configuration}</option>`;
    });

    configurationSelect.value = name;
    document.getElementById('newConfiguration').value = '';
    resetSubPanels();
    await onConfigurationChange();
}

async function deleteBenchmark() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    if (!benchmark) return;

    if (!confirm(`Delete Benchmark "${benchmark}"? All related data will be deleted.`)) {
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

    if (!confirm(`Delete Arch "${vendor}"? All related data will be deleted.`)) {
        return;
    }

    delete data[benchmark][vendor];

    await deleteExtraFieldsForVendor(benchmark, vendor);
    await deleteOperatorsDataForVendor(benchmark, vendor);
    await saveData();
    notifyDataChanged();

    const vendorSelect = document.getElementById('vendorSelect');
    vendorSelect.innerHTML = '<option value="">-- Select Arch --</option>';
    Object.keys(data[benchmark]).sort().forEach(v => {
        vendorSelect.innerHTML += `<option value="${v}">${v}</option>`;
    });
    vendorSelect.value = '';

    resetSubPanels();
    await onVendorChange();
}

async function deleteConfiguration() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;
    if (!benchmark || !vendor || !configuration) return;

    if (!confirm(`Delete Configuration "${configuration}"? All related data will be deleted.`)) {
        return;
    }

    delete data[benchmark][vendor][configuration];

    await saveData();
    notifyDataChanged();

    const configurationSelect = document.getElementById('configurationSelect');
    configurationSelect.innerHTML = '<option value="">-- Select Configuration --</option>';
    Object.keys(data[benchmark][vendor]).sort().forEach(p => {
        configurationSelect.innerHTML += `<option value="${p}">${p}</option>`;
    });
    configurationSelect.value = '';

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
        alert('Please select a date');
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
        data[benchmark][vendor][configuration][editingRecord] = record;
        editingRecord = null;
        document.getElementById('saveRecordBtn').textContent = 'Save Record';
    } else {
        data[benchmark][vendor][configuration].push(record);
    }

    await saveData();
    clearForm();
    displayRecords();
}

function clearForm() {
    const today = new Date().toISOString().split('T')[0];
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
    const name = prompt('Enter field name (e.g., Power(W)):');
    if (!name) return;

    let type = prompt('Enter field type (1: Integer, 2: Float, 3: String):', '2');
    if (!type) return;
    type = parseInt(type);
    if (![1, 2, 3].includes(type)) {
        alert('Invalid field type');
        return;
    }

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
    if (!confirm('Delete this field?')) return;

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

    let filteredRecords = records;
    if (dateFilter) {
        filteredRecords = records.filter(r => r.date.includes(dateFilter));
    }

    if (filteredRecords.length === 0) {
        container.innerHTML = dateFilter
            ? '<p class="empty-message">No records found for the specified date</p>'
            : '<p class="empty-message">No records</p>';
        document.getElementById('paginationControls').innerHTML = '';
        return;
    }

    const activeSort = Object.keys(sortStates).find(key => sortStates[key] !== 0) || 'date';

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

    const colCount = 2 + extraFields.length + 1;
    const listEl = document.getElementById('recordsList');
    const containerWidth = listEl ? listEl.clientWidth : 0;
    const minDateWidth = 110;
    const minDurationWidth = 130;
    const minExtraWidth = 80;
    const minActionWidth = 200;
    const estimatedMinWidth = minDateWidth + minDurationWidth + extraFields.length * minExtraWidth + minActionWidth;
    const useFixedLayout = containerWidth > 0 && estimatedMinWidth <= containerWidth;

    let colgroup = '<colgroup>';
    if (useFixedLayout) {
        for (let i = 0; i < colCount; i++) {
            colgroup += '<col>';
        }
    } else {
        colgroup += '<col style="min-width: 110px;">';
        colgroup += '<col style="min-width: 130px;">';
        for (let i = 2; i < colCount - 1; i++) {
            colgroup += '<col style="min-width: 80px;">';
        }
        colgroup += '<col style="min-width: 200px;">';
    }
    colgroup += '</colgroup>';

    const tableClass = useFixedLayout ? 'table-fixed-layout' : 'table-auto-layout';
    let html = `<table class="${tableClass}">` + colgroup + '<thead><tr>';
    html += `<th class="sortable" data-field="date">Date${getSortArrow('date')}</th>`;
    html += `<th class="sortable" data-field="duration">Duration (ms)${getSortArrow('duration')}</th>`;

    extraFields.forEach(field => {
        if (!sortStates.hasOwnProperty(field.id)) {
            sortStates[field.id] = 0;
        }
        html += `<th class="sortable" data-field="${field.id}">${field.name}${getSortArrow(field.id)}</th>`;
    });

    html += '<th>Action</th></tr></thead><tbody>';

    pageRecords.forEach((record) => {
        const originalIndex = records.indexOf(record);
        const hasOps = operatorsDateIndices.some(d => d.date === record.date && d.index === originalIndex);
        const rowClass = hasOps ? 'has-operators' : '';
        const isChecked = selectedOpRows.some(r => r.date === record.date && r.index === originalIndex);
        const checkedAttr = isChecked ? ' checked' : '';
        html += `<tr class="${rowClass}">
            <td>${record.date}</td>
            <td>${record.duration.toFixed(3)}</td>`;

        extraFields.forEach(field => {
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

        const checkboxHtml = hasOps
            ? `<input type="checkbox" class="op-compare-cb" data-date="${record.date}" data-index="${originalIndex}"${checkedAttr} onchange="onOpCompareCheck(this)">`
            : '';
        html += `<td class="action-cell">
            ${checkboxHtml}
            <button class="edit-btn" onclick="editRecord(${originalIndex})">Edit</button>
            <button class="delete-btn" onclick="deleteRecord(${originalIndex})">Delete</button>
        </td></tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

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

    if (!confirm('Delete this record?')) {
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
    displayRecords();
}

function changePageSize(size) {
    selectedOpRows = [];
    pagination.pageSize = size;
    pagination.customPageSize = '';
    pagination.currentPage = 1;
    displayRecords();
}

function applyCustomPageSize() {
    const input = document.getElementById('customPageSizeInput');
    const value = parseInt(input.value);
    if (!value || value < 1) {
        alert('Please enter a valid number (>= 1)');
        return;
    }
    if (value > 500) {
        alert('Maximum 500 rows per page');
        return;
    }
    pagination.pageSize = value;
    pagination.customPageSize = value;
    selectedOpRows = [];
    pagination.currentPage = 1;
    displayRecords();
}

function applyPageJump() {
    const input = document.getElementById('pageJumpInput');
    const value = parseInt(input.value);
    if (!value || value < 1) {
        alert('Please enter a valid page number');
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
        alert(`Page number exceeds maximum (${totalPages})`);
        return;
    }
    pagination.currentPage = value;
    selectedOpRows = [];
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
        alert('Please select Benchmark, Arch and Configuration first');
        return;
    }

    if (!window.showDirectoryPicker) {
        alert('Your browser does not support the File System Access API. Please use a modern browser (Chrome, Edge).');
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
            alert('No .xlsx files found in the selected folder');
            return;
        }

        const today = new Date().toISOString().split('T')[0];
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
            alert(msg);
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
        displayRecords();
        notifyDataChanged();

        let msg = `Successfully imported ${parsedResults.length} record(s).`;
        if (duplicatesSkipped > 0) msg += `\n${duplicatesSkipped} duplicate(s) skipped.`;
        if (noSummaryData > 0) msg += `\n${noSummaryData} file(s) had no "Summary Data" sheet.`;
        alert(msg);
    } catch (error) {
        console.error('XLSX loading error:', error);
        alert('Failed to load XLSX files: ' + error.message);
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

function clearOpCompareSelection() {
    selectedOpRows = [];
    document.querySelectorAll('.op-compare-cb').forEach(cb => {
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
        alert('Failed to load operators data for comparison');
        clearOpCompareSelection();
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

    document.getElementById('opCompareFullscreen').classList.add('visible');
    animateOpCompareChart(allOperators, leftOps, rightOps, leftLabel, rightLabel);
}

function exitOpCompareFullscreen() {
    if (opCompareState.animationId) {
        cancelAnimationFrame(opCompareState.animationId);
        opCompareState.animationId = null;
    }
    document.getElementById('opCompareFullscreen').classList.remove('visible');
    clearOpCompareSelection();
}

function animateOpCompareChart(allOperators, leftOps, rightOps, dateLeft, dateRight) {
    if (opCompareState.animationId) {
        cancelAnimationFrame(opCompareState.animationId);
        opCompareState.animationId = null;
    }
    const duration = 800;
    const startTime = performance.now();
    function frame(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        renderOpCompareChart(allOperators, leftOps, rightOps, dateLeft, dateRight, eased);
        if (progress < 1) {
            opCompareState.animationId = requestAnimationFrame(frame);
        } else {
            opCompareState.animationId = null;
        }
    }
    opCompareState.animationId = requestAnimationFrame(frame);
}

function renderOpCompareChart(allOperators, leftOps, rightOps, dateLeft, dateRight, animProgress) {
    if (animProgress === undefined) animProgress = 1;

    const canvas = document.getElementById('opCompareCanvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('opCompareContainer');
    const rect = container.getBoundingClientRect();
    const padding = { top: 60, right: 80, bottom: 160, left: 100 };

    canvas.width = rect.width - 40 || window.innerWidth - 40;
    canvas.height = rect.height - 40 || window.innerHeight - 90;

    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;

    opCompareState.padding = padding;
    opCompareState.chartWidth = chartWidth;
    opCompareState.chartHeight = chartHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (allOperators.length === 0) {
        ctx.font = '15px "Outfit", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText('No Operators Data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const maxPairCount = opCompareState.maxPairCount || 1;
    const totalBarSlots = 2 * maxPairCount;

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
    const interGroupGap = Math.min(singleBarWidth * 0.5, 6);

    for (let i = 0; i < visibleCount; i++) {
        const op = allOperators[i];
        const cx = xPosition(i);
        const leftOp = leftOps.get(op);
        const rightOp = rightOps.get(op);
        const baseY = padding.top + chartHeight;

        const leftBlockStart = cx - leftBlockWidth - interGroupGap / 2;
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

    const legendY = padding.top - 30;
    const legendItems = [
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

function renderOpCompareChartCurrent() {
    const leftOps = new Map(opCompareState.leftData.map(d => [d.operator, d]));
    const rightOps = new Map(opCompareState.rightData.map(d => [d.operator, d]));
    renderOpCompareChart(opCompareState.operators, leftOps, rightOps, opCompareState.leftLabel, opCompareState.rightLabel, 1);
}

function onOpCompareCanvasMouseMove(e) {
    if (opCompareState.operators.length === 0) return;

    const canvas = document.getElementById('opCompareCanvas');
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { padding, chartWidth, chartHeight, operators, leftData, rightData, leftLabel, rightLabel, maxPairCount } = opCompareState;

    if (mouseX < padding.left || mouseX > padding.left + chartWidth ||
        mouseY < padding.top || mouseY > padding.top + chartHeight) {
        renderOpCompareChartCurrent();
        return;
    }

    const groupWidth = chartWidth / operators.length;
    const nearestIndex = Math.floor((mouseX - padding.left) / groupWidth);
    const clampedIndex = Math.max(0, Math.min(operators.length - 1, nearestIndex));

    const leftOps = new Map(leftData.map(d => [d.operator, d]));
    const rightOps = new Map(rightData.map(d => [d.operator, d]));

    renderOpCompareChartCurrent();

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
        lines.push({ text: `── ${leftLabel}${pairLabel} ──`, bold: false, color: '#00d4aa' });
        const lt = leftOp?.pairs?.[p]?.time;
        const lr = leftOp?.pairs?.[p]?.ratio;
        lines.push({ text: `  Time: ${lt != null ? lt.toFixed(3) : 'N/A'}`, bold: false, color: '#00d4aa' });
        lines.push({ text: `  Ratio: ${lr != null ? (lr * 100).toFixed(1) + '%' : 'N/A'}`, bold: false, color: '#34d399' });
    }

    for (let p = 0; p < pairCount; p++) {
        const pairLabel = pairCount > 1 ? ` #${p + 1}` : '';
        lines.push({ text: `── ${rightLabel}${pairLabel} ──`, bold: false, color: '#f87171' });
        const rt = rightOp?.pairs?.[p]?.time;
        const rr = rightOp?.pairs?.[p]?.ratio;
        lines.push({ text: `  Time: ${rt != null ? rt.toFixed(3) : 'N/A'}`, bold: false, color: '#f87171' });
        lines.push({ text: `  Ratio: ${rr != null ? (rr * 100).toFixed(1) + '%' : 'N/A'}`, bold: false, color: '#fca5a5' });
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

    const totalBarSlots = 2 * pairCount;
    const singleBarWidth = Math.min(groupWidth / (totalBarSlots + 1), 30);
    const intraGap = Math.min(singleBarWidth * 0.15, 3);
    const leftBlockWidth = pairCount * singleBarWidth + (pairCount - 1) * intraGap;
    const interGroupGap = Math.min(singleBarWidth * 0.5, 6);
    const leftBlockStart = cx - leftBlockWidth - interGroupGap / 2;
    const rightBlockStart = cx + interGroupGap / 2;

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
    if (panelId === 'operations') {
        targetPanel = opPanel;
    } else if (panelId === 'record-details') {
        targetPanel = rdPanel;
    } else if (panelId === 'existing-records') {
        targetPanel = rlPanel;
        if (isAllSelected()) {
            displayRecords();
        }
    }

    if (targetPanel) {
        targetPanel.classList.remove('panel-animate-in', 'panel-animate-in-delayed');
        targetPanel.style.display = 'block';
        void targetPanel.offsetWidth;
        targetPanel.classList.add('panel-animate-in');
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

    document.getElementById('recordDate').value = new Date().toISOString().split('T')[0];
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

function setupDropdowns() {
}

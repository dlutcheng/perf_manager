let data = {};
let editingRecord = null;
let extraFields = [];
let currentBenchmark = '';
let currentVendor = '';
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

function showPanel(el, delayed) {
    const wasHidden = el.style.display === 'none';
    el.classList.remove('panel-animate-in', 'panel-animate-in-delayed');
    if (wasHidden) {
        el.style.opacity = '0';
    }
    el.style.display = 'block';
    void el.offsetWidth;
    if (wasHidden) {
        el.style.opacity = '';
    }
    el.classList.add(delayed ? 'panel-animate-in-delayed' : 'panel-animate-in');
}

function hidePanel(el) {
    el.style.display = 'none';
    el.classList.remove('panel-animate-in', 'panel-animate-in-delayed');
}

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
    document.getElementById('dataTopRow').classList.add('single-panel');
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

    document.getElementById('addFieldBtn').addEventListener('click', addExtraField);

    document.getElementById('recordsList').addEventListener('click', (e) => {
        if (e.target.classList.contains('sortable')) {
            const fieldId = e.target.getAttribute('data-field');
            if (fieldId) {
                toggleSortInternal(fieldId);
            }
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
    document.getElementById('addFieldBtn').disabled = true;
    document.getElementById('deleteVendorBtn').disabled = true;

    hidePanel(document.getElementById('recordDetailPanel'));
    hidePanel(document.getElementById('recordsListPanel'));
    document.getElementById('dataTopRow').classList.add('single-panel');

    pagination.currentPage = 1;

    if (benchmark && data[benchmark]) {
        Object.keys(data[benchmark]).sort().forEach(vendor => {
            vendorSelect.innerHTML += `<option value="${vendor}">${vendor}</option>`;
        });
    }

    extraFields = [];
    renderExtraFields();
    displayRecords();
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
    document.getElementById('addFieldBtn').disabled = !vendor;
    document.getElementById('deleteVendorBtn').disabled = !vendor;

    hidePanel(document.getElementById('recordDetailPanel'));
    hidePanel(document.getElementById('recordsListPanel'));
    document.getElementById('dataTopRow').classList.add('single-panel');

    pagination.currentPage = 1;

    if (benchmark && vendor && data[benchmark]?.[vendor]) {
        Object.keys(data[benchmark][vendor]).sort().forEach(configuration => {
            configurationSelect.innerHTML += `<option value="${configuration}">${configuration}</option>`;
        });
    }

    extraFields = await getExtraFieldsForVendor(benchmark, vendor);
    renderExtraFields();
    displayRecords();
}

async function onConfigurationChange() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;

    document.getElementById('saveRecordBtn').disabled = !configuration;
    document.getElementById('addFieldBtn').disabled = !configuration;

    const recordDetailPanel = document.getElementById('recordDetailPanel');
    const recordsListPanel = document.getElementById('recordsListPanel');
    const dataTopRow = document.getElementById('dataTopRow');

    pagination.currentPage = 1;

    if (benchmark && vendor && configuration) {
        dataTopRow.classList.remove('single-panel');
        showPanel(recordDetailPanel, false);
        showPanel(recordsListPanel, true);
    } else {
        hidePanel(recordDetailPanel);
        hidePanel(recordsListPanel);
        dataTopRow.classList.add('single-panel');
        document.getElementById('dateSearchInput').value = '';
        dateFilter = '';
    }

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
    await saveData();
    notifyDataChanged();
    populateBenchmarkSelects();
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
    await saveData();
    notifyDataChanged();

    const vendorSelect = document.getElementById('vendorSelect');
    vendorSelect.innerHTML = '<option value="">-- Select Arch --</option>';
    Object.keys(data[benchmark]).sort().forEach(v => {
        vendorSelect.innerHTML += `<option value="${v}">${v}</option>`;
    });
    vendorSelect.value = '';

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

    const colCount = 2 + extraFields.length;
    const colWidth = 100 / colCount;
    let colgroup = '<colgroup>';
    for (let i = 0; i < colCount; i++) {
        colgroup += `<col style="width: ${colWidth.toFixed(2)}%">`;
    }
    colgroup += '</colgroup>';

    let html = '<table>' + colgroup + '<thead><tr>';
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
        html += `<tr>
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

        html += `<td>
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

    document.getElementById('recordDetailPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteRecord(index) {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;

    if (!confirm('Delete this record?')) {
        return;
    }

    data[benchmark][vendor][configuration].splice(index, 1);
    await saveData();
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
    pagination.currentPage = page;
    displayRecords();
}

function changePageSize(size) {
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
    displayRecords();
}

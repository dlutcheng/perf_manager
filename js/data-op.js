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
const STORAGE_KEY = 'benchmark_data';
const EXTRA_FIELDS_KEY = 'benchmark_extra_fields';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    loadData();
    setupEventListeners();
    populateBenchmarkSelects();
    setupFormDirtyDetection();
    document.getElementById('recordDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('dataTopRow').classList.add('single-panel');
}

function loadData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        data = stored ? JSON.parse(stored) : {};
    } catch (error) {
        data = {};
    }
}

function loadExtraFields() {
    try {
        const stored = localStorage.getItem(EXTRA_FIELDS_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (error) {
        return {};
    }
}

function saveExtraFieldsForVendor(benchmark, vendor, fields) {
    const allVendorFields = loadExtraFields();
    if (!allVendorFields[benchmark]) {
        allVendorFields[benchmark] = {};
    }
    allVendorFields[benchmark][vendor] = fields;
    localStorage.setItem(EXTRA_FIELDS_KEY, JSON.stringify(allVendorFields));
}

function getExtraFieldsForVendor(benchmark, vendor) {
    const allVendorFields = loadExtraFields();
    return allVendorFields[benchmark]?.[vendor] || [];
}

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

function onBenchmarkChange() {
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

    document.getElementById('recordDetailPanel').style.display = 'none';
    document.getElementById('recordsListPanel').style.display = 'none';
    document.getElementById('dataTopRow').classList.add('single-panel');

    if (benchmark && data[benchmark]) {
        Object.keys(data[benchmark]).sort().forEach(vendor => {
            vendorSelect.innerHTML += `<option value="${vendor}">${vendor}</option>`;
        });
    }

    extraFields = [];
    renderExtraFields();
    displayRecords();
}

function onVendorChange() {
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

    document.getElementById('recordDetailPanel').style.display = 'none';
    document.getElementById('recordsListPanel').style.display = 'none';
    document.getElementById('dataTopRow').classList.add('single-panel');

    if (benchmark && vendor && data[benchmark]?.[vendor]) {
        Object.keys(data[benchmark][vendor]).sort().forEach(configuration => {
            configurationSelect.innerHTML += `<option value="${configuration}">${configuration}</option>`;
        });
    }

    extraFields = getExtraFieldsForVendor(benchmark, vendor);
    renderExtraFields();
    displayRecords();
}

function onConfigurationChange() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;

    document.getElementById('saveRecordBtn').disabled = !configuration;
    document.getElementById('addFieldBtn').disabled = !configuration;

    const recordDetailPanel = document.getElementById('recordDetailPanel');
    const recordsListPanel = document.getElementById('recordsListPanel');
    const dataTopRow = document.getElementById('dataTopRow');

    if (benchmark && vendor && configuration) {
        recordDetailPanel.style.display = 'block';
        recordsListPanel.style.display = 'block';
        dataTopRow.classList.remove('single-panel');
    } else {
        recordDetailPanel.style.display = 'none';
        recordsListPanel.style.display = 'none';
        dataTopRow.classList.add('single-panel');
        document.getElementById('dateSearchInput').value = '';
        dateFilter = '';
    }

    displayRecords();
}

function addBenchmark() {
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
    saveData();
    populateBenchmarkSelects();

    document.getElementById('benchmarkSelect').value = name;
    document.getElementById('newBenchmark').value = '';
    onBenchmarkChange();
}

function addVendor() {
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
    saveData();

    const vendorSelect = document.getElementById('vendorSelect');
    vendorSelect.innerHTML = '<option value="">-- Select Arch --</option>';
    Object.keys(data[benchmark]).sort().forEach(vendor => {
        vendorSelect.innerHTML += `<option value="${vendor}">${vendor}</option>`;
    });

    vendorSelect.value = name;
    document.getElementById('newVendor').value = '';
    onVendorChange();
}

function addConfiguration() {
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
    saveData();

    const configurationSelect = document.getElementById('configurationSelect');
    configurationSelect.innerHTML = '<option value="">-- Select Configuration --</option>';
    Object.keys(data[benchmark][vendor]).sort().forEach(configuration => {
        configurationSelect.innerHTML += `<option value="${configuration}">${configuration}</option>`;
    });

    configurationSelect.value = name;
    document.getElementById('newConfiguration').value = '';
    onConfigurationChange();
}

function deleteBenchmark() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    if (!benchmark) return;

    if (!confirm(`Delete Benchmark "${benchmark}"? All related data will be deleted.`)) {
        return;
    }

    delete data[benchmark];

    const vendorFields = loadExtraFields();
    if (vendorFields[benchmark]) {
        delete vendorFields[benchmark];
        localStorage.setItem(EXTRA_FIELDS_KEY, JSON.stringify(vendorFields));
    }

    saveData();
    notifyDataChanged();
    populateBenchmarkSelects();
    onBenchmarkChange();
}

function deleteVendor() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    if (!benchmark || !vendor) return;

    if (!confirm(`Delete Arch "${vendor}"? All related data will be deleted.`)) {
        return;
    }

    delete data[benchmark][vendor];

    const vendorFields = loadExtraFields();
    if (vendorFields[benchmark]?.[vendor]) {
        delete vendorFields[benchmark][vendor];
        localStorage.setItem(EXTRA_FIELDS_KEY, JSON.stringify(vendorFields));
    }

    saveData();
    notifyDataChanged();

    const vendorSelect = document.getElementById('vendorSelect');
    vendorSelect.innerHTML = '<option value="">-- Select Arch --</option>';
    Object.keys(data[benchmark]).sort().forEach(v => {
        vendorSelect.innerHTML += `<option value="${v}">${v}</option>`;
    });
    vendorSelect.value = '';

    onVendorChange();
}

function deleteConfiguration() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;
    if (!benchmark || !vendor || !configuration) return;

    if (!confirm(`Delete Configuration "${configuration}"? All related data will be deleted.`)) {
        return;
    }

    delete data[benchmark][vendor][configuration];

    saveData();
    notifyDataChanged();

    const configurationSelect = document.getElementById('configurationSelect');
    configurationSelect.innerHTML = '<option value="">-- Select Configuration --</option>';
    Object.keys(data[benchmark][vendor]).sort().forEach(p => {
        configurationSelect.innerHTML += `<option value="${p}">${p}</option>`;
    });
    configurationSelect.value = '';

    onConfigurationChange();
}

function notifyDataChanged() {
    window.dispatchEvent(new CustomEvent('benchmarkDataChanged'));
    if (typeof window.updateChartYAxisOptions === 'function') {
        window.updateChartYAxisOptions();
    }
}

function saveRecord() {
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
            const value = parseFloat(input.value) || 0;
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

    saveData();
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
        div.innerHTML = `
            <input type="text" class="field-name-input" name="fieldName_${field.id}" value="${field.name}" placeholder="Field Name (Unit)" onchange="updateExtraFieldName(${field.id}, this.value)">
            <input type="number" class="field-value-input" id="extra_${field.id}" name="extra_${field.id}" step="0.001" placeholder="Value">
            <button type="button" class="remove-field-btn" onclick="removeExtraField(${field.id})">Delete</button>
        `;
        container.appendChild(div);
    });
}

function addExtraField() {
    const name = prompt('Enter field name (e.g., Power(W)):');
    if (!name) return;

    const id = Date.now();
    extraFields.push({ id, name });
    saveExtraFieldsForVendor(currentBenchmark, currentVendor, extraFields);

    const container = document.getElementById('extraFieldsList');
    const div = document.createElement('div');
    div.className = 'extra-field-item';
    div.innerHTML = `
        <input type="text" class="field-name-input" value="${name}" placeholder="Field Name (Unit)" onchange="updateExtraFieldName(${id}, this.value)">
        <input type="number" class="field-value-input" id="extra_${id}" step="0.001" placeholder="Value">
        <button type="button" class="remove-field-btn" onclick="removeExtraField(${id})">Delete</button>
    `;
    container.appendChild(div);

    updateYAxisOptions();
}

function updateExtraFieldName(id, newName) {
    const field = extraFields.find(f => f.id === id);
    if (field) {
        field.name = newName;
        saveExtraFieldsForVendor(currentBenchmark, currentVendor, extraFields);
        updateYAxisOptions();
    }
}

function removeExtraField(id) {
    if (!confirm('Delete this field?')) return;

    extraFields = extraFields.filter(f => f.id !== id);
    saveExtraFieldsForVendor(currentBenchmark, currentVendor, extraFields);

    const vendorData = data[currentBenchmark]?.[currentVendor];
    if (vendorData) {
        Object.values(vendorData).forEach(records => {
            records.forEach(record => {
                if (record.extras?.[id] !== undefined) {
                    delete record.extras[id];
                }
            });
        });
        saveData();
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
            aVal = a.extras?.[activeSort]?.value || 0;
            bVal = b.extras?.[activeSort]?.value || 0;
        }

        if (state === 1) {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });

    const colCount = 2 + extraFields.length;
    let colgroup = '<colgroup>';
    colgroup += '<col>';
    for (let i = 1; i < colCount - 1; i++) {
        colgroup += '<col>';
    }
    colgroup += '<col>';
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

    filteredRecords.forEach((record) => {
        const originalIndex = records.indexOf(record);
        html += `<tr>
            <td>${record.date}</td>
            <td>${record.duration.toFixed(3)}</td>`;

        extraFields.forEach(field => {
            const extra = record.extras?.[field.id];
            html += `<td>${extra ? extra.value.toFixed(3) : '0.000'}</td>`;
        });

        html += `<td>
            <button class="edit-btn" onclick="editRecord(${originalIndex})">Edit</button>
            <button class="delete-btn" onclick="deleteRecord(${originalIndex})">Delete</button>
        </td></tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    requestAnimationFrame(() => {
        const table = container.querySelector('table');
        if (table) {
            const colCount = 2 + extraFields.length;
            const firstRow = table.rows[0];

            const totalTableWidth = table.offsetWidth;
            const firstColActualWidth = firstRow.cells[0].offsetWidth;
            const lastColActualWidth = firstRow.cells[firstRow.cells.length - 1].offsetWidth;
            const remainingWidth = totalTableWidth - firstColActualWidth - lastColActualWidth;
            const middleColCount = colCount - 2;
            const middleColWidth = Math.floor(remainingWidth / middleColCount);

            for (let i = 1; i < firstRow.cells.length - 1; i++) {
                firstRow.cells[i].style.width = middleColWidth + 'px';
            }

            const rows = table.rows;
            console.log('=== Table Column Widths ===');
            for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].cells;
                const widths = [];
                for (let j = 0; j < cells.length; j++) {
                    widths.push(`${j}:${cells[j].offsetWidth}px`);
                }
                console.log(`Row ${i}: [${widths.join(', ')}]`);
            }
            console.log(`Total: ${totalTableWidth}px, First: ${firstColActualWidth}px, Last: ${lastColActualWidth}px, Remaining: ${remainingWidth}px for ${middleColCount} cols`);
        }
    });
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
        const input = document.getElementById(`extra_${field.id}`);
        if (input) {
            const extra = record.extras?.[field.id];
            input.value = extra ? extra.value : '0';
        }
    });

    editingRecord = index;
    document.getElementById('saveRecordBtn').textContent = 'Update Record';
    document.getElementById('btnGroup').classList.add('dirty');

    document.getElementById('recordExtraFields').style.display = 'block';
    document.getElementById('toggleIcon').textContent = '▲';
    document.getElementById('toggleIcon').nextElementSibling.textContent = 'Hide More Fields';
}

function deleteRecord(index) {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const configuration = document.getElementById('configurationSelect').value;

    if (!confirm('Delete this record?')) {
        return;
    }

    data[benchmark][vendor][configuration].splice(index, 1);
    saveData();
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

window.reloadExtraFields = function() {
    if (currentBenchmark && currentVendor) {
        extraFields = getExtraFieldsForVendor(currentBenchmark, currentVendor);
        renderExtraFields();
        updateYAxisOptions();
    }
};
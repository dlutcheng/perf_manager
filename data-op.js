let data = {};
let editingRecord = null;
let extraFields = [];
let currentBenchmark = '';
let currentVendor = '';
let sortStates = {
    date: 0,
    duration: 0
};
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

function setupEventListeners() {
    document.getElementById('benchmarkSelect').addEventListener('change', onBenchmarkChange);
    document.getElementById('vendorSelect').addEventListener('change', onVendorChange);
    document.getElementById('precisionSelect').addEventListener('change', onPrecisionChange);

    document.getElementById('addBenchmarkBtn').addEventListener('click', addBenchmark);
    document.getElementById('addVendorBtn').addEventListener('click', addVendor);
    document.getElementById('addPrecisionBtn').addEventListener('click', addPrecision);

    document.getElementById('deleteBenchmarkBtn').addEventListener('click', deleteBenchmark);
    document.getElementById('deleteVendorBtn').addEventListener('click', deleteVendor);
    document.getElementById('deletePrecisionBtn').addEventListener('click', deletePrecision);

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

    document.getElementById('newVendor').disabled = !benchmark;

    document.getElementById('precisionSelect').innerHTML = '<option value="">-- Select Precision --</option>';
    document.getElementById('precisionSelect').disabled = true;

    document.getElementById('addVendorBtn').disabled = !benchmark;
    document.getElementById('deleteBenchmarkBtn').disabled = !benchmark;
    document.getElementById('addPrecisionBtn').disabled = true;
    document.getElementById('deletePrecisionBtn').disabled = true;
    document.getElementById('saveRecordBtn').disabled = true;
    document.getElementById('addFieldBtn').disabled = true;
    document.getElementById('deleteVendorBtn').disabled = true;

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
    const precisionSelect = document.getElementById('precisionSelect');

    currentVendor = vendor;

    precisionSelect.innerHTML = '<option value="">-- Select Precision --</option>';
    precisionSelect.disabled = !vendor;

    document.getElementById('newPrecision').disabled = !vendor;

    document.getElementById('addPrecisionBtn').disabled = !vendor;
    document.getElementById('deletePrecisionBtn').disabled = !vendor;
    document.getElementById('saveRecordBtn').disabled = true;
    document.getElementById('addFieldBtn').disabled = !vendor;
    document.getElementById('deleteVendorBtn').disabled = !vendor;

    if (benchmark && vendor && data[benchmark]?.[vendor]) {
        Object.keys(data[benchmark][vendor]).sort().forEach(precision => {
            precisionSelect.innerHTML += `<option value="${precision}">${precision}</option>`;
        });
    }

    extraFields = getExtraFieldsForVendor(benchmark, vendor);
    renderExtraFields();
    displayRecords();
}

function onPrecisionChange() {
    const precision = document.getElementById('precisionSelect').value;
    document.getElementById('saveRecordBtn').disabled = !precision;
    document.getElementById('addFieldBtn').disabled = !precision;
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

function addPrecision() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const name = document.getElementById('newPrecision').value.trim();
    if (!name) {
        alert('Please enter Precision name');
        return;
    }
    if (!data[benchmark][vendor]) {
        data[benchmark][vendor] = {};
    }
    if (data[benchmark][vendor][name]) {
        alert('Precision already exists');
        return;
    }

    data[benchmark][vendor][name] = [];
    saveData();

    const precisionSelect = document.getElementById('precisionSelect');
    precisionSelect.innerHTML = '<option value="">-- Select Precision --</option>';
    Object.keys(data[benchmark][vendor]).sort().forEach(precision => {
        precisionSelect.innerHTML += `<option value="${precision}">${precision}</option>`;
    });

    precisionSelect.value = name;
    document.getElementById('newPrecision').value = '';
    onPrecisionChange();
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

function deletePrecision() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const precision = document.getElementById('precisionSelect').value;
    if (!benchmark || !vendor || !precision) return;

    if (!confirm(`Delete Precision "${precision}"? All related data will be deleted.`)) {
        return;
    }

    delete data[benchmark][vendor][precision];

    saveData();
    notifyDataChanged();

    const precisionSelect = document.getElementById('precisionSelect');
    precisionSelect.innerHTML = '<option value="">-- Select Precision --</option>';
    Object.keys(data[benchmark][vendor]).sort().forEach(p => {
        precisionSelect.innerHTML += `<option value="${p}">${p}</option>`;
    });
    precisionSelect.value = '';

    onPrecisionChange();
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
    const precision = document.getElementById('precisionSelect').value;

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
        data[benchmark][vendor][precision][editingRecord] = record;
        editingRecord = null;
        document.getElementById('saveRecordBtn').textContent = 'Save Record';
    } else {
        data[benchmark][vendor][precision].push(record);
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
            <input type="text" class="field-name-input" value="${field.name}" placeholder="Field Name (Unit)" onchange="updateExtraFieldName(${field.id}, this.value)">
            <input type="number" class="field-value-input" id="extra_${field.id}" step="0.001" placeholder="Value">
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

function displayRecords() {
    const benchmark = document.getElementById('benchmarkSelect').value;
    const vendor = document.getElementById('vendorSelect').value;
    const precision = document.getElementById('precisionSelect').value;
    const container = document.getElementById('recordsList');
    const subtitle = document.getElementById('recordsSubtitle');

    subtitle.textContent = benchmark && vendor && precision
        ? `${benchmark} - ${vendor} - ${precision}`
        : '';

    if (!benchmark || !vendor || !precision) {
        container.innerHTML = '<p class="empty-message">Select Benchmark, Arch and Precision first</p>';
        return;
    }

    const records = data[benchmark]?.[vendor]?.[precision] || [];

    if (records.length === 0) {
        container.innerHTML = '<p class="empty-message">No records</p>';
        return;
    }

    const activeSort = Object.keys(sortStates).find(key => sortStates[key] !== 0) || 'date';

    records.sort((a, b) => {
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

    let html = '<table><thead><tr>';
    html += `<th class="sortable" data-field="date">Date${getSortArrow('date')}</th>`;
    html += `<th class="sortable" data-field="duration">Duration (ms)${getSortArrow('duration')}</th>`;

    extraFields.forEach(field => {
        if (!sortStates.hasOwnProperty(field.id)) {
            sortStates[field.id] = 0;
        }
        html += `<th class="sortable" data-field="${field.id}">${field.name}${getSortArrow(field.id)}</th>`;
    });

    html += '<th>Action</th></tr></thead><tbody>';

    records.forEach((record, index) => {
        html += `<tr>
            <td>${record.date}</td>
            <td>${record.duration.toFixed(3)}</td>`;

        extraFields.forEach(field => {
            const extra = record.extras?.[field.id];
            html += `<td>${extra ? extra.value.toFixed(3) : '0.000'}</td>`;
        });

        html += `<td>
            <button class="edit-btn" onclick="editRecord(${index})">Edit</button>
            <button class="delete-btn" onclick="deleteRecord(${index})">Delete</button>
        </td></tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
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
    const precision = document.getElementById('precisionSelect').value;

    const record = data[benchmark][vendor][precision][index];

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
    const precision = document.getElementById('precisionSelect').value;

    if (!confirm('Delete this record?')) {
        return;
    }

    data[benchmark][vendor][precision].splice(index, 1);
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
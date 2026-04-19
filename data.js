const STORAGE_KEY = 'benchmark_data';
const EXTRA_FIELDS_KEY = 'benchmark_extra_fields';
const DATA_FILE = 'benchmark_data.json';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    updateDataStatus();
    setupEventListeners();
    window.addEventListener('benchmarkDataChanged', updateDataStatus);
}

function updateDataStatus() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            const benchmarkCount = Object.keys(data).length;
            let recordCount = 0;
            Object.values(data).forEach(vendors => {
                Object.values(vendors).forEach(configurations => {
                    Object.values(configurations).forEach(records => {
                        recordCount += records.length;
                    });
                });
            });
            document.getElementById('dataStatus').innerHTML = `
                <span class="status-good">Loaded</span><br>
                Benchmarks: ${benchmarkCount}<br>
                Total Records: ${recordCount}
            `;
        } else {
            document.getElementById('dataStatus').innerHTML = '<span class="status-empty">No Data</span>';
        }
    } catch (error) {
        document.getElementById('dataStatus').innerHTML = '<span class="status-error">Load Failed</span>';
    }
}

function setupEventListeners() {
    document.getElementById('importBtn').addEventListener('click', importData);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('clearBtn').addEventListener('click', clearAllData);
}

function loadExtraFields() {
    try {
        const stored = localStorage.getItem(EXTRA_FIELDS_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {}
    return {};
}

function exportData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            alert('No data to export');
            return;
        }
        const data = JSON.parse(stored);
        const vendorFields = loadExtraFields();

        Object.entries(data).forEach(([benchmark, vendors]) => {
            Object.entries(vendors).forEach(([vendor, configurations]) => {
                const fields = vendorFields[benchmark]?.[vendor] || [];
                Object.values(configurations).forEach(records => {
                    records.forEach(record => {
                        if (!record.extras) {
                            record.extras = {};
                        }
                        fields.forEach(field => {
                            if (record.extras[field.id] === undefined) {
                                record.extras[field.id] = { name: field.name, value: 0 };
                            }
                        });
                    });
                });
            });
        });

        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = DATA_FILE;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Data exported successfully');
    } catch (error) {
        alert('Data export failed');
    }
}

function collectExtraFieldsPerVendor(dataObj) {
    const vendorFieldsMap = {};

    Object.entries(dataObj).forEach(([benchmark, vendors]) => {
        vendorFieldsMap[benchmark] = {};

        Object.keys(vendors).forEach(vendor => {
            vendorFieldsMap[benchmark][vendor] = new Map();
        });

        Object.values(vendors).forEach((configurations) => {
            Object.values(configurations).forEach(records => {
                records.forEach(record => {
                    if (record.extras) {
                        const vendor = Object.keys(vendors).find(v =>
                            Object.values(vendors[v]).some(p => p.includes(record))
                        );
                        if (vendor && vendorFieldsMap[benchmark][vendor]) {
                            Object.entries(record.extras).forEach(([fieldId, fieldData]) => {
                                const id = parseInt(fieldId);
                                if (id > 0 && !vendorFieldsMap[benchmark][vendor].has(id)) {
                                    vendorFieldsMap[benchmark][vendor].set(id, { id, name: fieldData.name });
                                }
                            });
                        }
                    }
                });
            });
        });
    });

    const result = {};
    Object.entries(vendorFieldsMap).forEach(([benchmark, vendors]) => {
        result[benchmark] = {};
        Object.entries(vendors).forEach(([vendor, fieldsMap]) => {
            result[benchmark][vendor] = Array.from(fieldsMap.values());
        });
    });
    return result;
}

function migrateOldFormatRecords(dataObj) {
    Object.values(dataObj).forEach(vendors => {
        Object.values(vendors).forEach(configurations => {
            Object.values(configurations).forEach(records => {
                records.forEach(record => {
                    if (!record.extras) {
                        record.extras = {};
                    }
                });
            });
        });
    });
    return dataObj;
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);

                if (confirm('Import will overwrite existing data. Continue?')) {
                    const migrated = migrateOldFormatRecords(imported);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));

                    const importedExtraFields = collectExtraFieldsPerVendor(migrated);
                    localStorage.setItem(EXTRA_FIELDS_KEY, JSON.stringify(importedExtraFields));

                    if (typeof window.updateChartYAxisOptions === 'function') {
                        window.updateChartYAxisOptions();
                    }
                    if (typeof window.reloadExtraFields === 'function') {
                        window.reloadExtraFields();
                    }
                    window.dispatchEvent(new CustomEvent('benchmarkDataImported'));

                    updateDataStatus();
                    alert('Data imported successfully');
                }
            } catch (error) {
                alert('Data import failed: invalid JSON format');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function clearAllData() {
    if (!confirm('Clear all data? This cannot be undone!\n\nClick OK to auto-export backup first.')) {
        return;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `benchmark_data_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Backup failed:', error);
    }

    localStorage.removeItem(STORAGE_KEY);
    updateDataStatus();
    alert('All data cleared, backup downloaded.');
}
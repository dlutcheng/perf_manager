const DATA_FILE = 'benchmark_data.json';

document.addEventListener('DOMContentLoaded', async () => {
    await initDatabase();
    initApp();
});

function initApp() {
    updateDataStatus();
    setupEventListeners();
    window.addEventListener('benchmarkDataChanged', updateDataStatus);
}

async function updateDataStatus() {
    try {
        const data = await loadBenchmarkData();
        if (Object.keys(data).length > 0) {
            const benchmarkCount = Object.keys(data).length;
            let recordCount = 0;
            const benchmarkStats = [];

            Object.entries(data).forEach(([benchmark, vendors]) => {
                let archCount = Object.keys(vendors).length;
                let configCount = 0;
                let benchRecords = 0;
                Object.values(vendors).forEach(configurations => {
                    configCount += Object.keys(configurations).length;
                    Object.values(configurations).forEach(records => {
                        benchRecords += records.length;
                    });
                });
                recordCount += benchRecords;
                benchmarkStats.push({ name: benchmark, archCount, configCount, recordCount: benchRecords });
            });

            let statsHtml = `
                <span class="status-good">Loaded</span><br>
                Benchmarks: ${benchmarkCount} &nbsp;|&nbsp; Total Records: ${recordCount}
            `;

            statsHtml += '<div class="benchmark-stats-grid">';
            benchmarkStats.forEach(stat => {
                statsHtml += `<div class="benchmark-stat-item">
                    <span class="benchmark-stat-name">${stat.name}</span>
                    <span class="benchmark-stat-detail">${stat.archCount} Arch · ${stat.configCount} Config · ${stat.recordCount} Rec</span>
                </div>`;
            });
            statsHtml += '</div>';

            document.getElementById('dataStatus').innerHTML = statsHtml;
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
    document.getElementById('clearNoBackupBtn').addEventListener('click', clearAllDataNoBackup);
}

async function loadExtraFields() {
    try {
        return await loadAllExtraFields();
    } catch (error) {}
    return {};
}

async function exportData() {
    try {
        const data = await loadBenchmarkData();
        if (Object.keys(data).length === 0) {
            alert('No data to export');
            return;
        }
        const vendorFields = await loadExtraFields();

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
                                record.extras[field.id] = { name: field.name, type: field.type, value: 0 };
                            } else {
                                record.extras[field.id].name = field.name;
                                record.extras[field.id].type = field.type;
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
        flashButton('exportBtn');
    } catch (error) {
        alert('Data export failed');
    }
}

function flashButton(btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.classList.remove('btn-flash');
    void btn.offsetWidth;
    btn.classList.add('btn-flash');
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
                                    vendorFieldsMap[benchmark][vendor].set(id, { id, name: fieldData.name, type: fieldData.type || 'float' });
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

async function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const imported = JSON.parse(event.target.result);

                if (confirm('Import will overwrite existing data. Continue?')) {
                    const migrated = migrateOldFormatRecords(imported);
                    await dbSaveBenchmarkData(migrated);

                    const importedExtraFields = collectExtraFieldsPerVendor(migrated);
                    for (const [benchmark, vendors] of Object.entries(importedExtraFields)) {
                        for (const [vendor, fields] of Object.entries(vendors)) {
                            await saveExtraFieldsForVendor(benchmark, vendor, fields);
                        }
                    }

                    if (typeof window.updateChartYAxisOptions === 'function') {
                        window.updateChartYAxisOptions();
                    }
                    if (typeof window.reloadExtraFields === 'function') {
                        window.reloadExtraFields();
                    }
                    window.dispatchEvent(new CustomEvent('benchmarkDataImported'));

                    updateDataStatus();
                    alert('Data imported successfully');
                    flashButton('importBtn');
                }
            } catch (error) {
                alert('Data import failed: invalid JSON format');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

async function clearAllData() {
    if (!confirm('Clear all data? This cannot be undone!\n\nClick OK to auto-export backup first.')) {
        return;
    }

    try {
        const data = await loadBenchmarkData();
        if (Object.keys(data).length > 0) {
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

    await deleteDatabase();
    updateDataStatus();
    alert('All data cleared, backup downloaded.');
    location.reload();
}

async function clearAllDataNoBackup() {
    if (!confirm('Clear all data WITHOUT backup? This cannot be undone!')) {
        return;
    }

    await deleteDatabase();
    updateDataStatus();
    alert('All data cleared.');
    location.reload();
}

function setupDropdowns() {
}

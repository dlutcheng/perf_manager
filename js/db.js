const DB_NAME = 'BenchmarkDB';
const DB_VERSION = 2;
const STORE_DATA = 'benchmark_data';
const STORE_EXTRA = 'extra_fields';
const STORE_OPERATORS = 'operators_data';
let db = null;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_DATA)) {
                database.createObjectStore(STORE_DATA, { keyPath: 'id' });
            }
            if (!database.objectStoreNames.contains(STORE_EXTRA)) {
                database.createObjectStore(STORE_EXTRA, { keyPath: 'id' });
            }
            if (!database.objectStoreNames.contains(STORE_OPERATORS)) {
                database.createObjectStore(STORE_OPERATORS, { keyPath: 'id' });
            }
        };
    });
}

async function initDatabase() {
    if (db) return true;

    try {
        db = await openDatabase();
        return true;
    } catch (error) {
        console.error('Database initialization failed:', error);
        return false;
    }
}

function loadFromStore(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result ? request.result.data : null);
    });
}

function saveToStore(storeName, key, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put({ id: key, data });

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

function deleteFromStore(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

function clearStore(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

async function loadBenchmarkData() {
    if (!db) return {};

    try {
        const data = await loadFromStore(STORE_DATA, 'main');
        return data || {};
    } catch (error) {
        console.error('Failed to load benchmark data:', error);
        return {};
    }
}

async function saveBenchmarkData(data) {
    if (!db) return false;

    try {
        await saveToStore(STORE_DATA, 'main', data);
        return true;
    } catch (error) {
        console.error('Failed to save benchmark data:', error);
        return false;
    }
}

async function loadAllExtraFields() {
    if (!db) return {};

    try {
        const data = await loadFromStore(STORE_EXTRA, 'all');
        return data || {};
    } catch (error) {
        console.error('Failed to load extra fields:', error);
        return {};
    }
}

async function saveExtraFieldsForVendor(benchmark, vendor, fields) {
    if (!db) return false;

    try {
        const allFields = await loadAllExtraFields();
        if (!allFields[benchmark]) {
            allFields[benchmark] = {};
        }
        allFields[benchmark][vendor] = fields;
        await saveToStore(STORE_EXTRA, 'all', allFields);
        return true;
    } catch (error) {
        console.error('Failed to save extra fields:', error);
        return false;
    }
}

async function deleteExtraFieldsForBenchmark(benchmark) {
    if (!db) return false;

    try {
        const allFields = await loadAllExtraFields();
        delete allFields[benchmark];
        await saveToStore(STORE_EXTRA, 'all', allFields);
        return true;
    } catch (error) {
        console.error('Failed to delete extra fields:', error);
        return false;
    }
}

async function deleteExtraFieldsForVendor(benchmark, vendor) {
    if (!db) return false;

    try {
        const allFields = await loadAllExtraFields();
        if (allFields[benchmark]) {
            delete allFields[benchmark][vendor];
        }
        await saveToStore(STORE_EXTRA, 'all', allFields);
        return true;
    } catch (error) {
        console.error('Failed to delete extra fields:', error);
        return false;
    }
}

window.initDatabase = initDatabase;
window.loadBenchmarkData = loadBenchmarkData;
window.dbSaveBenchmarkData = saveBenchmarkData;
window.loadAllExtraFields = loadAllExtraFields;
window.saveExtraFieldsForVendor = saveExtraFieldsForVendor;
window.dbSaveExtraFieldsForVendor = saveExtraFieldsForVendor;
window.deleteExtraFieldsForBenchmark = deleteExtraFieldsForBenchmark;
window.deleteExtraFieldsForVendor = deleteExtraFieldsForVendor;

function deleteDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => {
            db = null;
            resolve();
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => {
            console.warn('Database delete blocked');
            db = null;
            resolve();
        };
    });
}

window.deleteDatabase = deleteDatabase;

async function loadAllOperatorsData() {
    if (!db) return {};

    try {
        const data = await loadFromStore(STORE_OPERATORS, 'all');
        return data || {};
    } catch (error) {
        console.error('Failed to load operators data:', error);
        return {};
    }
}

async function saveOperatorsDataForRecord(benchmark, vendor, configuration, date, recordIndex, operators) {
    if (!db) return false;

    try {
        const allData = await loadAllOperatorsData();
        if (!allData[benchmark]) allData[benchmark] = {};
        if (!allData[benchmark][vendor]) allData[benchmark][vendor] = {};
        if (!allData[benchmark][vendor][configuration]) allData[benchmark][vendor][configuration] = {};
        if (!allData[benchmark][vendor][configuration][date]) allData[benchmark][vendor][configuration][date] = [];
        allData[benchmark][vendor][configuration][date][recordIndex] = operators;
        await saveToStore(STORE_OPERATORS, 'all', allData);
        return true;
    } catch (error) {
        console.error('Failed to save operators data:', error);
        return false;
    }
}

async function getOperatorsDataForRecord(benchmark, vendor, configuration, date, recordIndex) {
    const allData = await loadAllOperatorsData();
    const dateArr = allData[benchmark]?.[vendor]?.[configuration]?.[date];
    if (!dateArr) return null;
    if (recordIndex !== undefined) {
        return dateArr[recordIndex] || null;
    }
    return dateArr[0] || null;
}

async function getOperatorsDatesForConfig(benchmark, vendor, configuration) {
    const allData = await loadAllOperatorsData();
    const configData = allData[benchmark]?.[vendor]?.[configuration] || {};
    const result = [];
    for (const [date, arr] of Object.entries(configData)) {
        if (arr && arr.length > 0) {
            for (let i = 0; i < arr.length; i++) {
                if (arr[i]) {
                    result.push({ date, index: i, label: arr.length > 1 ? `${date} #${i + 1}` : date });
                }
            }
        }
    }
    result.sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index);
    return result;
}

async function hasOperatorsDataForRecord(benchmark, vendor, configuration, date, recordIndex) {
    const allData = await loadAllOperatorsData();
    const dateArr = allData[benchmark]?.[vendor]?.[configuration]?.[date];
    if (!dateArr) return false;
    return !!dateArr[recordIndex];
}

async function deleteOperatorsDataForRecord(benchmark, vendor, configuration, date, recordIndex) {
    if (!db) return false;

    try {
        const allData = await loadAllOperatorsData();
        const configData = allData[benchmark]?.[vendor]?.[configuration];
        if (!configData) return true;

        const dateArr = configData[date];
        if (!dateArr) return true;

        dateArr.splice(recordIndex, 1);

        const nonEmpty = dateArr.filter(item => item !== undefined && item !== null);
        if (nonEmpty.length === 0) {
            delete configData[date];
        } else {
            configData[date] = nonEmpty;
        }

        if (Object.keys(configData).length === 0) {
            delete allData[benchmark][vendor][configuration];
        }

        await saveToStore(STORE_OPERATORS, 'all', allData);
        return true;
    } catch (error) {
        console.error('Failed to delete operators data for record:', error);
        return false;
    }
}

async function deleteOperatorsDataForBenchmark(benchmark) {
    if (!db) return false;

    try {
        const allData = await loadAllOperatorsData();
        delete allData[benchmark];
        await saveToStore(STORE_OPERATORS, 'all', allData);
        return true;
    } catch (error) {
        console.error('Failed to delete operators data for benchmark:', error);
        return false;
    }
}

async function deleteOperatorsDataForVendor(benchmark, vendor) {
    if (!db) return false;

    try {
        const allData = await loadAllOperatorsData();
        if (allData[benchmark]) {
            delete allData[benchmark][vendor];
        }
        await saveToStore(STORE_OPERATORS, 'all', allData);
        return true;
    } catch (error) {
        console.error('Failed to delete operators data for vendor:', error);
        return false;
    }
}

window.loadAllOperatorsData = loadAllOperatorsData;
window.saveOperatorsDataForRecord = saveOperatorsDataForRecord;
window.getOperatorsDataForRecord = getOperatorsDataForRecord;
window.getOperatorsDatesForConfig = getOperatorsDatesForConfig;
window.hasOperatorsDataForRecord = hasOperatorsDataForRecord;
window.deleteOperatorsDataForRecord = deleteOperatorsDataForRecord;
window.deleteOperatorsDataForBenchmark = deleteOperatorsDataForBenchmark;
window.deleteOperatorsDataForVendor = deleteOperatorsDataForVendor;
window.saveOperatorsAllData = function(allData) { return saveToStore(STORE_OPERATORS, 'all', allData); };

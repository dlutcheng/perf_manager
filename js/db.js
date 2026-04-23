const DB_NAME = 'BenchmarkDB';
const DB_VERSION = 1;
const STORE_DATA = 'benchmark_data';
const STORE_EXTRA = 'extra_fields';
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

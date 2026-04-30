window.alertInfo = (text) => {
    return Swal.fire({ title: 'Info', text, icon: 'info',
        confirmButtonColor: '#00d4aa', background: '#0f172a', color: '#e2e8f0' });
};
window.alertOk = (text) => {
    return Swal.fire({ title: 'Success', text, icon: 'success',
        confirmButtonColor: '#00d4aa', background: '#0f172a', color: '#e2e8f0' });
};
window.alertError = (text) => {
    return Swal.fire({ title: 'Error', text, icon: 'error',
        confirmButtonColor: '#f87171', background: '#0f172a', color: '#e2e8f0' });
};
window.confirmDanger = async (title, text) => {
    const r = await Swal.fire({ title, text, icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#f87171', cancelButtonColor: '#64748b',
        background: '#0f172a', color: '#e2e8f0' });
    return r.isConfirmed;
};
window.promptField = async (defaultVal) => {
    const r = await Swal.fire({ title: 'New Field', input: 'text',
        inputPlaceholder: 'e.g., Power(W)', inputValue: defaultVal || '',
        confirmButtonColor: '#00d4aa', background: '#0f172a', color: '#e2e8f0',
        showCancelButton: true });
    return r.isConfirmed ? r.value : null;
};
window.promptFieldType = async () => {
    const r = await Swal.fire({ title: 'Field Type', input: 'select',
        inputOptions: { '1': 'Integer', '2': 'Float', '3': 'String' },
        inputValue: '2', confirmButtonColor: '#00d4aa',
        background: '#0f172a', color: '#e2e8f0', showCancelButton: true });
    return r.isConfirmed ? r.value : null;
};

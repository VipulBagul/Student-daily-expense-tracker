// Improved expense tracker with filters, charts, CSV export, edit, dark mode
let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
let editIndex = -1;

const amountEl = document.getElementById('amount');
const categoryEl = document.getElementById('category');
const dateEl = document.getElementById('date');
const notesEl = document.getElementById('notes');
const saveBtn = document.getElementById('saveBtn');
const cancelEditBtn = document.getElementById('cancelEdit');
const expenseTable = document.getElementById('expenseTable');
const filterCategory = document.getElementById('filterCategory');
const filterMonth = document.getElementById('filterMonth');
const searchText = document.getElementById('searchText');

const totalAllEl = document.getElementById('totalAll');
const totalMonthEl = document.getElementById('totalMonth');
const topCategoryEl = document.getElementById('topCategory');
const entryCountEl = document.getElementById('entryCount');

const exportCsvBtn = document.getElementById('exportCsv');
const darkToggle = document.getElementById('darkToggle');

let pieChart = null;
let barChart = null;

function init() {
    populateMonthFilter();
    updateCategoryFilter();
    attachEvents();
    renderAll();
}

function attachEvents() {
    saveBtn.addEventListener('click', handleSave);
    cancelEditBtn.addEventListener('click', cancelEdit);
    filterCategory.addEventListener('change', renderAll);
    filterMonth.addEventListener('change', renderAll);
    searchText.addEventListener('input', renderAll);
    exportCsvBtn.addEventListener('click', exportCsv);
    darkToggle.addEventListener('click', toggleDarkMode);
}

function handleSave() {
    const amount = amountEl.value.trim();
    const category = categoryEl.value.trim();
    const date = dateEl.value;
    const notes = notesEl.value.trim();

    if (!amount || !category || !date) {
        alert('Please fill amount, category and date.');
        return;
    }

    const entry = { amount: Number(amount), category, date, notes };

    if (editIndex >= 0) {
        expenses[editIndex] = entry;
        editIndex = -1;
        saveBtn.textContent = 'Add';
        cancelEditBtn.classList.add('hidden');
        document.getElementById('formTitle').innerText = 'Add Expense';
    } else {
        expenses.push(entry);
    }

    persist();
    clearForm();
    renderAll();
}

function persist() {
    localStorage.setItem('expenses', JSON.stringify(expenses));
}

function clearForm() {
    amountEl.value = '';
    categoryEl.value = '';
    dateEl.value = '';
    notesEl.value = '';
}

function startEdit(index) {
    const e = expenses[index];
    amountEl.value = e.amount;
    categoryEl.value = e.category;
    dateEl.value = e.date;
    notesEl.value = e.notes || '';
    editIndex = index;
    saveBtn.textContent = 'Update';
    cancelEditBtn.classList.remove('hidden');
    document.getElementById('formTitle').innerText = 'Edit Expense';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    editIndex = -1;
    clearForm();
    saveBtn.textContent = 'Add';
    cancelEditBtn.classList.add('hidden');
    document.getElementById('formTitle').innerText = 'Add Expense';
}

function deleteExpense(index) {
    if (!confirm('Delete this entry?')) return;
    expenses.splice(index, 1);
    persist();
    renderAll();
}

function buildFilters() {
    // category filter options
    const cats = Array.from(new Set(expenses.map(e => e.category))).sort();
    // reset but keep 'all'
    filterCategory.innerHTML = '<option value="all">All</option>';
    cats.forEach(c => {
        const o = document.createElement('option');
        o.value = c;
        o.innerText = c;
        filterCategory.appendChild(o);
    });
}

function populateMonthFilter() {
    const monthNames = ["All","01","02","03","04","05","06","07","08","09","10","11","12"];
    filterMonth.innerHTML = '';
    const months = ["all", ...Array.from({length:12}, (_,i)=>String(i+1).padStart(2,'0'))];
    months.forEach(m => {
        const o = document.createElement('option');
        o.value = m;
        o.innerText = (m === 'all') ? 'All' : m;
        filterMonth.appendChild(o);
    });
}

function updateCategoryFilter(){
    buildFilters();
}

function filterExpenses() {
    let list = expenses.slice();

    const cat = filterCategory.value;
    if (cat && cat !== 'all') list = list.filter(e => e.category === cat);

    const month = filterMonth.value;
    if (month && month !== 'all') list = list.filter(e => (new Date(e.date)).getMonth()+1 === Number(month));

    const q = (searchText.value || '').toLowerCase();
    if (q) {
        list = list.filter(e => (e.notes || '').toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
    }
    return list;
}

function renderAll() {
    updateCategoryFilter();
    const list = filterExpenses();

    // render table
    expenseTable.innerHTML = '';
    list.forEach((e, idx) => {
        // find original index in expenses array to perform edit/delete correctly
        const originalIndex = expenses.indexOf(e);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>₹${e.amount}</td>
            <td>${escapeHtml(e.category)}</td>
            <td>${e.date}</td>
            <td>${escapeHtml(e.notes || '')}</td>
            <td>
                <button class="action-btn edit-btn" data-idx="${originalIndex}">Edit</button>
                <button class="action-btn del-btn" data-idx="${originalIndex}">Delete</button>
            </td>
        `;
        expenseTable.appendChild(tr);
    });

    // attach row actions
    document.querySelectorAll('.edit-btn').forEach(b=>{
        b.addEventListener('click', ()=> startEdit(Number(b.dataset.idx)));
    });
    document.querySelectorAll('.del-btn').forEach(b=>{
        b.addEventListener('click', ()=> deleteExpense(Number(b.dataset.idx)));
    });

    // summary
    const total = expenses.reduce((s, x) => s + Number(x.amount || 0), 0);
    totalAllEl.innerText = `₹${total}`;

    const now = new Date();
    const thisMonthTotal = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, x) => s + Number(x.amount || 0), 0);
    totalMonthEl.innerText = `₹${thisMonthTotal}`;

    entryCountEl.innerText = expenses.length;

    // top category
    const catTotals = {};
    expenses.forEach(e => {
        catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount || 0);
    });
    let topCat = '—';
    if (Object.keys(catTotals).length) {
        topCat = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0][0];
    }
    topCategoryEl.innerText = topCat;

    renderCharts();
}

function renderCharts() {
    // pie chart: category distribution (all data)
    const catTotals = {};
    expenses.forEach(e => {
        catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount || 0);
    });
    const labels = Object.keys(catTotals);
    const data = labels.map(l => catTotals[l]);

    const pieCtx = document.getElementById('pieChart').getContext('2d');
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels,
            datasets: [{ data, backgroundColor: generateColors(labels.length) }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });

    // bar chart: totals by month for the current year
    const monthly = Array(12).fill(0);
    expenses.forEach(e => {
        const d = new Date(e.date);
        if (!isNaN(d)) {
            monthly[d.getMonth()] += Number(e.amount || 0);
        }
    });
    const barCtx = document.getElementById('barChart').getContext('2d');
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
            datasets: [{ label: 'Monthly Spend', data: monthly, backgroundColor: generateColors(12) }]
        },
        options: { responsive:true, plugins:{ legend:{ display:false } } }
    });
}

function generateColors(n) {
    // simple pleasant palette generator
    const palette = [
        '#4A60FF','#FF7A59','#FFD66E','#3DDC97','#7C4DFF','#FF6FB5',
        '#66C2FF','#FFB86B','#7BE495','#9EA8FF','#FF8A8A','#B9F18A'
    ];
    const arr = [];
    for (let i=0;i<n;i++) arr.push(palette[i % palette.length]);
    return arr;
}

function exportCsv() {
    const rows = [['Amount','Category','Date','Notes']];
    expenses.forEach(e => rows.push([e.amount, e.category, e.date, (e.notes || '')]));
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function toggleDarkMode(){
    document.body.classList.toggle('dark');
    darkToggle.textContent = document.body.classList.contains('dark') ? '☀ Light' : '🌙 Dark';
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

// Initialize example: ensure month filter options present & render
init();

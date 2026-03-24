/**
 * GTCJ-MD Inventory System Logic
 * Professional Modular Version
 */

let items = JSON.parse(localStorage.getItem("gtcjmd_inventory") || "[]");
let auditLog = JSON.parse(localStorage.getItem("gtcjmd_audit") || "[]");
let propertyCounter = parseInt(localStorage.getItem("gtcjmd_counter") || "1");
let editIndex = null;
let charts = { status: null, div: null };
let itemsPerPage = 10;
let searchTimeout = null;

const AUTH_KEY = 'YWRtaW46Z3Rjam1kMjAyNg=='; // admin:gtcjmd2026

window.onload = () => {
    if (sessionStorage.getItem('gtcjmd_auth') === 'true') {
        document.getElementById('loginOverlay').style.display = 'none';
        init();
    }
    
    // Auth Event Listeners
    [document.getElementById('user'), document.getElementById('pass')].forEach(input => {
        if(input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') auth();
            });
        }
    });
};

// --- AUTHENTICATION ---
function auth() {
    const u = document.getElementById('user').value.trim();
    const p = document.getElementById('pass').value.trim();
    const btn = document.getElementById('loginBtn');
    const err = document.getElementById('loginErr');

    btn.classList.add('loading');
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Authenticating...';
    err.style.display = 'none';

    setTimeout(() => {
        if(btoa(u.toLowerCase() + ':' + p) === AUTH_KEY) {
            sessionStorage.setItem('gtcjmd_auth', 'true');
            document.getElementById('loginOverlay').style.display = 'none';
            showToast("System Initialized", "var(--primary)");
            init();
        } else {
            btn.classList.remove('loading');
            btn.innerHTML = '<i class="fa fa-database"></i> Initialize Database';
            err.style.display = 'block';
            document.querySelector('.login-box').style.borderColor = 'var(--danger)';
        }
    }, 800);
}

function logout() {
    if(confirm("Confirm system lockout?")) {
        sessionStorage.removeItem('gtcjmd_auth');
        location.reload();
    }
}

// --- INITIALIZATION ---
function init() {
    updateAnalytics();
    renderTable(1);
    renderAuditLog();
}

function showToast(msg, color = "var(--primary)") {
    const t = document.getElementById("toast");
    t.innerText = msg;
    t.style.background = color;
    t.style.display = "block";
    setTimeout(() => { t.style.display = "none"; }, 3000);
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + id).style.display = 'block';
    
    // Add active class to clicked nav
    const navs = document.querySelectorAll('.nav-item');
    navs.forEach(nav => {
        if(nav.getAttribute('onclick').includes(`'${id}'`)) nav.classList.add('active');
    });

    if(id === 'dash') updateAnalytics();
    if(id === 'tools') generateStickers();
    if(id === 'sys') renderAuditLog();
}

// --- CORE CRUD OPERATIONS ---
function addItem() {
    const desc = document.getElementById("description").value.trim();
    if(!desc) return alert("Description required");
    
    let isEdit = editIndex !== null;
    let propertyId = isEdit ? items[editIndex].property : `GTCJMD-${String(propertyCounter).padStart(4, '0')}`;
    
    if(!isEdit) { 
        propertyCounter++; 
        localStorage.setItem("gtcjmd_counter", propertyCounter); 
    }

    const data = {
        property: propertyId,
        description: desc,
        quantity: parseInt(document.getElementById("quantity").value) || 1,
        serial: document.getElementById("serial").value || "N/A",
        accountable: document.getElementById("accountable").value || "N/A",
        division: document.getElementById("division").value,
        location: document.getElementById("location").value,
        status: document.getElementById("status").value
    };

    if (isEdit) { 
        items[editIndex] = data; 
        logAction("UPDATED", data);
        editIndex = null; 
    } else { 
        items.push(data); 
        logAction("CREATED", data);
    }

    saveData(); 
    showPage('inventory'); 
    renderTable(1);
    showToast("Asset saved successfully!");
}

function editItem(i) {
    editIndex = i; 
    const item = items[i];
    document.getElementById("description").value = item.description;
    document.getElementById("quantity").value = item.quantity;
    document.getElementById("serial").value = item.serial;
    document.getElementById("accountable").value = item.accountable;
    document.getElementById("division").value = item.division;
    document.getElementById("location").value = item.location;
    document.getElementById("status").value = item.status;
    document.getElementById("formTitle").innerText = "Edit Asset: " + item.property;
    showPage('add');
}

function deleteItem(i) { 
    if(confirm("Permanently delete this item?")) { 
        logAction("DELETED", items[i]);
        items.splice(i, 1); 
        saveData(); 
        renderTable(1); 
        updateAnalytics();
        showToast("Item deleted successfully!", "var(--danger)");
    }
}

function saveData() {
    localStorage.setItem("gtcjmd_inventory", JSON.stringify(items));
}

// --- ANALYTICS & DASHBOARD ---
function updateAnalytics() {
    const totalStock = items.reduce((sum, i) => sum + i.quantity, 0);
    const work = items.filter(i => i.status === 'Working').length;
    const repair = items.filter(i => i.status === 'Under Repair').length;
    const cond = items.filter(i => i.status === 'Condemned').length;

    document.getElementById('statTotal').innerText = totalStock;
    document.getElementById('statWork').innerText = work;
    document.getElementById('statRepair').innerText = repair;
    document.getElementById('statCondemned').innerText = cond;

    const divs = ["Admin", "CRS", "Security and Control", "Welfare and Development", "Logistics", "Operations", "Health", "ICTMD", "Paralegal"];
    const healthBody = document.getElementById("divisionHealthBody");
    healthBody.innerHTML = "";

    const divCounts = {};
    divs.forEach(d => {
        const dItems = items.filter(i => i.division === d);
        const dTotal = dItems.reduce((sum, i) => sum + i.quantity, 0);
        const dWork = dItems.filter(i => i.status === 'Working').length;
        const health = dItems.length > 0 ? Math.round((dWork / dItems.length) * 100) : 100;

        if(dTotal > 0) {
            divCounts[d] = dTotal;
            healthBody.innerHTML += `
                <tr>
                    <td><strong>${d}</strong></td>
                    <td>${dTotal}</td>
                    <td style="color:var(--primary)">${dWork}</td>
                    <td style="color:var(--danger)">${dItems.length - dWork}</td>
                    <td><div style="background:rgba(255,255,255,0.1); width:100px; height:8px; border-radius:4px; overflow:hidden;">
                        <div style="background:var(--primary); width:${health}%; height:100%"></div>
                    </div></td>
                </tr>
            `;
        }
    });
    renderCharts(work, repair, cond, divCounts);
}

function renderCharts(w, r, c, divData) {
    if(charts.status) charts.status.destroy();
    if(charts.div) charts.div.destroy();

    const ctxS = document.getElementById('statusChart');
    if(ctxS) {
        charts.status = new Chart(ctxS, {
            type: 'doughnut',
            data: {
                labels: ['Working', 'Repair', 'Condemned'],
                datasets: [{ data: [w, r, c], backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'], borderWidth: 0 }]
            },
            options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#fff' } } } }
        });
    }

    const ctxD = document.getElementById('divChart');
    if(ctxD) {
        charts.div = new Chart(ctxD, {
            type: 'bar',
            data: {
                labels: Object.keys(divData),
                datasets: [{ label: 'Items', data: Object.values(divData), backgroundColor: '#3b82f6', borderRadius: 8 }]
            },
            options: { maintainAspectRatio: false, scales: { y: { ticks: { color: '#fff' } }, x: { ticks: { color: '#fff' } } }, plugins: { legend: { display: false } } }
        });
    }
}

// --- TABLE RENDERING & SEARCH ---
function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { renderTable(1); }, 300);
}

function clearSearch() {
    document.getElementById('search').value = '';
    renderTable(1);
}

function renderTable(page) {
    const query = document.getElementById("search").value.toLowerCase();
    const divFilt = document.getElementById("filterDiv").value;
    const filtered = items.filter(i => (i.description.toLowerCase().includes(query) || i.property.toLowerCase().includes(query)) && (divFilt === "All" || i.division === divFilt));
    
    const body = document.getElementById("inventoryBody");
    body.innerHTML = "";
    
    const start = (page - 1) * itemsPerPage;
    const pagedItems = filtered.slice(start, start + itemsPerPage);

    pagedItems.forEach((item) => {
        const idx = items.indexOf(item);
        body.innerHTML += `
            <tr>
                <td style="color:var(--primary); font-weight:bold">${item.property}</td>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td style="color:#cbd5e1">${item.accountable}</td>
                <td>${item.division}</td>
                <td>${item.location}</td>
                <td><span class="status-badge ${item.status.replace(/ /g, '_')}">${item.status}</span></td>
                <td>
                    <button class="btn btn-s" onclick="editItem(${idx})"><i class="fa fa-edit"></i></button>
                    <button class="btn btn-d" onclick="deleteItem(${idx})"><i class="fa fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const pagin = document.getElementById("pagination");
    pagin.innerHTML = "";
    for(let i=1; i<=totalPages; i++) {
        pagin.innerHTML += `<button class="btn ${page === i ? 'btn-p' : 'btn-s'}" onclick="renderTable(${i})">${i}</button>`;
    }
}

// --- TOOLS: STICKERS & EXPORT ---
function generateStickers() {
    const grid = document.getElementById('stickerGrid');
    grid.innerHTML = "";
    items.forEach((item, idx) => {
        const container = document.createElement('div');
        container.className = 'sticker-card';
        container.innerHTML = `
            <div style="font-size:10px; font-weight:bold; border-bottom:1px solid #000; width:100%; padding-bottom:3px; margin-bottom:5px;">PROPERTY OF GTCJ-MD</div>
            <div style="font-size:9px; font-weight:bold; color:#555; height:24px; overflow:hidden;">${item.description}</div>
            <svg id="bc-${idx}"></svg>
            <div style="font-size:11px; font-weight:bold; letter-spacing:1px; margin-top:2px;">${item.property}</div>
        `;
        grid.appendChild(container);
        JsBarcode(`#bc-${idx}`, item.property, { format: "CODE128", width: 1.2, height: 40, displayValue: false, margin: 5 });
    });
}

function exportToExcel() {
    const ws = XLSX.utils.json_to_sheet(items);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "GTCJMD_Inventory.xlsx");
}

// --- SYSTEM TOOLS ---
function logAction(action, item) {
    const entry = {
        time: new Date().toLocaleString(),
        action: action,
        id: item.property,
        desc: item.description
    };
    auditLog.unshift(entry);
    if(auditLog.length > 50) auditLog.pop();
    localStorage.setItem("gtcjmd_audit", JSON.stringify(auditLog));
}

function renderAuditLog() {
    const body = document.getElementById("auditLogBody");
    body.innerHTML = auditLog.map(l => `
        <tr>
            <td style="font-size:0.7rem; color:#94a3b8">${l.time}</td>
            <td><b style="color:${l.action === 'DELETED' ? 'var(--danger)' : 'var(--primary)'}">${l.action}</b></td>
            <td style="color:var(--info)">${l.id}</td>
            <td>${l.desc}</td>
        </tr>
    `).join('');
}

function backupData() {
    const blob = new Blob([JSON.stringify({items, auditLog, propertyCounter})], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GTCJMD_Backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
}

function restoreData(event) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = JSON.parse(e.target.result);
        items = data.items;
        auditLog = data.auditLog;
        propertyCounter = data.propertyCounter;
        saveData();
        localStorage.setItem("gtcjmd_audit", JSON.stringify(auditLog));
        localStorage.setItem("gtcjmd_counter", propertyCounter);
        location.reload();
    };
    reader.readAsText(event.target.files[0]);
}

function clearAllData() {
    if(confirm("DANGER: This will format the database. Proceed?")) {
        localStorage.clear();
        location.reload();
    }
}
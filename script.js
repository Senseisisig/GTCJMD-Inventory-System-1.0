/**
 * GTCJ-MD Inventory System - Cloud Version
 * Powered by Supabase
 */

// 1. CONFIGURATION - REPLACE THESE WITH YOUR ACTUAL SUPABASE DETAILS
const SUPABASE_URL = 'https://fwzfbxrchekzwzebxvcj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_T_IxcMGsDVAClIRdkpZD_w_R8EmbNno';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State Management
let items = [];
let auditLog = [];
let propertyCounter = 1;
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
    if (btoa(`${u}:${p}`) === AUTH_KEY) {
        sessionStorage.setItem('gtcjmd_auth', 'true');
        document.getElementById('loginOverlay').style.display = 'none';
        init();
    } else {
        alert("Access Denied: Invalid Credentials");
    }
}

// --- INITIALIZATION ---
async function init() {
    showToast("Connecting to Cloud...");
    await loadFromCloud();
    renderTable();
    updateCharts();
    renderAuditLog();
}

// --- CLOUD DATA ACTIONS ---

async function loadFromCloud() {
    try {
        // Fetch Items
        let { data: invData, error: invErr } = await supabase
            .from('inventory')
            .select('*')
            .order('id', { ascending: true });
        
        if (invErr) throw invErr;
        items = invData || [];

        // Fetch Audit Log (Last 50 entries)
        let { data: logData, error: logErr } = await supabase
            .from('audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (logErr) throw logErr;
        auditLog = logData || [];

        // Get the latest counter based on existing asset IDs
        if (items.length > 0) {
            const lastId = Math.max(...items.map(i => parseInt(i.asset_id.split('-')[1]) || 0));
            propertyCounter = lastId + 1;
        }
    } catch (err) {
        console.error("Cloud Error:", err.message);
        showToast("Error loading data from cloud", "danger");
    }
}

async function addItem() {
    const desc = document.getElementById("desc").value.trim();
    const qty = parseInt(document.getElementById("qty").value);
    const div = document.getElementById("division").value;
    const loc = document.getElementById("location").value;
    const stat = document.getElementById("status").value;

    if (!desc) return alert("Description required");

    const newItem = {
        asset_id: `GTCJMD-${String(propertyCounter).padStart(4, '0')}`,
        description: desc,
        quantity: qty,
        division: div,
        location: loc,
        status: stat,
        date: new Date().toLocaleDateString()
    };

    const { data, error } = await supabase.from('inventory').insert([newItem]).select();

    if (!error) {
        items.push(data[0]);
        propertyCounter++;
        await addAudit("ADDED", newItem.asset_id, desc);
        closeModal();
        renderTable();
        updateCharts();
        showToast("Item Synced Online!");
    }
}

async function deleteItem(id) {
    if (!confirm("Delete this asset permanently?")) return;
    
    const itemToDelete = items.find(i => i.id === id);
    const { error } = await supabase.from('inventory').delete().eq('id', id);

    if (!error) {
        await addAudit("DELETED", itemToDelete.asset_id, itemToDelete.description);
        items = items.filter(i => i.id !== id);
        renderTable();
        updateCharts();
        showToast("Deleted from Cloud");
    }
}

async function addAudit(action, assetId, desc) {
    const entry = {
        time: new Date().toLocaleString(),
        action: action,
        asset_id: assetId,
        details: desc
    };
    
    const { data, error } = await supabase.from('audit_log').insert([entry]).select();
    if (!error) {
        auditLog.unshift(data[0]);
        renderAuditLog();
    }
}

// --- UI & RENDER LOGIC (Same as your original) ---

function renderTable(filtered = items) {
    const body = document.getElementById("inventoryBody");
    body.innerHTML = filtered.map(item => `
        <tr>
            <td><span class="badge badge-info">${item.asset_id}</span></td>
            <td><b>${item.description}</b></td>
            <td>${item.quantity}</td>
            <td>${item.division}</td>
            <td>${item.location}</td>
            <td><span class="status-pill status-${item.status.toLowerCase().replace(' ', '')}">${item.status}</span></td>
            <td>
                <button class="btn btn-s" onclick="generateStickers('${item.asset_id}')"><i class="fa fa-qrcode"></i></button>
                <button class="btn btn-d" onclick="deleteItem(${item.id})"><i class="fa fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderAuditLog() {
    const body = document.getElementById("auditLogBody");
    if(!body) return;
    body.innerHTML = auditLog.map(l => `
        <tr>
            <td style="font-size:0.7rem; color:#94a3b8">${l.time || l.created_at}</td>
            <td><b style="color:${l.action === 'DELETED' ? 'var(--danger)' : 'var(--primary)'}">${l.action}</b></td>
            <td style="color:var(--info)">${l.asset_id}</td>
            <td>${l.details}</td>
        </tr>
    `).join('');
}

function showToast(msg, type = "primary") {
    const toast = document.getElementById("toast");
    toast.innerText = msg;
    toast.style.background = type === "danger" ? "var(--danger)" : "var(--primary)";
    toast.style.display = "block";
    setTimeout(() => { toast.style.display = "none"; }, 3000);
}

// Modal & Search Utilities
function openModal() { document.getElementById("modal").style.display = "flex"; }
function closeModal() { document.getElementById("modal").style.display = "none"; }

function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const query = document.getElementById("search").value.toLowerCase();
        const filtered = items.filter(i => 
            i.description.toLowerCase().includes(query) || 
            i.asset_id.toLowerCase().includes(query)
        );
        renderTable(filtered);
    }, 300);
}

// Navigation
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(`page-${pageId}`).style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

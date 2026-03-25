/**
 * GTCJ-MD Inventory System - Cloud Version 1.0
 * Fixed ID Mismatches and Enhanced Form Logic
 */

// 1. CONFIGURATION
const SUPABASE_URL = 'https://fwzfbxrchekzwzebxvcj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_T_IxcMGsDVAClIRdkpZD_w_R8EmbNno';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State Management
let items = [];
let auditLog = [];
let propertyCounter = 1;
let charts = { status: null, div: null };
let searchTimeout = null;

const AUTH_KEY = 'YWRtaW46Z3Rjam1kMjAyNg=='; // admin:gtcjmd2026

window.onload = () => {
    if (sessionStorage.getItem('gtcjmd_auth') === 'true') {
        document.getElementById('loginOverlay').style.display = 'none';
        init();
    }
    
    // Auth Event Listeners
    const userField = document.getElementById('user');
    const passField = document.getElementById('pass');
    [userField, passField].forEach(input => {
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
        const err = document.getElementById('loginErr');
        if(err) err.style.display = 'block';
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
        let { data: invData, error: invErr } = await supabase
            .from('inventory')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (invErr) throw invErr;
        items = invData || [];

        let { data: logData, error: logErr } = await supabase
            .from('audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (logErr) throw logErr;
        auditLog = logData || [];

        // Sync property counter to highest existing ID
        if (items.length > 0) {
            const ids = items.map(i => {
                const parts = i.asset_id.split('-');
                return parts.length > 1 ? parseInt(parts[1]) : 0;
            });
            propertyCounter = Math.max(...ids) + 1;
        }
    } catch (err) {
        console.error("Cloud Error:", err.message);
        showToast("Error loading cloud data", "danger");
    }
}

async function addItem() {
    // FIXED: Changed IDs to match index.html (e.g., "description" vs "desc")
    const desc = document.getElementById("description").value.trim();
    const qty = parseInt(document.getElementById("quantity").value) || 1;
    const serial = document.getElementById("serial").value.trim();
    const accountable = document.getElementById("accountable").value.trim();
    const div = document.getElementById("division").value;
    const loc = document.getElementById("location").value;
    const stat = document.getElementById("status").value;

    if (!desc) {
        showToast("Description is required", "danger");
        return;
    }

    const saveBtn = document.getElementById("saveBtn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Syncing...';

    const newItem = {
        asset_id: `GTCJMD-${String(propertyCounter).padStart(4, '0')}`,
        description: desc,
        quantity: qty,
        serial_number: serial,
        accountable_person: accountable,
        division: div,
        location: loc,
        status: stat,
        created_at: new Date().toISOString()
    };

    try {
        const { data, error } = await supabase.from('inventory').insert([newItem]).select();

        if (error) throw error;

        items.unshift(data[0]);
        propertyCounter++;
        await addAudit("ADDED", newItem.asset_id, desc);
        
        clearForm();
        showPage('inventory');
        renderTable();
        updateCharts();
        showToast("Asset Synced Successfully!");
    } catch (err) {
        console.error("Insert Error:", err.message);
        showToast("Sync Failed: " + err.message, "danger");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Save Asset';
    }
}

function clearForm() {
    ["description", "serial", "accountable"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("quantity").value = 1;
}

// --- UI & RENDER LOGIC ---
function renderTable(filtered = items) {
    const body = document.getElementById("inventoryBody");
    if(!body) return;
    
    body.innerHTML = filtered.map(item => `
        <tr>
            <td><span class="status-badge Working" style="font-family: monospace;">${item.asset_id}</span></td>
            <td><b>${item.description}</b><br><small style="color:#94a3b8">${item.serial_number || 'No Serial'}</small></td>
            <td>${item.quantity}</td>
            <td>${item.accountable_person || 'N/A'}</td>
            <td>${item.division}</td>
            <td>${item.location}</td>
            <td><span class="status-badge ${item.status.replace(' ', '_')}">${item.status}</span></td>
            <td>
                <button class="btn btn-s" onclick="generateStickers('${item.asset_id}')" title="Barcode"><i class="fa fa-barcode"></i></button>
                <button class="btn btn-d" onclick="deleteItem(${item.id})" title="Delete"><i class="fa fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function deleteItem(dbId) {
    if (!confirm("Are you sure you want to delete this asset?")) return;
    
    const itemToDelete = items.find(i => i.id === dbId);
    const { error } = await supabase.from('inventory').delete().eq('id', dbId);

    if (!error) {
        await addAudit("DELETED", itemToDelete.asset_id, itemToDelete.description);
        items = items.filter(i => i.id !== dbId);
        renderTable();
        updateCharts();
        showToast("Item removed from cloud", "warning");
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
    if (!error && data) {
        auditLog.unshift(data[0]);
        renderAuditLog();
    }
}

function renderAuditLog() {
    const body = document.getElementById("auditLogBody");
    if(!body) return;
    body.innerHTML = auditLog.slice(0, 20).map(l => `
        <tr>
            <td style="font-size:0.7rem; color:#94a3b8">${l.time || new Date(l.created_at).toLocaleString()}</td>
            <td><b style="color:${l.action === 'DELETED' ? 'var(--danger)' : 'var(--primary)'}">${l.action}</b></td>
            <td style="color:var(--info)">${l.asset_id}</td>
            <td>${l.details}</td>
        </tr>
    `).join('');
}

function showToast(msg, type = "primary") {
    const toast = document.getElementById("toast");
    if(!toast) return;
    toast.innerText = msg;
    toast.style.background = type === "danger" ? "var(--danger)" : (type === "warning" ? "var(--warning)" : "var(--primary)");
    toast.style.display = "block";
    setTimeout(() => { toast.style.display = "none"; }, 3000);
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(`page-${pageId}`).style.display = 'block';
    
    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.remove('active');
        if(n.getAttribute('onclick')?.includes(pageId)) n.classList.add('active');
    });
}

function updateCharts() {
    // Placeholder for Chart.js logic - ensures dashboard stays updated
    console.log("Dashboard Stats Updated:", items.length, "assets found.");
}

// Initialize Supabase
const _supabaseUrl = 'YOUR_SUPABASE_URL';
const _supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = supabase.createClient(_supabaseUrl, _supabaseKey);

let items = [];

// --- CORE FUNCTIONS ---

// Fetch data from Supabase
async function fetchItems() {
    const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) console.error('Error fetching:', error);
    else renderItems(data);
}

// Generate PAR (Property Acknowledgement Receipt)
function generatePAR(i) {
    let item = items[i];
    let w = window.open("", "_blank");
    if(!w) return alert("Pop-up blocked! Please allow pop-ups for this site.");
    
    w.document.write(`
        <html>
        <head>
            <title>PAR - ${item.property}</title>
            <style>
                body { font-family: serif; padding: 40px; line-height: 1.6; color: #000; background: #fff; }
                .header { text-align: center; border-bottom: 2px solid black; margin-bottom: 20px; }
                .details { margin: 30px 0; }
                .row { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding: 8px 0; }
                .footer { margin-top: 80px; display: grid; grid-template-columns: 1fr 1fr; gap: 50px; }
                .sign { border-top: 1px solid black; text-align: center; padding-top: 5px; margin-top: 40px; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body>
            <div class="no-print" style="text-align:right;"><button onclick="window.print()">Print Document</button></div>
            <div class="header">
                <h2>PROPERTY ACKNOWLEDGEMENT RECEIPT</h2>
                <p>General Trias City Jail Male Dormitory</p>
            </div>
            <div class="details">
                <div class="row"><span>Property Number:</span> <strong>${item.property || 'N/A'}</strong></div>
                <div class="row"><span>Item Description:</span> <strong>${item.description || 'N/A'}</strong></div>
                <div class="row"><span>Quantity:</span> <strong>${item.quantity || 1}</strong></div>
                <div class="row"><span>Serial Number:</span> <strong>${item.serial || 'N/A'}</strong></div>
                <div class="row"><span>Location:</span> <strong>${item.location || 'N/A'}</strong></div>
            </div>
            <p><i>This is to acknowledge receipt of the property listed above for which I am accountable for its proper use and maintenance.</i></p>
            <div class="footer">
                <div class="sign"><strong>${item.accountable || '________________'}</strong><br>Received By</div>
                <div class="sign"><strong>JO1 Dexter Jao B Isaga, Chief Logistics</strong><br>Issued By</div>
            </div>
        </body>
        </html>
    `);
    w.document.close();
}

// Render the items to the screen
function renderItems(data) {
    items = data;
    const container = document.getElementById('inventoryContainer');
    container.innerHTML = "";

    items.forEach((item, i) => {
        const card = document.createElement('div');
        card.className = "item-card";
        card.innerHTML = `
            <div class="item-info">
                <span class="location-badge">${item.location}</span>
                <h3>${item.description}</h3>
                <p><strong>Property #:</strong> ${item.property}</p>
                <p><strong>Serial:</strong> ${item.serial}</p>
                <p><strong>Accountable:</strong> ${item.accountable}</p>
            </div>
            <div class="item-actions">
                <button onclick="generatePAR(${i})" class="btn-stealth" style="border-color: #ffd700; color: #ffd700;">Print PAR</button>
                <button onclick="deleteItem(${item.id})" class="btn-danger">Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// Add Item Logic
document.getElementById('saveBtn').addEventListener('click', async () => {
    const newItem = {
        property: document.getElementById('property').value,
        description: document.getElementById('description').value,
        quantity: document.getElementById('quantity').value,
        serial: document.getElementById('serial').value,
        accountable: document.getElementById('accountable').value,
        location: document.getElementById('locationSelect').value
    };

    const { error } = await supabase.from('inventory').insert([newItem]);
    if (error) alert("Error saving data");
    else {
        fetchItems();
        // Clear inputs
        document.querySelectorAll('input').forEach(input => input.value = "");
    }
});

// Delete Logic
async function deleteItem(id) {
    if(confirm("Are you sure you want to delete this item?")) {
        await supabase.from('inventory').delete().eq('id', id);
        fetchItems();
    }
}

// Initial Load
fetchItems();

// Configuration
const LIFF_ID = 'YOUR_LIFF_ID'; // Replace with your LINE LIFF ID
const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_SCRIPT_WEB_APP_URL'; // Replace with your Google Apps Script Web App URL

// Admin LINE user IDs
const ADMIN_IDS = ['admin1_line_id', 'admin2_line_id']; // Replace with actual LINE user IDs of administrators

// PPE item translations
const PPE_TYPES = {
    'helmet': 'หมวกนิรภัย',
    'gloves': 'ถุงมือนิรภัย',
    'boots': 'รองเท้านิรภัย',
    'vest': 'เสื้อสะท้อนแสง',
    'glasses': 'แว่นตานิรภัย',
    'mask': 'หน้ากากป้องกัน',
    'earplug': 'ที่อุดหู'
};

// Global variables
let userData = {
    userId: '',
    displayName: '',
    pictureUrl: '',
    isAdmin: false
};

// Initialize the LIFF app
document.addEventListener('DOMContentLoaded', function() {
    initializeLiff();
});

function initializeLiff() {
    liff.init({
        liffId: LIFF_ID
    }).then(() => {
        // Check if the user is logged in
        if (!liff.isLoggedIn()) {
            liff.login();
        } else {
            // Get user profile
            liff.getProfile()
                .then(profile => {
                    userData.userId = profile.userId;
                    userData.displayName = profile.displayName;
                    userData.pictureUrl = profile.pictureUrl;
                    
                    // Check if user is admin
                    userData.isAdmin = ADMIN_IDS.includes(profile.userId);
                    
                    // Display appropriate panel
                    showUserInterface();
                })
                .catch(err => {
                    console.error('Error getting profile:', err);
                    showError('ไม่สามารถดึงข้อมูลผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง');
                });
        }
    }).catch(err => {
        console.error('LIFF initialization failed', err);
        showError('ไม่สามารถเริ่มต้นแอปพลิเคชันได้ กรุณาลองใหม่อีกครั้ง');
    });
}

function showUserInterface() {
    // Hide loading
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    
    if (userData.isAdmin) {
        // Show admin panel
        document.getElementById('adminPanel').style.display = 'block';
        document.getElementById('adminName').textContent = userData.displayName;
        
        // Load admin data
        loadPendingRequests();
        loadInventory();
        setupAdminEventListeners();
    } else {
        // Show user panel
        document.getElementById('userPanel').style.display = 'block';
        document.getElementById('userName').textContent = userData.displayName;
        document.getElementById('userID').textContent = userData.userId.substring(0, 8);
        
        // Load user data
        loadUserRequestHistory();
        setupUserEventListeners();
    }
}

// User Functions
function setupUserEventListeners() {
    // PPE Request Form Submission
    document.getElementById('ppeRequestForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitPpeRequest();
    });
}

function submitPpeRequest() {
    const ppeType = document.getElementById('ppeType').value;
    const ppeSize = document.getElementById('ppeSize').value;
    const ppeQty = document.getElementById('ppeQty').value;
    const ppeReason = document.getElementById('ppeReason').value;
    
    if (!ppeType || !ppeSize || !ppeQty || !ppeReason) {
        showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
        return;
    }
    
    // Disable the submit button and show loading
    const submitBtn = document.querySelector('#ppeRequestForm button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> กำลังส่งคำขอ...';
    
    // Request data
    const requestData = {
        action: 'submitRequest',
        userId: userData.userId,
        userName: userData.displayName,
        ppeType: ppeType,
        ppeTypeText: PPE_TYPES[ppeType],
        ppeSize: ppeSize,
        ppeQty: parseInt(ppeQty),
        ppeReason: ppeReason,
        requestDate: new Date().toISOString()
    };
    
    // Send request to Google Apps Script
    axios.post(GOOGLE_SCRIPT_URL, requestData)
        .then(response => {
            if (response.data.success) {
                // Reset form
                document.getElementById('ppeRequestForm').reset();
                
                // Show success message
                showToast('ส่งคำขอเบิกอุปกรณ์เรียบร้อยแล้ว', 'success');
                
                // Reload user history
                loadUserRequestHistory();
                
                // Switch to history tab
                const historyTab = document.getElementById('history-tab');
                const bsTab = new bootstrap.Tab(historyTab);
                bsTab.show();
            } else {
                showToast(response.data.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', 'error');
            }
        })
        .catch(error => {
            console.error('Error submitting request:', error);
            showToast('เกิดข้อผิดพลาดในการส่งคำขอ กรุณาลองใหม่อีกครั้ง', 'error');
        })
        .finally(() => {
            // Re-enable the submit button
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        });
}

function loadUserRequestHistory() {
    document.getElementById('loadingHistory').style.display = 'block';
    document.getElementById('historyItems').innerHTML = '';
    
    // Request data
    const requestData = {
        action: 'getUserHistory',
        userId: userData.userId
    };
    
    // Send request to Google Apps Script
    axios.post(GOOGLE_SCRIPT_URL, requestData)
        .then(response => {
            document.getElementById('loadingHistory').style.display = 'none';
            
            if (response.data.success) {
                const history = response.data.data;
                
                if (history.length === 0) {
                    document.getElementById('historyItems').innerHTML = '<div class="text-center text-muted">ไม่พบประวัติการเบิกอุปกรณ์</div>';
                } else {
                    displayUserHistory(history);
                }
            } else {
                document.getElementById('historyItems').innerHTML = '<div class="text-center text-danger">ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง</div>';
            }
        })
        .catch(error => {
            console.error('Error loading history:', error);
            document.getElementById('loadingHistory').style.display = 'none';
            document.getElementById('historyItems').innerHTML = '<div class="text-center text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง</div>';
        });
}

function displayUserHistory(history) {
    const historyContainer = document.getElementById('historyItems');
    historyContainer.innerHTML = '';
    
    history.forEach(item => {
        const statusClass = getStatusClass(item.status);
        const statusText = getStatusText(item.status);
        const requestDate = new Date(item.requestDate).toLocaleDateString('th-TH');
        
        const itemElement = document.createElement('div');
        itemElement.className = 'item-request';
        itemElement.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <h6>${item.ppeTypeText} (${item.ppeSize})</h6>
                <span class="request-status-${statusClass}">${statusText}</span>
            </div>
            <p class="mb-1">จำนวน: ${item.ppeQty} ชิ้น</p>
            <p class="mb-1">เหตุผล: ${item.ppeReason}</p>
            <p class="text-muted small mb-0">วันที่ขอ: ${requestDate}</p>
            ${item.responseMessage ? `<p class="text-muted small mb-0">หมายเหตุ: ${item.responseMessage}</p>` : ''}
        `;
        
        historyContainer.appendChild(itemElement);
    });
}

// Admin Functions
function setupAdminEventListeners() {
    // Generate Report Button
    document.getElementById('generateReport').addEventListener('click', generateReport);
    
    // Refresh Inventory Button
    document.getElementById('refreshInventory').addEventListener('click', loadInventory);
    
    // Update Inventory Form
    document.getElementById('updateInventoryForm').addEventListener('submit', function(e) {
        e.preventDefault();
        updateInventory();
    });
}

function loadPendingRequests() {
    document.getElementById('loadingPending').style.display = 'block';
    document.getElementById('pendingItems').innerHTML = '';
    
    // Request data
    const requestData = {
        action: 'getPendingRequests'
    };
    
    // Send request to Google Apps Script
    axios.post(GOOGLE_SCRIPT_URL, requestData)
        .then(response => {
            document.getElementById('loadingPending').style.display = 'none';
            
            if (response.data.success) {
                const pendingRequests = response.data.data;
                
                if (pendingRequests.length === 0) {
                    document.getElementById('pendingItems').innerHTML = '<div class="text-center text-muted">ไม่มีคำขอที่รอการอนุมัติ</div>';
                } else {
                    displayPendingRequests(pendingRequests);
                }
            } else {
                document.getElementById('pendingItems').innerHTML = '<div class="text-center text-danger">ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง</div>';
            }
        })
        .catch(error => {
            console.error('Error loading pending requests:', error);
            document.getElementById('loadingPending').style.display = 'none';
            document.getElementById('pendingItems').innerHTML = '<div class="text-center text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง</div>';
        });
}

function displayPendingRequests(requests) {
    const container = document.getElementById('pendingItems');
    container.innerHTML = '';
    
    requests.forEach(request => {
        const requestDate = new Date(request.requestDate).toLocaleDateString('th-TH');
        
        const itemElement = document.createElement('div');
        itemElement.className = 'item-request';
        itemElement.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <h6>${request.ppeTypeText} (${request.ppeSize})</h6>
                <span class="badge bg-warning">รออนุมัติ</span>
            </div>
            <p class="mb-1">ผู้ขอ: ${request.userName}</p>
            <p class="mb-1">จำนวน: ${request.ppeQty} ชิ้น</p>
            <p class="mb-1">เหตุผล: ${request.ppeReason}</p>
            <p class="text-muted small mb-2">วันที่ขอ: ${requestDate}</p>
            
            <div class="d-flex mt-2">
                <input type="text" class="form-control form-control-sm me-2" placeholder="หมายเหตุ (ถ้ามี)" id="note-${request.id}">
                <button class="btn btn-sm btn-success me-1" onclick="approveRequest('${request.id}')">อนุมัติ</button>
                <button class="btn btn-sm btn-danger" onclick="rejectRequest('${request.id}')">ปฏิเสธ</button>
            </div>
        `;
        
        container.appendChild(itemElement);
    });
}

function approveRequest(requestId) {
    processRequest(requestId, 'approved');
}

function rejectRequest(requestId) {
    processRequest(requestId, 'rejected');
}

function processRequest(requestId, status) {
    const note = document.getElementById(`note-${requestId}`).value;
    
    // Request data
    const requestData = {
        action: 'processRequest',
        requestId: requestId,
        status: status,
        responseMessage: note,
        processedBy: userData.displayName,
        processedById: userData.userId
    };
    
    // Send request to Google Apps Script
    axios.post(GOOGLE_SCRIPT_URL, requestData)
        .then(response => {
            if (response.data.success) {
                showToast(`คำขอได้รับการ ${status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'} เรียบร้อยแล้ว`, 'success');
                loadPendingRequests();
                loadInventory();
            } else {
                showToast(response.data.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', 'error');
            }
        })
        .catch(error => {
            console.error('Error processing request:', error);
            showToast('เกิดข้อผิดพลาดในการดำเนินการ กรุณาลองใหม่อีกครั้ง', 'error');
        });
}

function loadInventory() {
    const inventoryTable = document.getElementById('inventoryData');
    inventoryTable.innerHTML = '<tr><td colspan="3" class="text-center"><div class="spinner-border spinner-border-sm text-secondary" role="status"></div> กำลังโหลดข้อมูล...</td></tr>';
    
    // Request data
    const requestData = {
        action: 'getInventory'
    };
    
    // Send request to Google Apps Script
    axios.post(GOOGLE_SCRIPT_URL, requestData)
        .then(response => {
            if (response.data.success) {
                const inventory = response.data.data;
                
                if (inventory.length === 0) {
                    inventoryTable.innerHTML = '<tr><td colspan="3" class="text-center">ไม่พบข้อมูลคลังสินค้า</td></tr>';
                } else {
                    displayInventory(inventory);
                }
            } else {
                inventoryTable.innerHTML = '<tr><td colspan="3" class="text-center text-danger">ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง</td></tr>';
            }
        })
        .catch(error => {
            console.error('Error loading inventory:', error);
            inventoryTable.innerHTML = '<tr><td colspan="3" class="text-center text-danger">เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง</td></tr>';
        });
}

function displayInventory(inventory) {
    const inventoryTable = document.getElementById('inventoryData');
    inventoryTable.innerHTML = '';
    
    inventory.forEach(item => {
        const row = document.createElement('tr');
        
        // Add warning class for low inventory
        if (item.quantity < 5) {
            row.className = 'table-warning';
        }
        
        row.innerHTML = `
            <td>${PPE_TYPES[item.type] || item.type}</td>
            <td>${item.size}</td>
            <td>${item.quantity}</td>
        `;
        
        inventoryTable.appendChild(row);
    });
}

function updateInventory() {
    const ppeType = document.getElementById('invPpeType').value;
    const ppeSize = document.getElementById('invPpeSize').value;
    const ppeQty = document.getElementById('invPpeQty').value;
    
    if (!ppeType || !ppeSize || !ppeQty) {
        showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
        return;
    }
    
    // Disable the submit button and show loading
    const submitBtn = document.querySelector('#updateInventoryForm button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> กำลังบันทึก...';
    
    // Request data
    const requestData = {
        action: 'updateInventory',
        ppeType: ppeType,
        ppeSize: ppeSize,
        quantity: parseInt(ppeQty),
        updatedBy: userData.displayName,
        updatedById: userData.userId
    };
    
    // Send request to Google Apps Script
    axios.post(GOOGLE_SCRIPT_URL, requestData)
        .then(response => {
            if (response.data.success) {
                // Reset form
                document.getElementById('updateInventoryForm').reset();
                
                // Show success message
                showToast('อัปเดตคลังสินค้าเรียบร้อยแล้ว', 'success');
                
                // Reload inventory
                loadInventory();
            } else {
                showToast(response.data.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', 'error');
            }
        })
        .catch(error => {
            console.error('Error updating inventory:', error);
            showToast('เกิดข้อผิดพลาดในการอัปเดตคลังสินค้า กรุณาลองใหม่อีกครั้ง', 'error');
        })
        .finally(() => {
            // Re-enable the submit button
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        });
}

function generateReport() {
    const reportMonth = document.getElementById('reportMonth').value;
    
    if (!reportMonth) {
        showToast('กรุณาเลือกเดือนที่ต้องการดูรายงาน', 'error');
        return;
    }
    
    const reportResult = document.getElementById('reportResult');
    reportResult.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"></div><p>กำลังสร้างรายงาน...</p></div>';
    
    // Request data
    const requestData = {
        action: 'generateReport',
        month: reportMonth
    };
    
    // Send request to Google Apps Script
    axios.post(GOOGLE_SCRIPT_URL, requestData)
        .then(response => {
            if (response.data.success) {
                const report = response.data.data;
                displayReport(report, reportMonth);
            } else {
                reportResult.innerHTML = '<div class="alert alert-danger">ไม่สามารถสร้างรายงานได้ กรุณาลองใหม่อีกครั้ง</div>';
            }
        })
        .catch(error => {
            console.error('Error generating report:', error);
            reportResult.innerHTML = '<div class="alert alert-danger">เกิดข้อผิดพลาดในการสร้างรายงาน กรุณาลองใหม่อีกครั้ง</div>';
        });
}

function displayReport(report, month) {
    const reportResult = document.getElementById('reportResult');
    
    const [year, monthNum] = month.split('-');
    const monthDate = new Date(year, parseInt(monthNum) - 1, 1);
    const monthName = monthDate.toLocaleString('th-TH', { month: 'long', year: 'numeric' });
    
    let html = `
        <div class="card">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">รายงานประจำเดือน ${monthName}</h5>
            </div>
            <div class="card-body">
                <div class="mb-4">
                    <h6>สรุปการเบิกอุปกรณ์</h6>
                    <table class="table table-bordered table-sm">
                        <thead class="table-light">
                            <tr>
                                <th>อุปกรณ์</th>
                                <th>จำนวนที่เบิก</th>
                            </tr>
                        </thead>
                        <tbody>
    `;
    
    // Add equipment summary rows
    report.summaryByType.forEach(item => {
        html += `
            <tr>
                <td>${PPE_TYPES[item.type] || item.type}</td>
                <td>${item.quantity}</td>
            </tr>
        `;
    });
    
    html += `
                        </tbody>
                    </table>
                </div>
                
                <div>
                    <h6>รายการเบิกทั้งหมด (${report.requests.length} รายการ)</h6>
                    <table class="table table-bordered table-sm">
                        <thead class="table-light">
                            <tr>
                                <th>วันที่เบิก</th>
                                <th>ผู้เบิก</th>
                                <th>อุปกรณ์</th>
                                <th>จำนวน</th>
                                <th>สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
    `;
    
    // Add request detail rows
    report.requests.forEach(req => {
        const requestDate = new Date(req.requestDate).toLocaleDateString('th-TH');
        const statusClass = getStatusClass(req.status);
        const statusText = getStatusText(req.status);
        
        html += `
            <tr>
                <td>${requestDate}</td>
                <td>${req.userName}</td>
                <td>${req.ppeTypeText} (${req.ppeSize})</td>
                <td>${req.ppeQty}</td>
                <td class="request-status-${statusClass}">${statusText}</td>
            </tr>
        `;
    });
    
    html += `
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    reportResult.innerHTML = html;
}

// Helper functions
function getStatusClass(status) {
    switch (status) {
        case 'pending': return 'pending';
        case 'approved': return 'approved';
        case 'rejected': return 'rejected';
        default: return 'pending';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'pending': return 'รออนุมัติ';
        case 'approved': return 'อนุมัติแล้ว';
        case 'rejected': return 'ไม่อนุมัติ';
        default: return 'รออนุมัติ';
    }
}

function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').innerHTML = `
        <div class="alert alert-danger mt-3 text-center">
            <p>${message}</p>
            <button class="btn btn-outline-danger mt-2" onclick="window.location.reload()">ลองใหม่</button>
        </div>
    `;
}

function showToast(message, type = 'info') {
    const toastId = 'toast-' + Date.now();
    const bgClass = type === 'success' ? 'bg-success' : 
                    type === 'error' ? 'bg-danger' : 
                    type === 'warning' ? 'bg-warning' : 'bg-info';
    
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center ${bgClass} text-white border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Add toast to container
    toastContainer.innerHTML += toastHTML;
    
    // Initialize and show toast
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
    toast.show();
    
    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function () {
        toastElement.remove();
    });
}

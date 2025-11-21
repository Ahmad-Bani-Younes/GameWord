// ========================================
// 🔥 Firebase Configuration
// ========================================
const firebaseConfig = {
  apiKey: "AIzaSyB6ktob9HtprzBMx4xF-4yIKvWpLPTtkPo",
  authDomain: "gameword-2416d.firebaseapp.com",
  databaseURL: "https://gameword-2416d-default-rtdb.firebaseio.com",
  projectId: "gameword-2416d",
  storageBucket: "gameword-2416d.firebasestorage.app",
  messagingSenderId: "1020724306382",
  appId: "1:1020724306382:web:c2305f7092c677bd088b9f"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// ========================================
// 🔐 Admin Authentication
// ========================================
const ADMIN_EMAILS = [
    'admin@gameword.com',
    'byahmad338@gmail.com'
];

let currentUser = JSON.parse(localStorage.getItem("user"));

if (!currentUser) {
    alert('⛔ يجب تسجيل الدخول أولاً!');
    location.href = 'login.html';
} else if (!ADMIN_EMAILS.includes(currentUser.email)) {
    alert('⛔ غير مصرح لك بالدخول! هذه الصفحة للمسؤولين فقط.');
    location.href = 'index.html';
} else {
    document.getElementById('adminName').textContent = currentUser.username || currentUser.email.split('@')[0];
    initDashboard();
}

// ========================================
// 📊 Data Storage
// ========================================
let allUsers = [];
let allRooms = [];
let allGames = [];
let stats = {
    totalUsers: 0,
    activeRooms: 0,
    totalGames: 0,
    onlineUsers: 0
};

// ========================================
// 🔧 Helper Functions من firebase-data.js
// ========================================

/**
 * جلب مستخدم واحد
 */
function getUser(userId) {
    return database.ref('users/' + userId).once('value')
        .then(snapshot => snapshot.val());
}

/**
 * جلب جميع المستخدمين
 */
function getAllUsers() {
    return database.ref('users').once('value')
        .then(snapshot => {
            const users = [];
            snapshot.forEach(child => {
                users.push({ ...child.val(), id: child.key });
            });
            return users;
        });
}

/**
 * تحديث بيانات مستخدم
 */
function updateUser(userId, data) {
    return database.ref('users/' + userId).update(data);
}

/**
 * جلب غرفة واحدة
 */
function getRoom(roomId) {
    return database.ref('rooms/' + roomId).once('value')
        .then(snapshot => {
            const room = snapshot.val();
            return room ? { ...room, id: snapshot.key } : null;
        });
}

/**
 * جلب جميع الغرف
 */
function getAllRooms() {
    return database.ref('rooms').once('value')
        .then(snapshot => {
            const rooms = [];
            snapshot.forEach(child => {
                rooms.push({ ...child.val(), id: child.key });
            });
            return rooms;
        });
}

/**
 * تحديث غرفة
 */
function updateRoom(roomId, data) {
    return database.ref('rooms/' + roomId).set(data);
}

/**
 * حذف غرفة
 */
function deleteRoomById(roomId) {
    return database.ref('rooms/' + roomId).remove();
}

// ========================================
// 🚀 Initialize Dashboard
// ========================================
function initDashboard() {
    console.log('🚀 تهيئة لوحة التحكم...');
    listenToUsers();
    listenToRooms();
    setTimeout(() => {
        loadRecentActivity();
    }, 2000);
}

// ========================================
// 👥 Users Management
// ========================================
function listenToUsers() {
    database.ref('users').on('value', snapshot => {
        allUsers = [];
        let onlineCount = 0;
        
        snapshot.forEach(child => {
            const user = { ...child.val(), id: child.key };
            allUsers.push(user);
            
            if (user.lastSeen && Date.now() - user.lastSeen < 300000) {
                onlineCount++;
            }
        });
        
        stats.totalUsers = allUsers.length;
        stats.onlineUsers = onlineCount;
        
        updateStats();
        displayUsers();
    }, error => {
        console.error('خطأ في جلب المستخدمين:', error);
    });
}

function displayUsers() {
    const container = document.getElementById('usersTable');
    
    if (allUsers.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>لا يوجد مستخدمين</p></div>';
        return;
    }
    
    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>المستخدم</th>
                    <th>البريد الإلكتروني</th>
                    <th>تاريخ التسجيل</th>
                    <th>الألعاب</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    allUsers.forEach(user => {
        const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-SA') : 'غير معروف';
        const gamesCount = (user.games ? user.games.length : 0) + (user.wordGames ? user.wordGames.length : 0);
        const isOnline = user.lastSeen && Date.now() - user.lastSeen < 300000;
        const isBanned = user.banned || false;
        
        html += `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.username)}" 
                             class="avatar-small" alt="${user.username}" onerror="this.src='https://ui-avatars.com/api/?name=User'">
                        <strong>${user.username}</strong>
                    </div>
                </td>
                <td>${user.email || 'لا يوجد'}</td>
                <td>${createdDate}</td>
                <td>${gamesCount}</td>
                <td>
                    <span class="badge ${isOnline ? 'active' : 'inactive'}">
                        ${isOnline ? '🟢 متصل' : '⚫ غير متصل'}
                    </span>
                    ${isBanned ? '<span class="badge" style="background:#e74c3c;color:white;">محظور</span>' : ''}
                </td>
                <td>
                    <button class="action-btn view" onclick="viewUser('${user.id}')">
                        <i class="fas fa-eye"></i> عرض
                    </button>
                    <button class="action-btn ${isBanned ? 'view' : 'ban'}" onclick="toggleBanUser('${user.id}', ${isBanned})">
                        <i class="fas fa-ban"></i> ${isBanned ? 'إلغاء الحظر' : 'حظر'}
                    </button>
                    <button class="action-btn delete" onclick="deleteUser('${user.id}')">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function searchUsers(query) {
    if (!query) {
        displayUsers();
        return;
    }
    
    const filtered = allUsers.filter(user => 
        user.username.toLowerCase().includes(query.toLowerCase()) ||
        (user.email && user.email.toLowerCase().includes(query.toLowerCase()))
    );
    
    const container = document.getElementById('usersTable');
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>لا توجد نتائج</p></div>';
        return;
    }
    
    let html = '<table class="data-table"><thead><tr><th>المستخدم</th><th>البريد</th><th>التسجيل</th><th>الألعاب</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>';
    
    filtered.forEach(user => {
        const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('ar-SA') : 'غير معروف';
        const gamesCount = (user.games ? user.games.length : 0) + (user.wordGames ? user.wordGames.length : 0);
        const isOnline = user.lastSeen && Date.now() - user.lastSeen < 300000;
        const isBanned = user.banned || false;
        
        html += `
            <tr>
                <td><div style="display: flex; align-items: center; gap: 10px;"><img src="${user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.username)}" class="avatar-small" onerror="this.src='https://ui-avatars.com/api/?name=User'"><strong>${user.username}</strong></div></td>
                <td>${user.email || 'لا يوجد'}</td>
                <td>${createdDate}</td>
                <td>${gamesCount}</td>
                <td><span class="badge ${isOnline ? 'active' : 'inactive'}">${isOnline ? '🟢 متصل' : '⚫ غير متصل'}</span>${isBanned ? '<span class="badge" style="background:#e74c3c;color:white;margin-right:5px;">محظور</span>' : ''}</td>
                <td>
                    <button class="action-btn view" onclick="viewUser('${user.id}')"><i class="fas fa-eye"></i></button>
                    <button class="action-btn ${isBanned ? 'view' : 'ban'}" onclick="toggleBanUser('${user.id}', ${isBanned})"><i class="fas fa-ban"></i></button>
                    <button class="action-btn delete" onclick="deleteUser('${user.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function viewUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    alert(`
📊 تفاصيل المستخدم:

👤 الاسم: ${user.username}
📧 البريد: ${user.email || 'لا يوجد'}
📅 تاريخ التسجيل: ${user.createdAt ? new Date(user.createdAt).toLocaleString('ar-SA') : 'غير معروف'}
🎮 عدد الألعاب: ${(user.games ? user.games.length : 0) + (user.wordGames ? user.wordGames.length : 0)}
👥 الأصدقاء: ${user.friends ? user.friends.length : 0}
⚫ محظور: ${user.banned ? 'نعم' : 'لا'}
    `);
}

async function toggleBanUser(userId, currentBanStatus) {
    if (!confirm(currentBanStatus ? 'إلغاء حظر هذا المستخدم؟' : 'حظر هذا المستخدم؟')) return;
    
    try {
        await database.ref('users/' + userId).update({
            banned: !currentBanStatus,
            bannedAt: !currentBanStatus ? Date.now() : null
        });
        
        logAction(currentBanStatus ? 'unban_user' : 'ban_user', { userId });
        alert(currentBanStatus ? '✅ تم إلغاء الحظر!' : '✅ تم الحظر!');
    } catch (error) {
        console.error('Error:', error);
        alert('❌ حدث خطأ: ' + error.message);
    }
}

async function deleteUser(userId) {
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع!')) return;
    if (!confirm('❗ تأكيد نهائي: سيتم حذف جميع بياناته!')) return;
    
    try {
        await database.ref('users/' + userId).remove();
        logAction('delete_user', { userId });
        alert('✅ تم الحذف!');
    } catch (error) {
        console.error('Error:', error);
        alert('❌ حدث خطأ: ' + error.message);
    }
}

// ========================================
// 🏠 Rooms Management
// ========================================
function listenToRooms() {
    database.ref('rooms').on('value', snapshot => {
        allRooms = [];
        let activeCount = 0;
        let totalGames = 0;
        
        snapshot.forEach(child => {
            const room = { ...child.val(), id: child.key };
            allRooms.push(room);
            
            if (room.status === 'playing' || room.status === 'waiting') {
                activeCount++;
            }
            
            if (room.status === 'finished') {
                totalGames++;
            }
        });
        
        stats.activeRooms = activeCount;
        stats.totalGames = totalGames;
        
        updateStats();
        displayRooms();
        
        setTimeout(() => {
            filterGames('all');
        }, 500);
    }, error => {
        console.error('خطأ في جلب الغرف:', error);
    });
}

function displayRooms() {
    const container = document.getElementById('roomsTable');
    
    if (allRooms.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-door-open"></i><p>لا توجد غرف</p></div>';
        return;
    }
    
    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>اسم الغرفة</th>
                    <th>النوع</th>
                    <th>المنشئ</th>
                    <th>اللاعبين</th>
                    <th>الجولة</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    allRooms.forEach(room => {
        const creator = allUsers.find(u => u.id === room.creatorId);
        const gameType = room.gameType === 'math' ? '🎮 حساب' : '🎯 كلمات';
        
        html += `
            <tr>
                <td><strong>${room.name}</strong></td>
                <td>${gameType}</td>
                <td>${creator ? creator.username : 'غير معروف'}</td>
                <td>${room.players ? room.players.length : 0}</td>
                <td>${room.currentRound || 0} / ${room.maxRounds}</td>
                <td>
                    <span class="badge ${room.status}">
                        ${room.status === 'waiting' ? '⏳ انتظار' : 
                          room.status === 'playing' ? '▶️ جارية' : '🏁 انتهت'}
                    </span>
                </td>
                <td>
                    <button class="action-btn view" onclick="viewRoom('${room.id}')">
                        <i class="fas fa-eye"></i> عرض
                    </button>
                    <button class="action-btn delete" onclick="deleteRoom('${room.id}')">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function searchRooms(query) {
    if (!query) {
        displayRooms();
        return;
    }
    
    const filtered = allRooms.filter(room => 
        room.name.toLowerCase().includes(query.toLowerCase())
    );
    
    const container = document.getElementById('roomsTable');
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>لا توجد نتائج</p></div>';
        return;
    }
    
    let html = '<table class="data-table"><thead><tr><th>الغرفة</th><th>النوع</th><th>المنشئ</th><th>اللاعبين</th><th>الجولة</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>';
    
    filtered.forEach(room => {
        const creator = allUsers.find(u => u.id === room.creatorId);
        const gameType = room.gameType === 'math' ? '🎮 حساب' : '🎯 كلمات';
        
        html += `
            <tr>
                <td><strong>${room.name}</strong></td>
                <td>${gameType}</td>
                <td>${creator ? creator.username : 'غير معروف'}</td>
                <td>${room.players ? room.players.length : 0}</td>
                <td>${room.currentRound || 0} / ${room.maxRounds}</td>
                <td><span class="badge ${room.status}">${room.status === 'waiting' ? '⏳ انتظار' : room.status === 'playing' ? '▶️ جارية' : '🏁 انتهت'}</span></td>
                <td>
                    <button class="action-btn view" onclick="viewRoom('${room.id}')"><i class="fas fa-eye"></i></button>
                    <button class="action-btn delete" onclick="deleteRoom('${room.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function viewRoom(roomId) {
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return;
    
    const creator = allUsers.find(u => u.id === room.creatorId);
    const players = room.players ? room.players.map(p => p.username).join(', ') : 'لا يوجد';
    
    alert(`
🏠 تفاصيل الغرفة:

📝 الاسم: ${room.name}
🎮 النوع: ${room.gameType === 'math' ? 'الحساب' : 'الكلمات'}
👤 المنشئ: ${creator ? creator.username : 'غير معروف'}
👥 اللاعبين: ${players}
🔢 الجولة: ${room.currentRound || 0} / ${room.maxRounds}
📊 الحالة: ${room.status}
📅 تاريخ الإنشاء: ${room.createdAt ? new Date(room.createdAt).toLocaleString('ar-SA') : 'غير معروف'}
    `);
}

async function deleteRoom(roomId) {
    if (!confirm('حذف هذه الغرفة؟')) return;
    
    try {
        await database.ref('rooms/' + roomId).remove();
        logAction('delete_room', { roomId });
        alert('✅ تم الحذف!');
    } catch (error) {
        console.error('Error:', error);
        alert('❌ حدث خطأ: ' + error.message);
    }
}

// ========================================
// 📊 Update Stats
// ========================================
function updateStats() {
    document.getElementById('totalUsers').textContent = stats.totalUsers;
    document.getElementById('activeRooms').textContent = stats.activeRooms;
    document.getElementById('totalGames').textContent = stats.totalGames;
    document.getElementById('onlineUsers').textContent = stats.onlineUsers;
}

// ========================================
// 📜 Recent Activity
// ========================================
function loadRecentActivity() {
    const container = document.getElementById('recentActivity');
    
    const recentRooms = allRooms
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 5);
    
    if (recentRooms.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>لا يوجد نشاط حديث</p></div>';
        return;
    }
    
    let html = '<ul style="list-style: none; padding: 0;">';
    
    recentRooms.forEach(room => {
        const creator = allUsers.find(u => u.id === room.creatorId);
        const time = room.createdAt ? new Date(room.createdAt).toLocaleString('ar-SA') : 'غير معروف';
        
        html += `
            <li style="padding: 15px; border-bottom: 1px solid #ecf0f1; display: flex; justify-content: space-between;">
                <div>
                    <strong>${room.name}</strong>
                    <p style="font-size: 13px; color: #7f8c8d; margin-top: 5px;">
                        أنشأها ${creator ? creator.username : 'غير معروف'}
                    </p>
                </div>
                <span style="color: #7f8c8d; font-size: 13px;">${time}</span>
            </li>
        `;
    });
    
    html += '</ul>';
    container.innerHTML = html;
}

// ========================================
// 🎯 Navigation
// ========================================
function showSection(sectionName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const clickedItem = Array.from(document.querySelectorAll('.nav-item')).find(item => 
        item.getAttribute('onclick') && item.getAttribute('onclick').includes(sectionName)
    );
    if (clickedItem) {
        clickedItem.classList.add('active');
    }
    
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionName).classList.add('active');
    
    const titles = {
        'dashboard': 'لوحة التحكم',
        'users': 'إدارة المستخدمين',
        'rooms': 'إدارة الغرف',
        'games': 'سجل الألعاب',
        'logs': 'سجل الأحداث',
        'settings': 'الإعدادات'
    };
    document.getElementById('pageTitle').textContent = titles[sectionName];
}

// ========================================
// 🛠️ Utility Functions
// ========================================
async function cleanupOldRooms() {
    if (!confirm('حذف جميع الغرف المنتهية؟')) return;
    
    const oldRooms = allRooms.filter(r => r.status === 'finished');
    
    if (oldRooms.length === 0) {
        alert('لا توجد غرف منتهية!');
        return;
    }
    
    try {
        for (const room of oldRooms) {
            await database.ref('rooms/' + room.id).remove();
        }
        logAction('cleanup_rooms', { count: oldRooms.length });
        alert(`✅ تم حذف ${oldRooms.length} غرفة!`);
    } catch (error) {
        console.error('Error:', error);
        alert('❌ حدث خطأ: ' + error.message);
    }
}

function exportData() {
    const data = {
        users: allUsers,
        rooms: allRooms,
        stats: stats,
        exportDate: new Date().toISOString()
    };
    
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gameword-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    logAction('export_data', { itemCount: allUsers.length + allRooms.length });
    alert('✅ تم التصدير!');
}

function sendNotification() {
    const message = prompt('اكتب رسالة الإشعار:');
    if (!message) return;
    
    database.ref('notifications').push({
        message: message,
        timestamp: Date.now(),
        sender: 'admin'
    }).then(() => {
        logAction('send_notification', { message });
        alert('✅ تم إرسال الإشعار!');
    }).catch(error => {
        console.error('Error:', error);
        alert('❌ حدث خطأ: ' + error.message);
    });
}

async function logAction(action, data = {}) {
    try {
        await database.ref('admin_logs').push({
            action: action,
            admin: currentUser.email,
            adminId: currentUser.id,
            data: data,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('خطأ في حفظ السجل:', error);
    }
}

function clearLogs() {
    if (!confirm('مسح جميع السجلات؟')) return;
    
    database.ref('admin_logs').remove().then(() => {
        alert('✅ تم المسح!');
    }).catch(error => {
        console.error('Error:', error);
        alert('❌ حدث خطأ: ' + error.message);
    });
}

function logout() {
    if (!confirm('تسجيل الخروج؟')) return;
    localStorage.removeItem('user');
    location.href = 'login.html';
}

// ========================================
// 🎮 Games Section
// ========================================
function filterGames(type) {
    const container = document.getElementById('gamesTable');
    
    const filtered = type === 'all' ? allRooms : allRooms.filter(r => r.gameType === type);
    const finishedGames = filtered.filter(r => r.status === 'finished');
    
    if (finishedGames.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-gamepad"></i><p>لا توجد ألعاب منتهية</p></div>';
        return;
    }
    
    let html = '<table class="data-table"><thead><tr><th>الغرفة</th><th>النوع</th><th>الفائز</th><th>النقاط</th><th>التاريخ</th></tr></thead><tbody>';
    
    finishedGames.forEach(room => {
        const winner = room.players ? room.players.sort((a, b) => (b.score || 0) - (a.score || 0))[0] : null;
        const gameType = room.gameType === 'math' ? '🎮 حساب' : '🎯 كلمات';
        const date = room.createdAt ? new Date(room.createdAt).toLocaleDateString('ar-SA') : 'غير معروف';
        
        html += `
            <tr>
                <td>${room.name}</td>
                <td>${gameType}</td>
                <td>${winner ? winner.username : 'لا يوجد'}</td>
                <td>${winner ? winner.score : 0}</td>
                <td>${date}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

// ========================================
// 📜 Logs Display
// ========================================
database.ref('admin_logs').limitToLast(50).on('value', snapshot => {
    const logs = [];
    snapshot.forEach(child => {
        logs.push({ ...child.val(), id: child.key });
    });
    
    const container = document.getElementById('logsTable');
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>لا توجد سجلات</p></div>';
        return;
    }
    
    let html = '<table class="data-table"><thead><tr><th>الإجراء</th><th>المسؤول</th><th>التفاصيل</th><th>التاريخ</th></tr></thead><tbody>';
    
    logs.reverse().forEach(log => {
        const actionNames = {
            'ban_user': '🚫 حظر مستخدم',
            'unban_user': '✅ إلغاء حظر',
            'delete_user': '🗑️ حذف مستخدم',
            'delete_room': '🗑️ حذف غرفة',
            'cleanup_rooms': '🧹 تنظيف الغرف',
            'export_data': '📥 تصدير بيانات',
            'send_notification': '🔔 إرسال إشعار'
        };
        
        const actionName = actionNames[log.action] || log.action;
        const time = new Date(log.timestamp).toLocaleString('ar-SA');
        const details = log.data ? JSON.stringify(log.data).substring(0, 50) : '-';
        
        html += `
            <tr>
                <td>${actionName}</td>
                <td>${log.admin || 'غير معروف'}</td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${details}</td>
                <td>${time}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
});

// =========================================
// 🔔 نظام الإشعارات للأدمن
// =========================================

function toggleSpecificUsers() {
    const targetType = document.getElementById('notifTargetType').value;
    const specificSection = document.getElementById('specificUsersSection');
    
    if (targetType === 'specific') {
        specificSection.style.display = 'block';
        loadUsersForNotification();
    } else {
        specificSection.style.display = 'none';
    }
}

function loadUsersForNotification() {
    getAllUsers().then(users => {
        const adminEmail = 'byahmad338@gmail.com';
        const regularUsers = users.filter(u => u.email !== adminEmail);
        
        let html = '';
        regularUsers.forEach(user => {
            html += `
                <div style="padding: 10px; margin-bottom: 8px; background: #f8f9fa; border-radius: 6px;">
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                        <input type="checkbox" value="${user.id}" class="user-checkbox" style="width: 18px; height: 18px;">
                        <span style="font-weight: 600;">${user.username}</span>
                        <span style="color: #666; font-size: 13px;">(${user.email})</span>
                    </label>
                </div>
            `;
        });
        
        document.getElementById('usersCheckboxList').innerHTML = html;
    });
}

function sendAdminNotification() {
    const title = document.getElementById('notifTitle').value.trim();
    const message = document.getElementById('notifMessage').value.trim();
    const targetType = document.getElementById('notifTargetType').value;
    
    if (!title) {
        alert("الرجاء كتابة عنوان للإشعار!");
        return;
    }
    
    if (!message) {
        alert("الرجاء كتابة نص الإشعار!");
        return;
    }
    
    let targetUsers = [];
    
    if (targetType === 'specific') {
        const checkboxes = document.querySelectorAll('.user-checkbox:checked');
        checkboxes.forEach(cb => {
            targetUsers.push(cb.value);
        });
        
        if (targetUsers.length === 0) {
            alert("الرجاء اختيار مستخدم واحد على الأقل!");
            return;
        }
    }
    
    const notification = {
        title: title,
        message: message,
        targetType: targetType,
        targetUsers: targetUsers,
        timestamp: Date.now(),
        readBy: []
    };
    
    firebase.database().ref('notifications').push(notification)
        .then(() => {
            alert(`✅ تم إرسال الإشعار بنجاح ${targetType === 'all' ? 'لجميع المستخدمين' : 'للمستخدمين المحددين'}!`);
            clearNotificationForm();
        })
        .catch(err => {
            console.error('خطأ:', err);
            alert('حدث خطأ في إرسال الإشعار!');
        });
}

function clearNotificationForm() {
    document.getElementById('notifTitle').value = '';
    document.getElementById('notifMessage').value = '';
    document.getElementById('notifTargetType').value = 'all';
    document.getElementById('specificUsersSection').style.display = 'none';
    document.querySelectorAll('.user-checkbox').forEach(cb => cb.checked = false);
}

// =========================================
// 💬 نظام الرسائل للأدمن
// =========================================

function sendBroadcastMessage() {
    const message = prompt("اكتب الرسالة التي تريد إرسالها لجميع المستخدمين:");
    
    if (!message || !message.trim()) {
        return;
    }
    
    getAllUsers().then(users => {
        const adminEmail = 'byahmad338@gmail.com';
        const adminUser = users.find(u => u.email === adminEmail);
        
        if (!adminUser) {
            alert('خطأ: لم يتم العثور على حساب الأدمن!');
            return;
        }
        
        const regularUsers = users.filter(u => u.email !== adminEmail);
        const timestamp = Date.now();
        
        const messageData = {
            from: String(adminUser.id),
            text: message.trim(),
            time: timestamp,
            seen: false,
            fromAdmin: true
        };
        
        const updatePromises = regularUsers.map(user => {
            return getUser(user.id).then(userData => {
                const messages = userData.messages || [];
                messages.push({
                    ...messageData,
                    to: String(user.id)
                });
                return updateUser(user.id, { messages: messages });
            });
        });
        
        getUser(adminUser.id).then(adminData => {
            const adminMessages = adminData.messages || [];
            regularUsers.forEach(user => {
                adminMessages.push({
                    ...messageData,
                    to: String(user.id)
                });
            });
            return updateUser(adminUser.id, { messages: adminMessages });
        }).then(() => {
            return Promise.all(updatePromises);
        }).then(() => {
            alert(`✅ تم إرسال الرسالة لـ ${regularUsers.length} مستخدم بنجاح!`);
        }).catch(err => {
            console.error('خطأ:', err);
            alert('حدث خطأ في إرسال الرسالة!');
        });
    });
}

function updateAdminInboxBadge() {
    const adminEmail = 'byahmad338@gmail.com';
    
    getAllUsers().then(users => {
        const adminUser = users.find(u => u.email === adminEmail);
        if (!adminUser) return;
        
        const unreadCount = (adminUser.messages || []).filter(m =>
            String(m.to) === String(adminUser.id) &&
            !m.seen &&
            !m.fromAdmin
        ).length;
        
        const badge = document.getElementById('adminInboxBadge');
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    });
}

setInterval(updateAdminInboxBadge, 10000);
updateAdminInboxBadge();

console.log('✅ Admin Dashboard Loaded Successfully!');
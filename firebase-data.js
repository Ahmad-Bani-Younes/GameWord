// ========================================
// 🔥 Firebase Configuration & Initialization
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

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ========================================
// 👥 User Functions - دوال المستخدمين
// ========================================

/**
 * جلب مستخدم واحد
 * @param {string} userId - معرف المستخدم
 * @returns {Promise<Object>} - بيانات المستخدم
 */
function getUser(userId) {
    return database.ref('users/' + userId).once('value')
        .then(snapshot => snapshot.val());
}

/**
 * جلب جميع المستخدمين
 * @returns {Promise<Array>} - مصفوفة المستخدمين
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
 * @param {string} userId - معرف المستخدم
 * @param {Object} data - البيانات المحدثة
 * @returns {Promise}
 */
function updateUser(userId, data) {
    return database.ref('users/' + userId).update(data);
}

/**
 * إنشاء مستخدم جديد
 * @param {Object} userData - بيانات المستخدم
 * @returns {Promise}
 */
function createUser(userData) {
    return database.ref('users/' + userData.id).set(userData);
}

/**
 * حذف مستخدم
 * @param {string} userId - معرف المستخدم
 * @returns {Promise}
 */
function deleteUser(userId) {
    return database.ref('users/' + userId).remove();
}

// ========================================
// 🏠 Room Functions - دوال الغرف
// ========================================

/**
 * جلب غرفة واحدة
 * @param {string} roomId - معرف الغرفة
 * @returns {Promise<Object>} - بيانات الغرفة
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
 * @returns {Promise<Array>} - مصفوفة الغرف
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
 * إنشاء غرفة جديدة
 * @param {Object} roomData - بيانات الغرفة
 * @returns {Promise<Object>} - الغرفة المنشأة مع ID
 */
function createNewRoom(roomData) {
    const newRoomRef = database.ref('rooms').push();
    roomData.id = newRoomRef.key;
    return newRoomRef.set(roomData)
        .then(() => roomData);
}

/**
 * تحديث غرفة
 * @param {string} roomId - معرف الغرفة
 * @param {Object} data - البيانات المحدثة
 * @returns {Promise}
 */
function updateRoom(roomId, data) {
    return database.ref('rooms/' + roomId).set(data);
}

/**
 * حذف غرفة
 * @param {string} roomId - معرف الغرفة
 * @returns {Promise}
 */
function deleteRoomById(roomId) {
    return database.ref('rooms/' + roomId).remove();
}

// ========================================
// 🎮 Game Functions - دوال الألعاب
// ========================================

/**
 * حفظ لعبة في سجل المستخدم
 * @param {string} userId - معرف المستخدم
 * @param {Object} gameData - بيانات اللعبة
 * @param {string} gameType - نوع اللعبة (math أو words)
 * @returns {Promise}
 */
function saveGameToUser(userId, gameData, gameType = 'math') {
    const gameRef = database.ref(`users/${userId}/${gameType === 'math' ? 'games' : 'wordGames'}`).push();
    return gameRef.set(gameData);
}

/**
 * جلب ألعاب مستخدم
 * @param {string} userId - معرف المستخدم
 * @param {string} gameType - نوع اللعبة (math أو words)
 * @returns {Promise<Array>} - مصفوفة الألعاب
 */
function getUserGames(userId, gameType = 'math') {
    const path = gameType === 'math' ? 'games' : 'wordGames';
    return database.ref(`users/${userId}/${path}`).once('value')
        .then(snapshot => {
            const games = [];
            snapshot.forEach(child => {
                games.push({ ...child.val(), id: child.key });
            });
            return games;
        });
}

// ========================================
// 👥 Friends Functions - دوال الأصدقاء
// ========================================

/**
 * إضافة صديق
 * @param {string} userId - معرف المستخدم
 * @param {string} friendId - معرف الصديق
 * @returns {Promise}
 */
function addFriend(userId, friendId) {
    return getUser(userId).then(user => {
        const friends = user.friends || [];
        if (!friends.includes(friendId)) {
            friends.push(friendId);
            return updateUser(userId, { friends });
        }
    });
}

/**
 * إزالة صديق
 * @param {string} userId - معرف المستخدم
 * @param {string} friendId - معرف الصديق
 * @returns {Promise}
 */
function removeFriend(userId, friendId) {
    return getUser(userId).then(user => {
        const friends = user.friends || [];
        const index = friends.indexOf(friendId);
        if (index > -1) {
            friends.splice(index, 1);
            return updateUser(userId, { friends });
        }
    });
}

/**
 * إرسال طلب صداقة
 * @param {string} senderId - معرف المرسل
 * @param {string} receiverId - معرف المستقبل
 * @returns {Promise}
 */
function sendFriendRequest(senderId, receiverId) {
    return Promise.all([
        getUser(senderId),
        getUser(receiverId)
    ]).then(([sender, receiver]) => {
        // إضافة للطلبات المرسلة
        const sent = sender.sent || [];
        if (!sent.includes(receiverId)) {
            sent.push(receiverId);
        }
        
        // إضافة للطلبات المعلقة
        const pending = receiver.pending || [];
        if (!pending.includes(senderId)) {
            pending.push(senderId);
        }
        
        return Promise.all([
            updateUser(senderId, { sent }),
            updateUser(receiverId, { pending })
        ]);
    });
}

/**
 * قبول طلب صداقة
 * @param {string} userId - معرف المستخدم
 * @param {string} friendId - معرف الصديق
 * @returns {Promise}
 */
function acceptFriendRequest(userId, friendId) {
    return Promise.all([
        getUser(userId),
        getUser(friendId)
    ]).then(([user, friend]) => {
        // إضافة للأصدقاء
        const userFriends = user.friends || [];
        const friendFriends = friend.friends || [];
        
        if (!userFriends.includes(friendId)) {
            userFriends.push(friendId);
        }
        if (!friendFriends.includes(userId)) {
            friendFriends.push(userId);
        }
        
        // إزالة من المعلقة والمرسلة
        const pending = user.pending || [];
        const sent = friend.sent || [];
        
        const pendingIndex = pending.indexOf(friendId);
        if (pendingIndex > -1) {
            pending.splice(pendingIndex, 1);
        }
        
        const sentIndex = sent.indexOf(userId);
        if (sentIndex > -1) {
            sent.splice(sentIndex, 1);
        }
        
        return Promise.all([
            updateUser(userId, { friends: userFriends, pending }),
            updateUser(friendId, { friends: friendFriends, sent })
        ]);
    });
}

/**
 * رفض طلب صداقة
 * @param {string} userId - معرف المستخدم
 * @param {string} friendId - معرف الصديق
 * @returns {Promise}
 */
function rejectFriendRequest(userId, friendId) {
    return Promise.all([
        getUser(userId),
        getUser(friendId)
    ]).then(([user, friend]) => {
        // إزالة من المعلقة والمرسلة
        const pending = user.pending || [];
        const sent = friend.sent || [];
        
        const pendingIndex = pending.indexOf(friendId);
        if (pendingIndex > -1) {
            pending.splice(pendingIndex, 1);
        }
        
        const sentIndex = sent.indexOf(userId);
        if (sentIndex > -1) {
            sent.splice(sentIndex, 1);
        }
        
        return Promise.all([
            updateUser(userId, { pending }),
            updateUser(friendId, { sent })
        ]);
    });
}

// ========================================
// 🏆 Leaderboard Functions - دوال المتصدرين
// ========================================

/**
 * جلب المتصدرين
 * @param {number} limit - عدد المتصدرين
 * @returns {Promise<Array>} - مصفوفة المتصدرين
 */
function getLeaderboard(limit = 10) {
    return getAllUsers().then(users => {
        // حساب النقاط الكلية
        return users.map(user => {
            const mathGames = user.games || [];
            const wordGames = user.wordGames || [];
            
            const mathWins = mathGames.filter(g => g.result === 'win').length;
            const wordWins = wordGames.filter(g => g.result === 'win').length;
            
            return {
                ...user,
                totalWins: mathWins + wordWins,
                mathWins,
                wordWins
            };
        })
        .sort((a, b) => b.totalWins - a.totalWins)
        .slice(0, limit);
    });
}

// ========================================
// 📊 Statistics Functions - دوال الإحصائيات
// ========================================

/**
 * حساب إحصائيات مستخدم
 * @param {string} userId - معرف المستخدم
 * @returns {Promise<Object>} - الإحصائيات
 */
function getUserStats(userId) {
    return getUser(userId).then(user => {
        const mathGames = user.games || [];
        const wordGames = user.wordGames || [];
        
        const mathWins = mathGames.filter(g => g.result === 'win').length;
        const mathLosses = mathGames.filter(g => g.result === 'lose').length;
        
        const wordWins = wordGames.filter(g => g.result === 'win').length;
        const wordLosses = wordGames.filter(g => g.result === 'lose').length;
        
        return {
            totalGames: mathGames.length + wordGames.length,
            totalWins: mathWins + wordWins,
            totalLosses: mathLosses + wordLosses,
            mathGames: mathGames.length,
            mathWins,
            mathLosses,
            wordGames: wordGames.length,
            wordWins,
            wordLosses,
            friends: (user.friends || []).length
        };
    });
}

// ========================================
// 🔔 Notifications Functions - دوال الإشعارات
// ========================================

/**
 * إرسال إشعار
 * @param {string} userId - معرف المستخدم
 * @param {Object} notification - بيانات الإشعار
 * @returns {Promise}
 */
function sendNotification(userId, notification) {
    const notifRef = database.ref(`users/${userId}/notifications`).push();
    return notifRef.set({
        ...notification,
        timestamp: Date.now(),
        read: false
    });
}

/**
 * جلب إشعارات المستخدم
 * @param {string} userId - معرف المستخدم
 * @returns {Promise<Array>} - مصفوفة الإشعارات
 */
function getUserNotifications(userId) {
    return database.ref(`users/${userId}/notifications`).once('value')
        .then(snapshot => {
            const notifications = [];
            snapshot.forEach(child => {
                notifications.push({ ...child.val(), id: child.key });
            });
            return notifications.sort((a, b) => b.timestamp - a.timestamp);
        });
}

/**
 * تحديث حالة آخر ظهور
 * @param {string} userId - معرف المستخدم
 * @returns {Promise}
 */
function updateLastSeen(userId) {
    return updateUser(userId, { lastSeen: Date.now() });
}

// ========================================
// 🔍 Search Functions - دوال البحث
// ========================================

/**
 * البحث عن مستخدمين
 * @param {string} query - نص البحث
 * @returns {Promise<Array>} - نتائج البحث
 */
function searchUsers(query) {
    return getAllUsers().then(users => {
        const lowerQuery = query.toLowerCase();
        return users.filter(user => 
            user.username.toLowerCase().includes(lowerQuery) ||
            (user.email && user.email.toLowerCase().includes(lowerQuery))
        );
    });
}

/**
 * البحث عن غرف
 * @param {string} query - نص البحث
 * @returns {Promise<Array>} - نتائج البحث
 */
function searchRooms(query) {
    return getAllRooms().then(rooms => {
        const lowerQuery = query.toLowerCase();
        return rooms.filter(room => 
            room.name.toLowerCase().includes(lowerQuery)
        );
    });
}

// ========================================
// 🛠️ Utility Functions - دوال مساعدة
// ========================================

/**
 * تنظيف الغرف القديمة المنتهية
 * @param {number} daysOld - عمر الغرف بالأيام (افتراضي 7)
 * @returns {Promise<number>} - عدد الغرف المحذوفة
 */
function cleanupOldRooms(daysOld = 7) {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    
    return getAllRooms().then(rooms => {
        const oldRooms = rooms.filter(room => 
            room.status === 'finished' && 
            room.createdAt < cutoffTime
        );
        
        const deletePromises = oldRooms.map(room => deleteRoomById(room.id));
        return Promise.all(deletePromises).then(() => oldRooms.length);
    });
}

/**
 * التحقق من وجود مستخدم
 * @param {string} username - اسم المستخدم
 * @returns {Promise<boolean>}
 */
function userExists(username) {
    return getAllUsers().then(users => {
        return users.some(u => u.username.toLowerCase() === username.toLowerCase());
    });
}

/**
 * التحقق من وجود بريد إلكتروني
 * @param {string} email - البريد الإلكتروني
 * @returns {Promise<boolean>}
 */
function emailExists(email) {
    return getAllUsers().then(users => {
        return users.some(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    });
}

// ========================================
// 📝 Console Log - للتأكد من تحميل الملف
// ========================================
console.log('✅ Firebase Data Module Loaded Successfully!');
console.log('📦 Available Functions:', {
    users: ['getUser', 'getAllUsers', 'updateUser', 'createUser', 'deleteUser'],
    rooms: ['getRoom', 'getAllRooms', 'createNewRoom', 'updateRoom', 'deleteRoomById'],
    games: ['saveGameToUser', 'getUserGames'],
    friends: ['addFriend', 'removeFriend', 'sendFriendRequest', 'acceptFriendRequest', 'rejectFriendRequest'],
    leaderboard: ['getLeaderboard'],
    stats: ['getUserStats'],
    notifications: ['sendNotification', 'getUserNotifications'],
    utility: ['updateLastSeen', 'searchUsers', 'searchRooms', 'cleanupOldRooms', 'userExists', 'emailExists']
});


/**
 * حفظ إشعار في Firebase
 * @param {Object} notification - بيانات الإشعار
 * @returns {Promise<string>} - ID الإشعار
 */
function saveNotification(notification) {
    return firebase.database().ref('notifications').push(notification)
        .then(ref => ref.key);
}

/**
 * جلب جميع الإشعارات
 * @returns {Promise<Array>} - قائمة الإشعارات
 */
function getAllNotifications() {
    return firebase.database().ref('notifications').once('value')
        .then(snapshot => {
            const notifications = [];
            snapshot.forEach(child => {
                notifications.push({ id: child.key, ...child.val() });
            });
            return notifications.sort((a, b) => b.timestamp - a.timestamp);
        });
}

/**
 * حذف إشعار
 * @param {string} notificationId - معرف الإشعار
 * @returns {Promise}
 */
function deleteNotification(notificationId) {
    return firebase.database().ref('notifications/' + notificationId).remove();
}

/**
 * وضع علامة قراءة على إشعار
 * @param {string} notificationId - معرف الإشعار
 * @param {string} userId - معرف المستخدم
 * @returns {Promise}
 */
function markNotificationAsRead(notificationId, userId) {
    return firebase.database().ref('notifications/' + notificationId).once('value')
        .then(snapshot => {
            const notif = snapshot.val();
            const readBy = notif.readBy || [];
            
            if (!readBy.includes(String(userId))) {
                readBy.push(String(userId));
            }
            
            return firebase.database().ref('notifications/' + notificationId).update({ readBy });
        });
}
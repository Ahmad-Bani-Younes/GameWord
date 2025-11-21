// ========================================
// 🔔 Notifications System - نظام الإشعارات الشامل (FIXED)
// ========================================

console.log('🔔 Loading Notifications System...');

// ✅ التأكد من وجود jQuery
if (typeof $ === 'undefined') {
    console.error('❌ jQuery is not loaded!');
}

// ✅ التأكد من وجود Firebase
if (typeof firebase === 'undefined') {
    console.error('❌ Firebase is not loaded!');
}

/**
 * جلب جميع الإشعارات للمستخدم
 */
function getAllNotifications(userId) {
    return Promise.all([
        getFriendRequestsNotifications(userId),
        getRoomInvitationsNotifications(userId),
        getAdminNotifications(userId),
        getUnreadMessagesCount(userId)
    ]).then(([friendRequests, roomInvitations, adminNotifications, unreadMessages]) => {
        return {
            friendRequests: friendRequests || [],
            roomInvitations: roomInvitations || [],
            adminNotifications: adminNotifications || [],
            unreadMessages: unreadMessages || 0,
            total: (friendRequests?.length || 0) + (roomInvitations?.length || 0) + 
                   (adminNotifications?.length || 0) + (unreadMessages || 0)
        };
    });
}

/**
 * جلب طلبات الصداقة المعلقة
 */
function getFriendRequestsNotifications(userId) {
    return getUser(userId).then(user => {
        const pending = user.pending || [];
        
        if (pending.length === 0) return [];

        return getAllUsers().then(allUsers => {
            return pending.map(senderId => {
                const sender = allUsers.find(u => String(u.id) === senderId);
                return sender ? {
                    type: 'friend_request',
                    from: sender,
                    timestamp: Date.now()
                } : null;
            }).filter(n => n);
        });
    }).catch(err => {
        console.error('خطأ في جلب طلبات الصداقة:', err);
        return [];
    });
}

/**
 * جلب دعوات الغرف
 */
function getRoomInvitationsNotifications(userId) {
    return getAllRooms().then(rooms => {
        const invitations = rooms.filter(room => 
            room.isPrivate && 
            room.invitedPlayers && 
            room.invitedPlayers.includes(String(userId)) &&
            !room.players.some(p => p.id === String(userId)) &&
            room.status === 'waiting'
        );

        return invitations.map(room => ({
            type: 'room_invitation',
            room: room,
            timestamp: room.createdAt || Date.now()
        }));
    }).catch(err => {
        console.error('خطأ في جلب دعوات الغرف:', err);
        return [];
    });
}

/**
 * جلب إشعارات الأدمن
 */
function getAdminNotifications(userId) {
    return firebase.database().ref('notifications').once('value')
        .then(snapshot => {
            const notifications = [];
            snapshot.forEach(child => {
                const notif = child.val();
                
                if (notif.targetType === 'all' || 
                    (notif.targetType === 'specific' && notif.targetUsers && notif.targetUsers.includes(String(userId)))) {
                    
                    if (!notif.readBy || !notif.readBy.includes(String(userId))) {
                        notifications.push({
                            id: child.key,
                            type: 'admin_notification',
                            ...notif
                        });
                    }
                }
            });
            return notifications.sort((a, b) => b.timestamp - a.timestamp);
        })
        .catch(err => {
            console.error('خطأ في جلب إشعارات الأدمن:', err);
            return [];
        });
}

/**
 * جلب عدد الرسائل غير المقروءة
 */
function getUnreadMessagesCount(userId) {
    return getUser(userId).then(user => {
        if (!user || !user.messages) return 0;
        
        return user.messages.filter(m =>
            String(m.to) === String(userId) &&
            m.seen !== true
        ).length;
    }).catch(err => {
        console.error('خطأ في جلب الرسائل:', err);
        return 0;
    });
}

/**
 * عرض شارة الإشعارات في الصفحة الرئيسية
 */
function updateMainNotificationBadge() {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) return;

    getAllNotifications(currentUser.id).then(notifications => {
        showNotificationBadge(notifications.total);
    }).catch(err => {
        console.error('خطأ في تحديث الإشعارات:', err);
    });
}

/**
 * عرض شارة الإشعارات
 */
function showNotificationBadge(count) {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

/**
 * فتح مركز الإشعارات - عرض جميع الإشعارات
 */
function openNotificationsCenter() {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) return;

    getAllNotifications(currentUser.id).then(notifications => {
        if (notifications.total === 0) {
            alert('📭 لا توجد إشعارات جديدة!');
            return;
        }

        let notificationsHTML = '';

        // ✅ طلبات الصداقة
        if (notifications.friendRequests.length > 0) {
            notificationsHTML += `<div style="margin-bottom: 20px;">
                <h3 style="color: #667eea; margin-bottom: 15px; font-size: 18px;">
                    <i class="fas fa-user-plus"></i> طلبات الصداقة (${notifications.friendRequests.length})
                </h3>`;
            
            notifications.friendRequests.forEach(notif => {
                notificationsHTML += `
                    <div class="notification-item" style="padding: 15px; margin-bottom: 10px; background: #f8f9fa; border-radius: 10px; border-right: 5px solid #4cc9f0;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="flex: 1;">
                                <strong>${notif.from.username}</strong>
                                <p style="color: #666; margin: 5px 0;">يريد إضافتك كصديق</p>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button onclick="acceptFriendFromNotification('${notif.from.id}')" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                    ✅ قبول
                                </button>
                                <button onclick="rejectFriendFromNotification('${notif.from.id}')" style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                    ❌ رفض
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            notificationsHTML += `</div>`;
        }

        // ✅ دعوات الغرف
        if (notifications.roomInvitations.length > 0) {
            notificationsHTML += `<div style="margin-bottom: 20px;">
                <h3 style="color: #667eea; margin-bottom: 15px; font-size: 18px;">
                    <i class="fas fa-gamepad"></i> دعوات الغرف (${notifications.roomInvitations.length})
                </h3>`;
            
            notifications.roomInvitations.forEach(notif => {
                notificationsHTML += `
                    <div class="notification-item" style="padding: 15px; margin-bottom: 10px; background: #f8f9fa; border-radius: 10px; border-right: 5px solid #667eea;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <strong style="font-size: 16px;">${notif.room.name}</strong>
                            <span style="background: #667eea; color: white; padding: 5px 12px; border-radius: 15px; font-size: 12px;">
                                ${notif.room.gameType === 'math' ? '🎮 حساب' : '🎯 كلمات'}
                            </span>
                        </div>
                        <p style="color: #666; margin-bottom: 10px;">
                            <i class="fas fa-users"></i> ${notif.room.players.length} لاعبين • 
                            <i class="fas fa-gamepad"></i> ${notif.room.maxRounds} جولات
                        </p>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="acceptRoomInvitation('${notif.room.id}')" style="flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                ✅ قبول
                            </button>
                            <button onclick="rejectRoomInvitation('${notif.room.id}')" style="flex: 1; padding: 10px; background: #dc3545; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                ❌ رفض
                            </button>
                        </div>
                    </div>
                `;
            });
            notificationsHTML += `</div>`;
        }

        // ✅ إشعارات الأدمن
        if (notifications.adminNotifications.length > 0) {
            notificationsHTML += `<div style="margin-bottom: 20px;">
                <h3 style="color: #667eea; margin-bottom: 15px; font-size: 18px;">
                    <i class="fas fa-bell"></i> إشعارات الإدارة (${notifications.adminNotifications.length})
                </h3>`;
            
            notifications.adminNotifications.forEach(notif => {
                const time = new Date(notif.timestamp).toLocaleString('ar-SA');
                notificationsHTML += `
                    <div class="notification-item" style="padding: 15px; margin-bottom: 10px; background: #fff3cd; border-radius: 10px; border-right: 5px solid #f8961e;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                            <strong style="font-size: 16px; color: #856404;">${notif.title}</strong>
                            <button onclick="markAdminNotificationAsRead('${notif.id}')" style="padding: 5px 10px; background: #f8961e; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
                                ✓ تم القراءة
                            </button>
                        </div>
                        <p style="color: #856404; margin-bottom: 8px;">${notif.message}</p>
                        <small style="color: #999; font-size: 12px;">${time}</small>
                    </div>
                `;
            });
            notificationsHTML += `</div>`;
        }

        // ✅ إنشاء Modal
        const modalHTML = `
            <div id="notificationsModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; justify-content: center; align-items: center; padding: 20px;">
                <div style="background: white; border-radius: 15px; padding: 30px; max-width: 700px; width: 100%; max-height: 80vh; overflow-y: auto;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                        <h2 style="color: #667eea; margin: 0;">
                            <i class="fas fa-bell"></i> مركز الإشعارات
                        </h2>
                        <button onclick="closeNotificationsCenter()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">
                            ×
                        </button>
                    </div>
                    <div style="color: #666; margin-bottom: 20px; text-align: center;">
                        لديك ${notifications.total} إشعار جديد
                    </div>
                    <div>${notificationsHTML}</div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }).catch(err => {
        console.error('خطأ:', err);
        alert('حدث خطأ في جلب الإشعارات!');
    });
}

/**
 * قبول طلب صداقة من الإشعارات
 */
window.acceptFriendFromNotification = function(senderId) {
    if (typeof acceptFriend === 'function') {
        acceptFriend(senderId);
        setTimeout(() => {
            closeNotificationsCenter();
            if (typeof loadData === 'function') loadData();
        }, 100);
    } else {
        console.error('acceptFriend function not found');
    }
}

/**
 * رفض طلب صداقة من الإشعارات
 */
window.rejectFriendFromNotification = function(senderId) {
    if (typeof rejectFriend === 'function') {
        rejectFriend(senderId);
        setTimeout(() => {
            closeNotificationsCenter();
            if (typeof loadData === 'function') loadData();
        }, 100);
    } else {
        console.error('rejectFriend function not found');
    }
}

/**
 * قبول دعوة غرفة
 */
window.acceptRoomInvitation = function(roomId) {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    
    getRoom(roomId).then(room => {
        if (room.status !== 'waiting') {
            alert('⚠️ هذه الغرفة بدأت بالفعل!');
            return;
        }

        if (room.players.some(p => p.id === String(currentUser.id))) {
            alert('أنت بالفعل في هذه الغرفة!');
            return;
        }

        room.players.push({
            id: String(currentUser.id),
            username: currentUser.username,
            score: 0
        });

        return updateRoom(roomId, room);
    }).then(() => {
        alert('✅ تم قبول الدعوة! توجه إلى صفحة الغرف للعب.');
        closeNotificationsCenter();
        updateMainNotificationBadge();
        setTimeout(() => {
            window.location.href = 'rooms.html';
        }, 1000);
    }).catch(err => {
        console.error('خطأ:', err);
        alert('حدث خطأ في قبول الدعوة!');
    });
}

/**
 * رفض دعوة غرفة
 */
window.rejectRoomInvitation = function(roomId) {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    
    getRoom(roomId).then(room => {
        if (room.invitedPlayers) {
            const index = room.invitedPlayers.indexOf(String(currentUser.id));
            if (index > -1) {
                room.invitedPlayers.splice(index, 1);
            }
        }

        return updateRoom(roomId, room);
    }).then(() => {
        alert('❌ تم رفض الدعوة!');
        closeNotificationsCenter();
        updateMainNotificationBadge();
    }).catch(err => {
        console.error('خطأ:', err);
        alert('حدث خطأ في رفض الدعوة!');
    });
}

/**
 * تحديد إشعار أدمن كمقروء
 */
window.markAdminNotificationAsRead = function(notificationId) {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    
    firebase.database().ref('notifications/' + notificationId).once('value')
        .then(snapshot => {
            const notif = snapshot.val();
            const readBy = notif.readBy || [];
            
            if (!readBy.includes(String(currentUser.id))) {
                readBy.push(String(currentUser.id));
            }
            
            return firebase.database().ref('notifications/' + notificationId).update({ readBy });
        })
        .then(() => {
            closeNotificationsCenter();
            updateMainNotificationBadge();
            alert('✓ تم وضع علامة كمقروء');
        })
        .catch(err => {
            console.error('خطأ:', err);
        });
}

/**
 * إغلاق مركز الإشعارات
 */
window.closeNotificationsCenter = function() {
    const modal = document.getElementById('notificationsModal');
    if (modal) {
        modal.remove();
    }
}

// ✅ تحديث تلقائي للإشعارات كل 10 ثواني
setInterval(updateMainNotificationBadge, 10000);

// ✅ تحديث عند تحميل الصفحة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateMainNotificationBadge);
} else {
    updateMainNotificationBadge();
}

console.log('🔔 Notifications System Loaded Successfully!');
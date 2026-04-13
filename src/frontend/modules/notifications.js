/**
 * ROOK - Notifications Module
 * Handles notification fetching, rendering, and interactions.
 */

import API from '../api.js';
import state from './state.js';

export async function fetchNotifications() {
    try {
        const { notifications } = await API.getNotifications();
        state.notifications = Array.isArray(notifications) ? notifications : [];
        updateNotificationIcon();
    } catch (error) {
        console.error('Failed to fetch notifications:', error);
    }
}

export function updateNotificationIcon() {
    const badge = document.getElementById('notification-unread-count');
    if (!badge) return;

    const unreadCount = state.notifications.filter(n => !n.is_read).length;

    if (unreadCount > 0) {
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

export function renderNotifications() {
    const list = document.getElementById('notifications-list');
    if (!list) return;

    if (state.notifications.length === 0) {
        list.innerHTML = '<p class="notification-empty">No notifications yet</p>';
        return;
    }

    list.innerHTML = state.notifications.map(n => `
        <div class="notification-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
            <div class="notification-icon type-${n.type || 'info'}">
                <i class="fas ${getIconForType(n.type)}"></i>
            </div>
            <div class="notification-content">
                <p class="notification-message">${n.message}</p>
                <p class="notification-time">${formatTime(n.created_at)}</p>
            </div>
        </div>
    `).join('');

    // Add click listeners
    list.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', async () => {
            const id = item.dataset.id;
            const notification = state.notifications.find(n => n.id == id);
            if (notification) {
                if (!notification.is_read) {
                    try {
                        await API.markNotificationAsRead(id);
                        notification.is_read = true;
                        updateNotificationIcon();
                        renderNotifications();
                    } catch (error) {
                        console.error('Failed to mark notification as read:', error);
                    }
                }

                // Navigate if applicable
                if (state.user && state.user.role === 'admin' && notification.message.includes('New booking request')) {
                    const { switchView } = await import('./navigation.js');
                    switchView('admin');
                }
            }
        });
    });
}

function getIconForType(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-times-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return date.toLocaleDateString();
}

export function initNotifications() {
    const btn = document.getElementById('btn-notifications');
    const dropdown = document.getElementById('notifications-dropdown');
    const markAllReadBtn = document.getElementById('btn-mark-all-read');

    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
            renderNotifications();
        }
    });

    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await API.markAllNotificationsAsRead();
                state.notifications.forEach(n => n.is_read = true);
                updateNotificationIcon();
                renderNotifications();
            } catch (error) {
                console.error('Failed to mark all notifications as read:', error);
            }
        });
    }

    // Initial fetch
    fetchNotifications();

    // Poll for new notifications every minute
    setInterval(fetchNotifications, 60000);
}

/**
 * ROOK - Room Booking Platform Frontend Core
 * Entry point: initializes all modules and orchestrates data refresh.
 */

import API from './api.js';
import state from './modules/state.js';
import { renderActivity, updateStats, initCharts } from './modules/dashboard.js';
import { renderBookingsList, initBookingStatusTabs, initBookingListeners } from './modules/bookings.js';
import { renderRooms, renderRoomsForBooking, initFilterListeners } from './modules/rooms.js';
import { refreshAdminData, initAdminForm } from './modules/admin.js';
import { initAuth } from './modules/auth.js';
import { initNavigation } from './modules/navigation.js';
import { initStarRating, initFeedbackForm } from './modules/feedback.js';
import { initNotifications, fetchNotifications } from './modules/notifications.js';
import { initSearchRooms } from './modules/search-rooms.js';

// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
    initAuth();
    initNavigation();
    initAdminForm();
    initBookingListeners();
    initFilterListeners();
    initBookingStatusTabs();
    initStarRating();
    initFeedbackForm();
    initNotifications();
    initSearchRooms();
});

// --- App-level Data Refresh ---
// Exported so sub-modules can trigger a full refresh (e.g. after booking/cancel/approve)

export async function refreshAppData() {
    try {
        const { rooms } = await API.getRooms();
        state.rooms = Array.isArray(rooms) ? rooms : [];

        const { bookings } = await API.getUserBookings();
        state.bookings = Array.isArray(bookings) ? bookings : [];

        renderRooms();
        renderActivity();
        renderBookingsList();
        updateStats();
        fetchNotifications();

        if (state.user && state.user.role === 'admin') {
            refreshAdminData();
        }
    } catch (e) {
        console.error("Data refresh failed", e);
    }
}

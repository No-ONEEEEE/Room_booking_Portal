/**
 * ROOK - Navigation Module
 * Handles view switching and sidebar navigation.
 */

import state from './state.js';
import { refreshAdminData } from './admin.js';
import { refreshSearchRooms } from './search-rooms.js';
import { refreshAppData } from '../app.js';

export function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-view]');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = item.getAttribute('data-view');
            switchView(targetView);

            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

export function switchView(viewId) {
    document.querySelectorAll('.page-view').forEach(view => view.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    state.currentView = viewId;

    if (viewId === 'my-bookings') {
        refreshAppData().then(() => {
            // Refresh calendar if it's visible
            const calView = document.getElementById('schedule-calendar-view');
            if (calView && !calView.classList.contains('hidden') && state.calendar) {
                state.calendar.updateSize();
                state.calendar.render();
            }
        });
    }

    if (viewId === 'admin') {
        refreshAdminData();
    }

    if (viewId === 'dashboard') {
        refreshAppData();
    }

    if (viewId === 'search-rooms') {
        refreshSearchRooms();
    }
}

window.switchScheduleView = (view) => {
    const listView = document.getElementById('schedule-list-view');
    const calView = document.getElementById('schedule-calendar-view');
    const btnList = document.getElementById('btn-view-list');
    const btnCal = document.getElementById('btn-view-calendar');

    if (view === 'list') {
        listView.classList.remove('hidden');
        calView.classList.add('hidden');
        btnList.classList.add('active');
        btnCal.classList.remove('active');
    } else {
        listView.classList.add('hidden');
        calView.classList.remove('hidden');
        btnList.classList.remove('active');
        btnCal.classList.add('active');
        // Re-render calendar when switching to it
        if (state.calendar) {
            state.calendar.updateSize();
            state.calendar.render();
        }
    }
};

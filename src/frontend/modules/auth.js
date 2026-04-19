/**
 * ROOK - Auth Module
 * Handles login, session check, and logout.
 */

import API from '../api.js';
import state from './state.js';
import { refreshAppData } from '../app.js';
import { initCharts, startStatsAutoRefresh } from './dashboard.js';
import { initCalendar } from './calendar.js';
import { initBookRoomForm } from './rooms.js';

export async function initAuth() {
    const loginView = document.getElementById('view-login');

    // Check if user is already logged in (session check) - use silent mode
    try {
        const { user } = await API.me({ silent: true });
        if (user && user.id) {
            handleLoginSuccess(user);
        } else {
            loginView.classList.remove('hidden');
        }
    } catch (e) {
        console.warn("User not logged in:", e.message);
        loginView.classList.remove('hidden');
    }
}

export async function handleLoginSuccess(user) {
    state.user = user;
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    // Update User Info in Sidebar
    document.getElementById('user-display-name').textContent = user.name || 'User';
    document.getElementById('user-display-role').textContent = user.role;

    // Update Dashboard Header based on role
    const dTitle = document.getElementById('dashboard-title');
    const dDesc = document.getElementById('dashboard-desc');
    if (user.role === 'admin') {
        dTitle.textContent = "Statistics";
        dDesc.textContent = "";
        dDesc.style.display = 'none';
    } else {
        const firstName = user.name ? user.name.split(' ')[0] : 'User';
        dTitle.textContent = `Welcome, ${firstName}!`;
        dDesc.textContent = "Review your upcoming schedules and reserve new high-tech spaces.";
        dDesc.style.display = '';
    }

    // Admin features visibility
    if (user.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    }

    // Initialize Book Room Form
    document.getElementById('book-name').value = user.name || 'User';
    initBookRoomForm();

    // Initialize data and UI
    await refreshAppData();
    initCharts();
    initCalendar();
    startStatsAutoRefresh();
    initLogout();
}

export function initLogout() {
    const btn = document.getElementById('btn-logout');
    if (!btn) return;

    btn.onclick = async (e) => {
        e.preventDefault();
        try {
            await API.logout();
            location.reload(); // Hard refresh to reset state
        } catch (e) { }
    };
}
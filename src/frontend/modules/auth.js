/**
 * ROOK - Auth Module
 * Handles login, session check, and logout.
 */

import API from '../api.js';
import state from './state.js';
import { refreshAppData } from '../app.js';
import { initCharts } from './dashboard.js';
import { initCalendar } from './calendar.js';
import { initBookRoomForm } from './rooms.js';

export async function initAuth() {
    const loginForm = document.getElementById('login-form');
    const loginView = document.getElementById('view-login');

    // Check if user is already logged in
    try {
        const { user } = await API.me();
        if (user && user.id) { // Check for user.id to verify it's a valid user object
            handleLoginSuccess(user);
        }
    } catch (e) {
        console.warn("User not logged in:", e.message);
        loginView.classList.remove('hidden');
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;

        try {
            const { user } = await API.login(email);
            if (user && user.id) {
                handleLoginSuccess(user);
            }
        } catch (error) {
            console.error("Login failed:", error);
            // Error toast handled by API
        }
    });
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
        dTitle.textContent = "Command Center";
        dDesc.textContent = "Overview of system status and room utilization.";
    } else {
        const firstName = user.name ? user.name.split(' ')[0] : 'User';
        dTitle.textContent = `Welcome, ${firstName}`;
        dDesc.textContent = "Review your upcoming schedules and reserve new high-tech spaces.";
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

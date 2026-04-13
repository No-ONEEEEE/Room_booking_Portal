/**
 * ROOK - Dashboard Module
 * Handles activity feed, stats, and chart rendering.
 */

import state from './state.js';

export function renderActivity() {
    const container = document.getElementById('activity-feed');
    if (!container) return;

    const recent = state.bookings.slice(-5).reverse();
    container.innerHTML = recent.length ? recent.map(b => `
        <div class="request-item">
            <div>
                <p style="font-weight: 500;">${b.purpose || 'Room Reservation'}</p>
                <p style="color: var(--text-dim); font-size: 0.75rem;">${new Date(b.start_time).toLocaleDateString()} - Room #${b.room_name || b.roomId}</p>
            </div>
            <span class="status-badge status-${b.status}">${b.status}</span>
        </div>
    `).join('') : '<p class="text-dim" style="text-align: center; padding: 1rem;">No recent bookings</p>';
}

export function updateStats() {
    const totalRooms = document.getElementById('stat-total-rooms');
    const activeBookings = document.getElementById('stat-active-bookings');
    const pendingRequests = document.getElementById('stat-pending-requests');

    if (totalRooms) totalRooms.textContent = state.rooms.length;
    if (activeBookings) activeBookings.textContent = state.bookings.filter(b => b.status === 'approved').length;
    if (pendingRequests) pendingRequests.textContent = state.bookings.filter(b => b.status === 'pending').length;
}

export function initCharts() {
    const canvas = document.getElementById('usageChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (state.charts.usage) state.charts.usage.destroy();

    state.charts.usage = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Room Usage (%)',
                data: [65, 78, 92, 85, 95, 40, 30],
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

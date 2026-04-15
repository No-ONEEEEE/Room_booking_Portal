/**
 * ROOK - Dashboard Module
 * Handles activity feed, stats, and chart rendering.
 */

import state from './state.js';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

let statsFiltersInitialized = false;
let statsRefreshIntervalId = null;

function parseBookingDate(value) {
    const parsed = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function ensureStatsFilters() {
    if (statsFiltersInitialized) return;

    const monthSelect = document.getElementById('stat-month-select');
    const yearSelect = document.getElementById('stat-year-select');
    const roomSelect = document.getElementById('stat-room-select');

    if (!monthSelect || !yearSelect || !roomSelect) return;

    if (!monthSelect.options.length) {
        const allMonthsOption = document.createElement('option');
        allMonthsOption.value = '';
        allMonthsOption.textContent = 'All Months';
        monthSelect.appendChild(allMonthsOption);

        MONTH_NAMES.forEach((month, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = month;
            monthSelect.appendChild(option);
        });
    }

    if (!yearSelect.options.length) {
        const currentYear = new Date().getFullYear();
        for (let year = currentYear; year >= 2020; year--) {
            const option = document.createElement('option');
            option.value = String(year);
            option.textContent = String(year);
            yearSelect.appendChild(option);
        }
    }

    syncRoomFilterOptions();

    const now = new Date();
    monthSelect.value = '';
    yearSelect.value = String(now.getFullYear());

    monthSelect.addEventListener('change', updateStats);
    yearSelect.addEventListener('change', updateStats);
    roomSelect.addEventListener('change', updateStats);

    statsFiltersInitialized = true;
}

function syncRoomFilterOptions() {
    const roomSelect = document.getElementById('stat-room-select');
    if (!roomSelect) return;

    const previousValue = roomSelect.value;

    roomSelect.innerHTML = '';

    const allRoomsOption = document.createElement('option');
    allRoomsOption.value = '';
    allRoomsOption.textContent = 'All Rooms';
    roomSelect.appendChild(allRoomsOption);

    [...state.rooms]
        .sort((a, b) => String(a.room_name || '').localeCompare(String(b.room_name || '')))
        .forEach(room => {
            const option = document.createElement('option');
            option.value = String(room.id);
            option.textContent = room.room_name || `Room ${room.id}`;
            roomSelect.appendChild(option);
        });

    if (previousValue && [...roomSelect.options].some(o => o.value === previousValue)) {
        roomSelect.value = previousValue;
    } else {
        roomSelect.value = '';
    }
}

function getSelectedRoomId() {
    const roomSelect = document.getElementById('stat-room-select');
    if (!roomSelect || roomSelect.value === '') return null;

    const parsed = parseInt(roomSelect.value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function getSelectedDateRange() {
    const now = new Date();
    const monthSelect = document.getElementById('stat-month-select');
    const yearSelect = document.getElementById('stat-year-select');

    const selectedYear = yearSelect ? parseInt(yearSelect.value, 10) : now.getFullYear();

    if (!monthSelect || monthSelect.value === '') {
        const start = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
        const end = new Date(selectedYear + 1, 0, 1, 0, 0, 0, 0);
        return { start, end };
    }

    const selectedMonth = parseInt(monthSelect.value, 10);

    const start = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
    const end = new Date(selectedYear, selectedMonth + 1, 1, 0, 0, 0, 0);

    return { start, end };
}

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
    ensureStatsFilters();
    syncRoomFilterOptions();

    const totalRequests = document.getElementById('stat-total-requests');
    const totalAccepted = document.getElementById('stat-total-accepted');
    const activeBookings = document.getElementById('stat-active-bookings');
    const availableRooms = document.getElementById('stat-available-rooms');
    const occupiedRooms = document.getElementById('stat-occupied-rooms');

    const { start, end } = getSelectedDateRange();
    const selectedRoomId = getSelectedRoomId();

    const bookingsInRange = state.bookings.filter(b => {
        const bookingStart = parseBookingDate(b.start_time);
        const bookingEnd = parseBookingDate(b.end_time);

        if (!bookingStart || !bookingEnd) return false;

        if (selectedRoomId !== null && b.room_id !== selectedRoomId) return false;

        return bookingStart < end && bookingEnd >= start;
    });

    const acceptedBookingsInRange = bookingsInRange.filter(
        b => b.status === 'approved' || b.status === 'completed'
    );

    const allActiveBookingsCount = state.bookings.filter(b => b.status === 'approved').length;

    const now = new Date();
    const currentlyOccupiedRoomIds = new Set(
        state.bookings
            .filter(b => {
                if (b.status !== 'approved') return false;

                const bookingStart = parseBookingDate(b.start_time);
                const bookingEnd = parseBookingDate(b.end_time);

                if (!bookingStart || !bookingEnd) return false;

                return bookingStart <= now && bookingEnd >= now;
            })
            .map(b => b.room_id)
    );

    const occupiedCount = currentlyOccupiedRoomIds.size;
    const availableCount = Math.max(state.rooms.length - occupiedCount, 0);

    if (totalRequests) totalRequests.textContent = bookingsInRange.length;
    if (totalAccepted) totalAccepted.textContent = acceptedBookingsInRange.length;
    if (activeBookings) activeBookings.textContent = allActiveBookingsCount;
    if (availableRooms) availableRooms.textContent = availableCount;
    if (occupiedRooms) occupiedRooms.textContent = occupiedCount;
}

export function startStatsAutoRefresh() {
    if (statsRefreshIntervalId !== null) return;

    statsRefreshIntervalId = setInterval(() => {
        updateStats();
    }, 60000);
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

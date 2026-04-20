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
let activityClickBound = false;

const STATUS_LABELS = ['pending', 'approved', 'completed', 'declined', 'cancelled'];
const STATUS_COLORS = {
    pending: '#f59e0b',
    approved: '#22c55e',
    completed: '#38bdf8',
    declined: '#ef4444',
    cancelled: '#6b7280'
};

function parseBookingDate(value) {
    const parsed = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function ensureStatsFilters() {
    if (statsFiltersInitialized) return;

    const monthSelect = document.getElementById('stat-month-select');
    const yearSelect = document.getElementById('stat-year-select');
    const roomTypeSelect = document.getElementById('stat-room-type-select');
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
    if (roomTypeSelect) roomTypeSelect.value = '';

    monthSelect.addEventListener('change', updateStats);
    yearSelect.addEventListener('change', updateStats);
    if (roomTypeSelect) {
        roomTypeSelect.addEventListener('change', () => {
            syncRoomFilterOptions();
            updateStats();
        });
    }
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

    const roomTypeSelect = document.getElementById('stat-room-type-select');
    const selectedType = roomTypeSelect ? roomTypeSelect.value : '';

    [...state.rooms]
        .filter(room => selectedType === '' || room.type === selectedType)
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

function getBookingsBySelectedFilters() {
    const { start, end } = getSelectedDateRange();
    const selectedRoomId = getSelectedRoomId();
    const roomTypeSelect = document.getElementById('stat-room-type-select');
    const selectedType = roomTypeSelect ? roomTypeSelect.value : '';

    return state.bookings.filter(b => {
        const bookingStart = parseBookingDate(b.start_time);
        const bookingEnd = parseBookingDate(b.end_time);

        if (!bookingStart || !bookingEnd) return false;

        if (selectedRoomId !== null && b.room_id !== selectedRoomId) return false;
        if (selectedType !== '') {
            const room = state.rooms.find(r => r.id === b.room_id);
            if (!room || room.type !== selectedType) return false;
        }

        return bookingStart < end && bookingEnd >= start;
    });
}

function parseRefreshmentDetails(details) {
    if (!details) return null;
    if (typeof details === 'object') return details;

    try {
        return JSON.parse(details);
    } catch (_) {
        return null;
    }
}

function bindActivityClickHandler() {
    if (activityClickBound) return;

    const container = document.getElementById('activity-feed');
    if (!container) return;

    container.addEventListener('click', (event) => {
        const row = event.target.closest('[data-activity-booking-id]');
        if (!row) return;

        const bookingId = Number(row.getAttribute('data-activity-booking-id'));
        if (Number.isNaN(bookingId)) return;

        openActivityDetailsModal(bookingId);
    });

    activityClickBound = true;
}

function openActivityDetailsModal(bookingId) {
    const modal = document.getElementById('activity-details-modal');
    const booking = state.bookings.find(b => Number(b.id) === bookingId);

    if (!modal || !booking) return;

    const statusEl = document.getElementById('activity-detail-status');
    const purposeEl = document.getElementById('activity-detail-purpose');
    const userEl = document.getElementById('activity-detail-user');
    const roomEl = document.getElementById('activity-detail-room');
    const slotEl = document.getElementById('activity-detail-slot');
    const attendeesEl = document.getElementById('activity-detail-attendees');
    const refreshmentsEl = document.getElementById('activity-detail-refreshments');

    const bookingStart = parseBookingDate(booking.start_time);
    const bookingEnd = parseBookingDate(booking.end_time);
    const refreshmentDetails = parseRefreshmentDetails(booking.refreshment_details);

    if (statusEl) {
        statusEl.className = `status-badge status-${booking.status}`;
        statusEl.textContent = booking.status || '-';
    }

    if (purposeEl) purposeEl.textContent = booking.purpose || '-';
    if (userEl) userEl.textContent = booking.user_name || (state.user?.name || '-');
    if (roomEl) roomEl.textContent = booking.room_name || '-';

    if (slotEl) {
        const startText = bookingStart ? bookingStart.toLocaleString() : (booking.start_time || '-');
        const endText = bookingEnd ? bookingEnd.toLocaleString() : (booking.end_time || '-');
        slotEl.textContent = `${startText} to ${endText}`;
    }

    if (attendeesEl) attendeesEl.textContent = booking.expected_people || '-';

    if (refreshmentsEl) {
        if (!booking.snacks_requested) {
            refreshmentsEl.textContent = 'Not requested';
        } else if (refreshmentDetails?.time) {
            refreshmentsEl.textContent = `Requested at ${refreshmentDetails.time}`;
        } else {
            refreshmentsEl.textContent = 'Requested';
        }
    }

    modal.classList.remove('hidden');
}

window.closeActivityDetailsModal = () => {
    const modal = document.getElementById('activity-details-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

function ensureActivityModalCloseBinding() {
    const modal = document.getElementById('activity-details-modal');
    if (!modal || modal.dataset.bound === 'true') return;

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            window.closeActivityDetailsModal();
        }
    });

    modal.dataset.bound = 'true';
}

export function renderActivity() {
    const container = document.getElementById('activity-feed');
    if (!container) return;

    bindActivityClickHandler();
    ensureActivityModalCloseBinding();

    const recent = state.bookings.slice(-5).reverse();
    container.innerHTML = recent.length ? recent.map(b => `
        <div class="request-item activity-clickable" data-activity-booking-id="${b.id}" title="Click to view details">
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

    const bookingsInRange = getBookingsBySelectedFilters();

    const acceptedBookingsInRange = bookingsInRange.filter(
        b => b.status === 'approved' || b.status === 'completed'
    );

    const now = new Date();
    const allActiveBookingsCount = state.bookings.filter(b => {
        if (b.status !== 'approved') return false;

        const bookingStart = parseBookingDate(b.start_time);
        const bookingEnd = parseBookingDate(b.end_time);

        if (!bookingStart || !bookingEnd) return false;
        return bookingStart <= now && bookingEnd >= now;
    }).length;

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

    const roomTypeSelect = document.getElementById('stat-room-type-select');
    const selectedType = roomTypeSelect ? roomTypeSelect.value : '';

    let totalAvailableRooms = state.rooms.length;
    if (selectedType !== '') {
        totalAvailableRooms = state.rooms.filter(r => r.type === selectedType).length;
    }

    const occupiedCount = currentlyOccupiedRoomIds.size;
    let availableCount = Math.max(totalAvailableRooms - occupiedCount, 0);

    if (selectedType !== '') {
        let occupiedOfType = 0;
        currentlyOccupiedRoomIds.forEach(roomId => {
            const r = state.rooms.find(room => room.id === roomId);
            if (r && r.type === selectedType) {
                occupiedOfType++;
            }
        });
        availableCount = Math.max(totalAvailableRooms - occupiedOfType, 0);
        if (occupiedRooms) occupiedRooms.textContent = occupiedOfType;
    } else {
        if (occupiedRooms) occupiedRooms.textContent = occupiedCount;
    }

    let filteredActiveBookingsCount = allActiveBookingsCount;
    if (selectedType !== '') {
         filteredActiveBookingsCount = state.bookings.filter(b => {
            if (b.status !== 'approved') return false;
            const r = state.rooms.find(room => room.id === b.room_id);
            if (!r || r.type !== selectedType) return false;

            const bookingStart = parseBookingDate(b.start_time);
            const bookingEnd = parseBookingDate(b.end_time);

            if (!bookingStart || !bookingEnd) return false;
            return bookingStart <= now && bookingEnd >= now;
        }).length;
    }

    if (totalRequests) totalRequests.textContent = bookingsInRange.length;
    if (totalAccepted) totalAccepted.textContent = acceptedBookingsInRange.length;
    if (activeBookings) activeBookings.textContent = filteredActiveBookingsCount;
    if (availableRooms) availableRooms.textContent = availableCount;

    updateBookingAnalytics(bookingsInRange);
}

export function startStatsAutoRefresh() {
    if (statsRefreshIntervalId !== null) return;

    statsRefreshIntervalId = setInterval(() => {
        updateStats();
    }, 60000);
}

export function initCharts() {
    updateBookingAnalytics(getBookingsBySelectedFilters());
}

function updateBookingAnalytics(filteredBookings) {
    const canvas = document.getElementById('usageChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (state.charts.usage) state.charts.usage.destroy();

    const statusCounts = STATUS_LABELS.reduce((acc, status) => {
        acc[status] = 0;
        return acc;
    }, {});

    filteredBookings.forEach(booking => {
        if (Object.hasOwn(statusCounts, booking.status)) {
            statusCounts[booking.status] += 1;
        }
    });

    const values = STATUS_LABELS.map(status => statusCounts[status]);
    const labels = STATUS_LABELS.map(
        status => `${status.charAt(0).toUpperCase()}${status.slice(1)}`
    );

    state.charts.usage = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Bookings by Status',
                data: values,
                backgroundColor: STATUS_LABELS.map(status => STATUS_COLORS[status]),
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    border: { display: false },
                    ticks: { color: '#94a3b8', precision: 0 }
                },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

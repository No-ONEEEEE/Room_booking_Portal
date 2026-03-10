/**
 * ROOK - Room Booking Platform Frontend Core
 * Logic handles view transitions, API integration, and chart rendering.
 */

import API from './api.js';

// --- State Management ---
let state = {
    currentView: 'dashboard',
    user: null,
    rooms: [],
    bookings: [],
    pendingBookings: [],
    bookingFilter: 'all',
    calendar: null,
    charts: {}
};

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
});

// --- Authentication Logic ---

async function initAuth() {
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

async function handleLoginSuccess(user) {
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

async function initBookRoomForm() {
    try {
        const { users } = await API.getUsers();
        const list = document.getElementById('book-participants-list');
        list.innerHTML = users.filter(u => u.id !== state.user.id).map(u => `
            <div style="display: flex; flex-direction: row; align-items: center; justify-content: flex-start; gap: 0.75rem; width: 100%; padding: 0.25rem 0;">
                <input type="checkbox" name="participants[]" value="${u.id}" id="user-${u.id}" style="width: auto; margin: 0;">
                <label for="user-${u.id}" style="margin: 0; cursor: pointer; text-align: left; flex: 1;">${u.name}</label>
            </div>
        `).join('');
    } catch (error) {
        console.error("Failed to fetch users", error);
    }
}

function initLogout() {
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

async function refreshAppData() {
    try {
        const { rooms } = await API.getRooms();
        state.rooms = Array.isArray(rooms) ? rooms : [];

        const { bookings } = await API.getUserBookings();
        state.bookings = Array.isArray(bookings) ? bookings : [];

        renderRooms();
        renderActivity();
        renderBookingsList();
        updateStats();

        if (state.user && state.user.role === 'admin') {
            refreshAdminData();
        }
    } catch (e) {
        console.error("Data refresh failed", e);
    }
}

// --- Admin Panel Logic ---

async function refreshAdminData() {
    try {
        const { bookings: pending } = await API.getPendingRequests();
        state.pendingBookings = Array.isArray(pending) ? pending : [];
        
        renderAdminPending();

        const pendingBadge = document.getElementById('admin-stat-pending');
        if (pendingBadge) pendingBadge.textContent = state.pendingBookings.length;

        // Also load feedback for admin
        refreshFeedbackData();
    } catch (e) {
        console.error("Admin data refresh failed", e);
    }
}

async function refreshFeedbackData() {
    const container = document.getElementById('admin-feedback-container');
    if (!container) return;

    try {
        const { feedbacks } = await API.getAllFeedback();
        const feedbackList = Array.isArray(feedbacks) ? feedbacks : [];

        if (!feedbackList.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <p>No feedback submitted yet.</p>
                </div>`;
            return;
        }

        container.innerHTML = feedbackList.map(f => {
            const stars = Array.from({length: 5}, (_, i) => 
                `<i class="fas fa-star ${i < f.rating ? '' : 'empty'}"></i>`
            ).join('');

            return `
                <div class="feedback-card">
                    <div class="feedback-header">
                        <div class="feedback-stars">${stars}</div>
                        <span class="feedback-meta">Booking #${f.booking_id} · Room #${f.room_id}</span>
                    </div>
                    ${f.comments ? `<p class="feedback-comment">"${f.comments}"</p>` : ''}
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = `<p class="text-dim" style="text-align: center; padding: 1rem;">Could not load feedback.</p>`;
    }
}

window.refreshFeedbackData = refreshFeedbackData;

function renderAdminPending() {
    const container = document.getElementById('admin-pending-table');
    if (!container) return;

    if (!state.pendingBookings.length) {
        container.innerHTML = '<tr><td colspan="5" class="text-center text-dim">No pending requests found.</td></tr>';
        return;
    }

    container.innerHTML = state.pendingBookings.map(b => `
        <tr>
            <td>
                <div style="font-weight: 500;">${b.user_name}</div>
            </td>
            <td>${b.room_name}</td>
            <td>
                <div>${new Date(b.start_time).toLocaleDateString()}</div>
                <div style="font-size: 0.75rem; color: var(--text-dim);">
                    ${new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                    ${new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </td>
            <td>${b.purpose}</td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary btn-small" onclick="approveBooking(${b.id})">Approve</button>
                    <button class="btn btn-small" style="background: rgba(239, 68, 68, 0.2); color: #ef4444;" onclick="openAdminActionModal(${b.id}, 'decline')">Decline</button>
                    <button class="btn btn-small" style="background: rgba(255, 255, 255, 0.05);" onclick="openAdminActionModal(${b.id}, 'details')">More Info</button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.approveBooking = async (id) => {
    if (!confirm("Are you sure you want to approve this booking?")) return;
    try {
        await API.approveBooking(id);
        refreshAppData();
    } catch (e) { }
};

window.openAdminActionModal = (bookingId, type) => {
    const modal = document.getElementById('admin-modal');
    const title = document.getElementById('admin-modal-title');
    const desc = document.getElementById('admin-modal-desc');
    const label = document.getElementById('admin-modal-label');
    const input = document.getElementById('admin-modal-input');

    document.getElementById('admin-modal-booking-id').value = bookingId;
    document.getElementById('admin-modal-action-type').value = type;

    if (type === 'decline') {
        title.textContent = "Decline Request";
        desc.textContent = "Please provide a reason for declining this room request.";
        label.textContent = "Decline Reason";
        input.placeholder = "e.g. Schedule conflict with priority maintenance.";
    } else {
        title.textContent = "Request More Details";
        desc.textContent = "Ask the user for further clarification regarding their purpose.";
        label.textContent = "Internal Notes / Question";
        input.placeholder = "e.g. Please specify the equipment needed for this session.";
    }

    modal.classList.remove('hidden');
};

window.closeAdminModal = () => {
    document.getElementById('admin-modal').classList.add('hidden');
    document.getElementById('admin-action-form').reset();
};

function initAdminForm() {
    const form = document.getElementById('admin-action-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const bookingId = document.getElementById('admin-modal-booking-id').value;
        const type = document.getElementById('admin-modal-action-type').value;
        const note = document.getElementById('admin-modal-input').value;

        try {
            if (type === 'decline') {
                await API.declineBooking(bookingId, note);
            } else {
                await API.requestMoreDetails(bookingId, note);
            }
            closeAdminModal();
            refreshAppData();
        } catch (e) { }
    });
}

// --- Navigation Logic ---

function initNavigation() {
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

function switchView(viewId) {
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
}

// --- Schedule View Toggle ---

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

// --- Room Rendering ---

function renderRooms() {
    // No longer directly rendering rooms on load to a generic container.
    // Dashboard can still use updateStats. We don't render to room-container immediately.
}

function getRoomIcon(type) {
    const icons = {
        'meeting': 'fa-microchip',
        'classroom': 'fa-network-wired',
        'conference': 'fa-atom',
        'lab': 'fa-terminal'
    };
    return icons[type] || 'fa-door-open';
}

function renderActivity() {
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

function updateStats() {
    const totalRooms = document.getElementById('stat-total-rooms');
    const activeBookings = document.getElementById('stat-active-bookings');
    const pendingRequests = document.getElementById('stat-pending-requests');

    if (totalRooms) totalRooms.textContent = state.rooms.length;
    if (activeBookings) activeBookings.textContent = state.bookings.filter(b => b.status === 'approved').length;
    if (pendingRequests) pendingRequests.textContent = state.bookings.filter(b => b.status === 'pending').length;
}

// --- Bookings List with Status Filter ---

function initBookingStatusTabs() {
    const tabs = document.querySelectorAll('.status-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.bookingFilter = tab.getAttribute('data-status');
            renderBookingsList();
        });
    });
}

function renderBookingsList() {
    const container = document.getElementById('bookings-list');
    if (!container) return;

    let filtered = state.bookings;
    if (state.bookingFilter !== 'all') {
        filtered = state.bookings.filter(b => b.status === state.bookingFilter);
    }

    if (!filtered.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <p>No ${state.bookingFilter === 'all' ? '' : state.bookingFilter + ' '}bookings found.</p>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(b => {
        const startDate = new Date(b.start_time);
        const endDate = new Date(b.end_time);
        const isPast = endDate <= new Date();
        
        // Build action buttons depending on status
        let actions = '';
        
        if (b.status === 'pending' || b.status === 'approved') {
            actions += `<button class="btn btn-small btn-cancel" onclick="cancelBooking(${b.id})">
                <i class="fas fa-times"></i> Cancel
            </button>`;
        }
        
        if (b.status === 'approved' && isPast) {
            actions += `<button class="btn btn-small btn-complete" onclick="markBookingCompleted(${b.id})">
                <i class="fas fa-check"></i> Mark Completed
            </button>`;
        }

        if (b.status === 'completed' && state.user && state.user.role !== 'admin') {
            actions += `<button class="btn btn-small btn-feedback" onclick="openFeedbackModal(${b.id})">
                <i class="fas fa-star"></i> Feedback
            </button>`;
        }

        return `
            <div class="booking-card fade-in">
                <div class="booking-card-info">
                    <h4>${b.purpose || 'Room Reservation'}</h4>
                    <div class="booking-card-meta">
                        <span><i class="fas fa-door-open"></i> ${b.room_name || 'Room #' + b.room_id}</span>
                        <span><i class="fas fa-calendar"></i> ${startDate.toLocaleDateString()}</span>
                        <span><i class="fas fa-clock"></i> ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
                <div class="booking-card-actions">
                    <span class="status-badge status-${b.status}">${b.status}</span>
                    ${actions}
                </div>
            </div>
        `;
    }).join('');
}

// --- Cancel & Complete Booking ---

window.cancelBooking = async (id) => {
    if (!confirm("Are you sure you want to cancel this booking? The room slot will be freed.")) return;
    try {
        await API.cancelBooking(id);
        showToast("Booking cancelled successfully.", "info");
        await refreshAppData();
    } catch (e) { }
};

window.markBookingCompleted = async (id) => {
    if (!confirm("Mark this booking as completed?")) return;
    try {
        await API.markCompleted(id);
        showToast("Booking marked as completed. You can now leave feedback!", "info");
        await refreshAppData();
    } catch (e) { }
};

// Import showToast from api.js scope — it's global already
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} fade-in`;
    toast.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// --- Feedback Modal ---

window.openFeedbackModal = async (bookingId) => {
    document.getElementById('feedback-booking-id').value = bookingId;
    document.getElementById('feedback-rating').value = '0';
    document.getElementById('feedback-comments').value = '';
    // Reset stars
    document.querySelectorAll('#star-rating .fa-star').forEach(s => s.classList.remove('active'));

    // Try to load existing feedback for rewriting
    try {
        const { feedback } = await API.getFeedback(bookingId);
        if (feedback) {
            document.getElementById('feedback-rating').value = feedback.rating;
            document.getElementById('feedback-comments').value = feedback.comments || '';
            document.querySelectorAll('#star-rating .fa-star').forEach(s => {
                s.classList.toggle('active', parseInt(s.getAttribute('data-value')) <= feedback.rating);
            });
        }
    } catch (e) {
        // No existing feedback — that's fine, leave blank
    }

    document.getElementById('feedback-modal').classList.remove('hidden');
};

window.closeFeedbackModal = () => {
    document.getElementById('feedback-modal').classList.add('hidden');
    document.getElementById('feedback-form').reset();
    document.querySelectorAll('#star-rating .fa-star').forEach(s => s.classList.remove('active'));
};

function initStarRating() {
    const stars = document.querySelectorAll('#star-rating .fa-star');
    const ratingInput = document.getElementById('feedback-rating');

    stars.forEach(star => {
        star.addEventListener('mouseenter', () => {
            const val = parseInt(star.getAttribute('data-value'));
            stars.forEach(s => {
                s.classList.toggle('hovered', parseInt(s.getAttribute('data-value')) <= val);
            });
        });

        star.addEventListener('mouseleave', () => {
            stars.forEach(s => s.classList.remove('hovered'));
        });

        star.addEventListener('click', () => {
            const val = star.getAttribute('data-value');
            ratingInput.value = val;
            stars.forEach(s => {
                s.classList.toggle('active', parseInt(s.getAttribute('data-value')) <= parseInt(val));
            });
        });
    });
}

function initFeedbackForm() {
    const form = document.getElementById('feedback-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const bookingId = document.getElementById('feedback-booking-id').value;
        const rating = parseInt(document.getElementById('feedback-rating').value);
        const comments = document.getElementById('feedback-comments').value;

        if (!rating || rating < 1) {
            showToast("Please select a rating.", "error");
            return;
        }

        try {
            await API.submitFeedback(parseInt(bookingId), rating, comments || null);
            showToast("Thank you for your feedback!", "info");
            closeFeedbackModal();
            await refreshAppData();
        } catch (e) { }
    });
}

// --- Integrations ---

function initCharts() {
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

function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    const getStatusStyle = (status) => {
        switch (status) {
            case 'approved': return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981' };
            case 'pending': return { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b' };
            case 'declined': return { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444' };
            case 'cancelled': return { bg: 'rgba(107, 114, 128, 0.15)', border: '#6b7280' };
            case 'completed': return { bg: 'rgba(56, 189, 248, 0.15)', border: '#38bdf8' };
            default: return { bg: 'rgba(56, 189, 248, 0.15)', border: '#38bdf8' };
        }
    };

    state.calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        themeSystem: 'standard',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        events: state.bookings.map(b => {
            const style = getStatusStyle(b.status);
            return {
                id: b.id,
                title: `${b.room_name}: ${b.purpose}`,
                start: b.start_time,
                end: b.end_time,
                backgroundColor: style.bg,
                borderColor: style.border,
                textColor: style.border, // Makes text same color as border for readability
                extendedProps: {
                    status: b.status,
                    roomId: b.room_id
                }
            };
        })
    });
    state.calendar.render();
}

// --- Global Modal Handlers ---

window.openBookingModal = (roomId, roomName) => {
    document.getElementById('modal-title').textContent = `Reserve: ${roomName}`;
    document.getElementById('modal-room-id').value = roomId;
    document.getElementById('booking-modal').classList.remove('hidden');
};

window.closeModal = () => {
    document.getElementById('booking-modal').classList.add('hidden');
    document.getElementById('booking-form').reset();
};

window.refreshAdminData = refreshAdminData;

// --- Book Room Flow ---

document.getElementById('book-room-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Set loading state
    const btn = document.getElementById('btn-check-availability');
    const originalText = btn.textContent;
    btn.textContent = "Checking...";
    btn.disabled = true;

    const type = document.getElementById('book-room-type').value;
    const capacity = document.getElementById('book-expected-number').value;
    const availStart = document.getElementById('book-start-time').value;
    const availEnd = document.getElementById('book-end-time').value;

    const filters = {};
    if (type) filters.type = type;
    if (capacity) filters.capacity = capacity;

    try {
        const result = await API.getAvailableRooms(availStart, availEnd, filters);
        let rooms = result.rooms;
        state.rooms = Array.isArray(rooms) ? rooms : [];
        renderRoomsForBooking();
    } catch (e) {
        console.error("Filtering failed", e);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

function renderRoomsForBooking() {
    const container = document.getElementById('room-container');
    const section = document.getElementById('available-rooms-section');
    section.classList.remove('hidden');

    if (!state.rooms.length) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i class="fas fa-search"></i>
                <p>No available rooms match your criteria.</p>
            </div>`;
        return;
    }

    container.innerHTML = state.rooms.map(room => `
        <div class="glass-card room-card fade-in">
            <div class="room-visual">
                <i class="fas ${getRoomIcon(room.type)}"></i>
            </div>
            <div class="room-info">
                <span class="room-badge">${room.type}</span>
                <h3>${room.room_name}</h3>
                <div class="room-meta">
                    <span><i class="fas fa-users"></i> Up to ${room.capacity}</span>
                    <span><i class="fas fa-check-circle"></i> Online</span>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-primary" style="flex: 1;" onclick="proceedWithBooking(${room.id})">
                    Select Room & Book
                </button>
                <button class="btn" style="background: rgba(255, 255, 255, 0.1); padding: 0.75rem;" onclick="openRoomFeedbackModal(${room.id}, '${room.room_name}')" title="View Feedback">
                    <i class="fas fa-comments"></i>
                </button>
            </div>
        </div>
    `).join('');
}

window.proceedWithBooking = async (roomId) => {
    const guests = Array.from(document.querySelectorAll('input[name="participants[]"]:checked')).map(cb => parseInt(cb.value));

    const bookingData = {
        roomId: roomId,
        purpose: document.getElementById('book-purpose').value,
        expectedPeople: parseInt(document.getElementById('book-expected-number').value),
        startTime: document.getElementById('book-start-time').value,
        endTime: document.getElementById('book-end-time').value,
        remarks: document.getElementById('book-remarks').value,
        guests: guests,
        snacksRequested: document.getElementById('book-snacks-requested').checked
    };

    try {
        await API.createBooking(bookingData);
        showToast("Booking created successfully!", "info");
        document.getElementById('book-room-form').reset();
        document.getElementById('available-rooms-section').classList.add('hidden');
        document.getElementById('book-name').value = state.user.name || 'User'; // Restore name
        switchView('my-bookings');
    } catch (error) { }
};

window.openRoomFeedbackModal = async (roomId, roomName) => {
    document.getElementById('room-feedback-title').textContent = `Feedback: ${roomName}`;
    const listContainer = document.getElementById('room-feedback-list');
    listContainer.innerHTML = `<p class="text-dim" style="text-align: center; padding: 1rem;">Loading feedback...</p>`;
    document.getElementById('view-room-feedback-modal').classList.remove('hidden');

    try {
        const { feedback } = await API.getRoomFeedback(roomId);
        const feedbackList = Array.isArray(feedback) ? feedback : [];

        if (!feedbackList.length) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comment-slash"></i>
                    <p>No feedback available for this room yet.</p>
                </div>`;
            return;
        }

        listContainer.innerHTML = feedbackList.map(f => {
            const stars = Array.from({length: 5}, (_, i) => 
                `<i class="fas fa-star ${i < f.rating ? '' : 'empty'}"></i>`
            ).join('');

            return `
                <div style="background: rgba(255, 255, 255, 0.05); border-radius: 0.5rem; padding: 1rem; margin-bottom: 0.75rem; border: 1px solid var(--border-glass);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                        <div style="color: var(--status-pending); font-size: 0.9rem;">
                            ${stars}
                        </div>
                        <span style="color: var(--text-dim); font-size: 0.8rem; font-weight: 500;">
                            ${f.user_name ? 'by ' + f.user_name : 'by User'}
                        </span>
                    </div>
                    ${f.comments ? `<p style="margin: 0; padding-top: 0.5rem; color: var(--text-secondary); font-size: 0.95rem; border-top: 1px solid rgba(255,255,255,0.05);">"${f.comments}"</p>` : `<p style="margin: 0; padding-top: 0.5rem; color: var(--text-dim); font-size: 0.85rem; font-style: italic;">No comments provided.</p>`}
                </div>
            `;
        }).join('');
    } catch (e) {
        listContainer.innerHTML = `<p class="text-dim" style="text-align: center; padding: 1rem;">Failed to load feedback.</p>`;
    }
};

window.closeRoomFeedbackModal = () => {
    document.getElementById('view-room-feedback-modal').classList.add('hidden');
};

function initFilterListeners() {} // stub
function initBookingListeners() {} // stub

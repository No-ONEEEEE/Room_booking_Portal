/**
 * ROOK - Bookings Module
 * Handles booking list rendering, status tabs, and booking actions.
 */

import API from '../api.js';
import state from './state.js';
import { showToast } from './utils.js';
import { refreshAppData } from '../app.js';

export function initBookingStatusTabs() {
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

export function renderBookingsList() {
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
                        ${b.snacks_requested ? `<span style="color: var(--accent-blue); display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; font-weight: 500; margin-top: 0.25rem;"><i class="fas fa-coffee"></i> Refreshments Requested</span>` : ''}
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

export function initBookingListeners() {} // stub

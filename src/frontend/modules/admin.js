/**
 * ROOK - Admin Module
 * Handles admin panel: pending requests, feedback, and approval actions.
 */

import API from '../api.js';
import state from './state.js';
import { refreshAppData } from '../app.js';

export async function refreshAdminData() {
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

export async function refreshFeedbackData() {
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

window.refreshAdminData = refreshAdminData;
window.refreshFeedbackData = refreshFeedbackData;

export function initAdminForm() {
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
            window.closeAdminModal();
            refreshAppData();
        } catch (e) { }
    });
}

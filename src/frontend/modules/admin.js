/**
 * ROOK - Admin Module
 * Handles admin panel: pending requests, feedback, and approval actions.
 */

import API from '../api.js';
import state from './state.js';
import { refreshAppData } from '../app.js';

function formatDateTimeForDisplay(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || '-';

    return date.toLocaleString([], {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showApproveConfirmationModal(booking) {
    const modal = document.getElementById('admin-approve-modal');
    const userName = document.getElementById('admin-approve-user');
    const roomName = document.getElementById('admin-approve-room');
    const slot = document.getElementById('admin-approve-slot');
    const purpose = document.getElementById('admin-approve-purpose');
    const cancelBtn = document.getElementById('admin-approve-cancel');
    const confirmBtn = document.getElementById('admin-approve-confirm');

    if (!modal || !cancelBtn || !confirmBtn) {
        return Promise.resolve(true);
    }

    if (userName) userName.textContent = booking?.user_name || '-';
    if (roomName) roomName.textContent = booking?.room_name || '-';
    if (purpose) purpose.textContent = booking?.purpose || '-';
    if (slot) {
        slot.textContent = `${formatDateTimeForDisplay(booking?.start_time)} to ${formatDateTimeForDisplay(booking?.end_time)}`;
    }

    modal.classList.remove('hidden');

    return new Promise(resolve => {
        const closeModal = (result) => {
            modal.classList.add('hidden');
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.removeEventListener('click', onConfirm);
            modal.removeEventListener('click', onBackdropClick);
            resolve(result);
        };

        const onCancel = () => closeModal(false);
        const onConfirm = () => closeModal(true);
        const onBackdropClick = (event) => {
            if (event.target === modal) {
                closeModal(false);
            }
        };

        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
        modal.addEventListener('click', onBackdropClick);
    });
}

function setRefreshButtonLoading(button, isLoading) {
    if (!button) return;

    button.classList.remove('refresh-pop');
    // Force reflow so repeated clicks replay the pop animation.
    void button.offsetWidth;
    button.classList.add('refresh-pop');

    if (isLoading) {
        button.disabled = true;
        button.classList.add('refresh-loading');
    } else {
        button.disabled = false;
        button.classList.remove('refresh-loading');
    }
}

function ensureFeedbackFilterBinding() {
    const roomFilter = document.getElementById('admin-feedback-room-filter');
    if (!roomFilter || roomFilter.dataset.bound === 'true') return;

    roomFilter.addEventListener('change', () => {
        refreshFeedbackData();
    });

    roomFilter.dataset.bound = 'true';
}

function updateFeedbackRoomFilterOptions(feedbackList) {
    const roomFilter = document.getElementById('admin-feedback-room-filter');
    if (!roomFilter) return;

    const previousValue = roomFilter.value || '';

    const roomMap = new Map();
    feedbackList.forEach(f => {
        if (f.room_id === undefined || f.room_id === null) return;
        const roomId = String(f.room_id);
        const roomName = f.room_name || `Room #${roomId}`;
        roomMap.set(roomId, roomName);
    });

    roomFilter.innerHTML = '<option value="">All Rooms</option>';

    [...roomMap.entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .forEach(([roomId, roomName]) => {
            const option = document.createElement('option');
            option.value = roomId;
            option.textContent = roomName;
            roomFilter.appendChild(option);
        });

    if (previousValue && roomMap.has(previousValue)) {
        roomFilter.value = previousValue;
    } else {
        roomFilter.value = '';
    }
}

function renderFeedbackList(container, feedbackList) {
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
                    <span class="feedback-meta">Booking #${f.booking_id} · ${f.room_name || `Room #${f.room_id}`}</span>
                </div>
                ${f.comments ? `<p class="feedback-comment">"${f.comments}"</p>` : ''}
            </div>
        `;
    }).join('');
}

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

    ensureFeedbackFilterBinding();

    try {
        const { feedbacks } = await API.getAllFeedback();
        const feedbackList = Array.isArray(feedbacks) ? feedbacks : [];

        updateFeedbackRoomFilterOptions(feedbackList);

        const roomFilter = document.getElementById('admin-feedback-room-filter');
        const selectedRoom = roomFilter ? roomFilter.value : '';

        const filteredFeedback = selectedRoom
            ? feedbackList.filter(f => String(f.room_id) === selectedRoom)
            : feedbackList;

        renderFeedbackList(container, filteredFeedback);
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
                ${b.snacks_requested ? `<div style="font-size: 0.7rem; color: var(--accent-blue); margin-top: 0.25rem;"><i class="fas fa-coffee"></i> Refreshments</div>` : ''}
            </td>
            <td>${b.room_name}</td>
            <td>
                <div>${new Date(b.start_time).toLocaleDateString()}</div>
                <div style="font-size: 0.75rem; color: var(--text-dim);">
                    ${new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                    ${new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </td>
            <td>${b.purpose}
                ${b.clarification_response ? `<div style="font-size: 0.75rem; color: var(--status-approved); margin-top: 0.5rem;"><i class="fas fa-reply"></i> Response: ${b.clarification_response}</div>` : ''}
            </td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary btn-small" onclick="approveBooking(${b.id})">Approve</button>
                    <button class="btn btn-small" style="background: rgba(239, 68, 68, 0.2); color: #ef4444;" onclick="openAdminActionModal(${b.id}, 'decline')">Decline</button>
                    <button class="btn btn-small more-info-btn" onclick="openAdminActionModal(${b.id}, 'details')">More Info</button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.approveBooking = async (id) => {
    const booking = state.pendingBookings.find(b => Number(b.id) === Number(id));
    const shouldProceed = await showApproveConfirmationModal(booking);
    if (!shouldProceed) return;

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

window.handleAdminRefresh = async (button) => {
    setRefreshButtonLoading(button, true);
    try {
        await refreshAdminData();
    } finally {
        setRefreshButtonLoading(button, false);
    }
};

window.handleFeedbackRefresh = async (button) => {
    setRefreshButtonLoading(button, true);
    try {
        await refreshFeedbackData();
    } finally {
        setRefreshButtonLoading(button, false);
    }
};

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

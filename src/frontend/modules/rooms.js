/**
 * ROOK - Rooms Module
 * Handles room rendering, booking flow, and room feedback modal.
 */

import API from '../api.js';
import state from './state.js';
import { showToast } from './utils.js';
import { switchView } from './navigation.js';

const AVAILABLE_ROOMS_PAGE_SIZE = 18;
let availableRoomsCurrentPage = 1;

export function renderRooms() {
    // No longer directly rendering rooms on load to a generic container.
    // Dashboard can still use updateStats. We don't render to room-container immediately.
}

export function getRoomIcon(type) {
    const icons = {
        'meeting': 'fa-microchip',
        'classroom': 'fa-network-wired',
        'conference': 'fa-atom',
        'lab': 'fa-terminal'
    };
    return icons[type] || 'fa-door-open';
}

function isPreferredTimeWithinBookingWindow(startDateTime, endDateTime, preferredTime) {
    if (!startDateTime || !endDateTime || !preferredTime) {
        return true;
    }

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return false;
    }

    const [hours, minutes] = preferredTime.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return false;
    }

    const preferred = new Date(start);
    preferred.setHours(hours, minutes, 0, 0);

    // If booking crosses midnight, allow preferred time on the next date too.
    if (end > start && end.getDate() !== start.getDate() && preferred < start) {
        preferred.setDate(preferred.getDate() + 1);
    }

    return preferred >= start && preferred <= end;
}

function buildBookingData(roomId) {
    const guests = Array.from(document.querySelectorAll('input[name="participants[]"]:checked')).map(cb => parseInt(cb.value));
    const snacksRequested = document.getElementById('book-snacks-requested').checked;

    return {
        roomId: roomId,
        purpose: document.getElementById('book-purpose').value,
        expectedPeople: parseInt(document.getElementById('book-expected-number').value),
        startTime: document.getElementById('book-start-time').value,
        endTime: document.getElementById('book-end-time').value,
        remarks: document.getElementById('book-remarks').value,
        guests: guests,
        snacksRequested,
        refreshmentDetails: snacksRequested ? {
            tea: document.getElementById('refresh-tea').checked,
            coffee: document.getElementById('refresh-coffee').checked,
            snacks: document.getElementById('refresh-snacks').checked,
            lunch: document.getElementById('refresh-lunch').checked,
            onTable: document.getElementById('refresh-ontable').checked,
            quantity: document.getElementById('refresh-quantity').value,
            time: document.getElementById('refresh-time').value,
            budget: document.getElementById('refresh-budget').value,
            remarks: document.getElementById('refresh-remarks').value
        } : null
    };
}

function formatDateTimeForDisplay(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString([], {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showBookingConfirmationModal(room, bookingData) {
    const modal = document.getElementById('booking-confirm-modal');
    const roomName = document.getElementById('confirm-room-name');
    const roomType = document.getElementById('confirm-room-type');
    const bookingSlot = document.getElementById('confirm-booking-slot');
    const purpose = document.getElementById('confirm-purpose');
    const attendees = document.getElementById('confirm-attendees');
    const refreshments = document.getElementById('confirm-refreshments');
    const remarks = document.getElementById('confirm-remarks');
    const cancelBtn = document.getElementById('confirm-booking-cancel');
    const proceedBtn = document.getElementById('confirm-booking-proceed');

    if (!modal || !cancelBtn || !proceedBtn) {
        return Promise.resolve(true);
    }

    roomName.textContent = room?.room_name || `Room #${bookingData.roomId}`;
    roomType.textContent = room?.type ? room.type.toUpperCase() : 'N/A';
    bookingSlot.textContent = `${formatDateTimeForDisplay(bookingData.startTime)} to ${formatDateTimeForDisplay(bookingData.endTime)}`;
    purpose.textContent = bookingData.purpose || '-';
    attendees.textContent = bookingData.expectedPeople || '-';
    remarks.textContent = bookingData.remarks || 'No additional remarks';

    if (bookingData.snacksRequested && bookingData.refreshmentDetails) {
        const refreshTime = bookingData.refreshmentDetails.time ? ` at ${bookingData.refreshmentDetails.time}` : '';
        refreshments.textContent = `Requested${refreshTime}`;
    } else {
        refreshments.textContent = 'Not requested';
    }

    modal.classList.remove('hidden');

    return new Promise(resolve => {
        const closeModal = (result) => {
            modal.classList.add('hidden');
            cancelBtn.removeEventListener('click', onCancel);
            proceedBtn.removeEventListener('click', onProceed);
            modal.removeEventListener('click', onBackdropClick);
            resolve(result);
        };

        const onCancel = () => closeModal(false);
        const onProceed = () => closeModal(true);
        const onBackdropClick = (event) => {
            if (event.target === modal) {
                closeModal(false);
            }
        };

        cancelBtn.addEventListener('click', onCancel);
        proceedBtn.addEventListener('click', onProceed);
        modal.addEventListener('click', onBackdropClick);
    });
}

export function renderRoomsForBooking() {
    const container = document.getElementById('room-container');
    const paginationEl = document.getElementById('available-rooms-pagination');
    const section = document.getElementById('available-rooms-section');
    section.classList.remove('hidden');

    if (!state.rooms.length) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i class="fas fa-search"></i>
                <p>No available rooms match your criteria.</p>
            </div>`;
        if (paginationEl) {
            paginationEl.classList.add('hidden');
            paginationEl.innerHTML = '';
        }
        return;
    }

    const totalPages = Math.max(Math.ceil(state.rooms.length / AVAILABLE_ROOMS_PAGE_SIZE), 1);
    if (availableRoomsCurrentPage > totalPages) {
        availableRoomsCurrentPage = totalPages;
    }

    const start = (availableRoomsCurrentPage - 1) * AVAILABLE_ROOMS_PAGE_SIZE;
    const pagedRooms = state.rooms.slice(start, start + AVAILABLE_ROOMS_PAGE_SIZE);

    container.innerHTML = pagedRooms.map(room => `
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

    if (!paginationEl) return;

    if (totalPages <= 1) {
        paginationEl.classList.add('hidden');
        paginationEl.innerHTML = '';
        return;
    }

    let startPage = Math.max(1, availableRoomsCurrentPage - 1);
    let endPage = Math.min(totalPages, startPage + 2);
    startPage = Math.max(1, endPage - 2);

    const pageButtons = [];
    for (let page = startPage; page <= endPage; page++) {
        pageButtons.push(`<button class="pagination-btn ${page === availableRoomsCurrentPage ? 'active' : ''}" data-page="${page}">${page}</button>`);
    }

    paginationEl.innerHTML = `
        <button class="pagination-btn" data-page="${Math.max(1, availableRoomsCurrentPage - 1)}" ${availableRoomsCurrentPage === 1 ? 'disabled' : ''}>Prev</button>
        ${pageButtons.join('')}
        <button class="pagination-btn" data-page="${Math.min(totalPages, availableRoomsCurrentPage + 1)}" ${availableRoomsCurrentPage === totalPages ? 'disabled' : ''}>Next</button>
    `;
    paginationEl.classList.remove('hidden');

    paginationEl.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedPage = Number(btn.getAttribute('data-page'));
            if (!Number.isNaN(selectedPage) && selectedPage !== availableRoomsCurrentPage) {
                availableRoomsCurrentPage = selectedPage;
                renderRoomsForBooking();
            }
        });
    });
}

export async function initBookRoomForm() {
    try {
        const { users } = await API.getUsers({ silent: true });
        const list = document.getElementById('book-participants-list');
        list.innerHTML = users.filter(u => u.id !== state.user.id).map(u => `
            <div style="display: flex; flex-direction: row; align-items: center; justify-content: flex-start; gap: 0.75rem; width: 100%; padding: 0.25rem 0;">
                <input type="checkbox" name="participants[]" value="${u.id}" id="user-${u.id}" style="width: auto; margin: 0;">
                <label for="user-${u.id}" style="margin: 0; cursor: pointer; text-align: left; flex: 1;">${u.name}</label>
            </div>
        `).join('');

        // Refreshment toggle logic
        const snacksCheckbox = document.getElementById('book-snacks-requested');
        const refreshmentDetails = document.getElementById('refreshment-details');
        if (snacksCheckbox && refreshmentDetails) {
            snacksCheckbox.addEventListener('change', () => {
                refreshmentDetails.classList.toggle('hidden', !snacksCheckbox.checked);
            });
        }

        // Set minimum date/time to current date/time to prevent selecting past dates
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const minDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

        const startTimeInput = document.getElementById('book-start-time');
        const endTimeInput = document.getElementById('book-end-time');
        if (startTimeInput) startTimeInput.min = minDateTime;
        if (endTimeInput) endTimeInput.min = minDateTime;
    } catch (error) {
        console.error("Failed to fetch users", error);
    }
}

window.proceedWithBooking = async (roomId) => {
    const bookingData = buildBookingData(roomId);

    if (bookingData.snacksRequested && bookingData.refreshmentDetails?.time) {
        const isWithinWindow = isPreferredTimeWithinBookingWindow(
            bookingData.startTime,
            bookingData.endTime,
            bookingData.refreshmentDetails.time
        );

        if (!isWithinWindow) {
            showToast("Preferred refreshment time must be between booking start and end time.", "error");
            return;
        }
    }

    const selectedRoom = state.rooms.find(r => r.id === roomId);
    const shouldProceed = await showBookingConfirmationModal(selectedRoom, bookingData);
    if (!shouldProceed) return;

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

window.openBookingModal = (roomId, roomName) => {
    document.getElementById('modal-title').textContent = `Reserve: ${roomName}`;
    document.getElementById('modal-room-id').value = roomId;
    document.getElementById('booking-modal').classList.remove('hidden');
};

window.closeModal = () => {
    document.getElementById('booking-modal').classList.add('hidden');
    document.getElementById('booking-form').reset();
};

export function initFilterListeners() {} // stub

// --- Book Room Form Submit ---
document.getElementById('book-room-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const availStart = document.getElementById('book-start-time').value;
    const availEnd = document.getElementById('book-end-time').value;

    // Validate that dates are not in the past
    const now = new Date();
    const startDateTime = new Date(availStart);
    const endDateTime = new Date(availEnd);

    if (startDateTime < now) {
        showToast("Date selected must be current or in the future", "error");
        return;
    }

    if (endDateTime < now) {
        showToast("End date must be current or in the future", "error");
        return;
    }

    // Set loading state
    const btn = document.getElementById('btn-check-availability');
    const originalText = btn.textContent;
    btn.textContent = "Checking...";
    btn.disabled = true;

    const type = document.getElementById('book-room-type').value;
    const name = document.getElementById('book-room-name').value;
    const capacity = document.getElementById('book-expected-number').value;

    const filters = {};
    if (type) filters.type = type;
    if (name) filters.name = name;
    if (capacity) filters.capacity = capacity;

    try {
        const result = await API.getAvailableRooms(availStart, availEnd, filters);
        let rooms = result.rooms;
        state.rooms = Array.isArray(rooms) ? rooms : [];
        availableRoomsCurrentPage = 1;
        renderRoomsForBooking();
    } catch (e) {
        console.error("Filtering failed", e);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

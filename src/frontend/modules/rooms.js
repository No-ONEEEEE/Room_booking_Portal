/**
 * ROOK - Rooms Module
 * Handles room rendering, booking flow, and room feedback modal.
 */

import API from '../api.js';
import state from './state.js';
import { showToast } from './utils.js';
import { switchView } from './navigation.js';

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

export function renderRoomsForBooking() {
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

export async function initBookRoomForm() {
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

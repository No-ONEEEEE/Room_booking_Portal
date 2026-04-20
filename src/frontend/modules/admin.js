/**
 * ROOK - Admin Module
 * Handles admin panel: pending requests, feedback, and approval actions.
 */

import API from '../api.js';
import state from './state.js';
import { refreshAppData } from '../app.js';

const PENDING_PAGE_SIZE = 16;
const FEEDBACK_PAGE_SIZE = 14;

let pendingCurrentPage = 1;
let feedbackCurrentPage = 1;
let adminActiveSection = 'pending';

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
        feedbackCurrentPage = 1;
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

function renderPaginationControls(container, currentPage, totalPages, onPageSelect) {
    if (!container) return;

    if (totalPages <= 1) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    let startPage = Math.max(1, currentPage - 1);
    let endPage = Math.min(totalPages, startPage + 2);
    startPage = Math.max(1, endPage - 2);

    const pageButtons = [];
    for (let page = startPage; page <= endPage; page++) {
        pageButtons.push(`<button class="pagination-btn ${page === currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`);
    }

    container.innerHTML = `
        <button class="pagination-btn" data-page="${Math.max(1, currentPage - 1)}" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>
        ${pageButtons.join('')}
        <button class="pagination-btn" data-page="${Math.min(totalPages, currentPage + 1)}" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
    `;

    container.classList.remove('hidden');

    container.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedPage = Number(btn.getAttribute('data-page'));
            if (!Number.isNaN(selectedPage) && selectedPage !== currentPage) {
                onPageSelect(selectedPage);
            }
        });
    });
}

function switchAdminSection(section) {
    adminActiveSection = section === 'feedback' ? 'feedback' : 'pending';

    const pendingSection = document.getElementById('admin-pending-section');
    const feedbackSection = document.getElementById('admin-feedback-section');
    const summaryCards = document.getElementById('admin-summary-cards');
    const pendingBtn = document.getElementById('admin-nav-pending');
    const feedbackBtn = document.getElementById('admin-nav-feedback');

    if (pendingSection && feedbackSection) {
        pendingSection.classList.toggle('hidden', adminActiveSection !== 'pending');
        feedbackSection.classList.toggle('hidden', adminActiveSection !== 'feedback');
    }

    if (pendingBtn && feedbackBtn) {
        pendingBtn.classList.toggle('active', adminActiveSection === 'pending');
        feedbackBtn.classList.toggle('active', adminActiveSection === 'feedback');
    }

    if (summaryCards) {
        summaryCards.classList.toggle('hidden', adminActiveSection !== 'pending');
    }
}

function ensureAdminSectionNavBinding() {
    const pendingBtn = document.getElementById('admin-nav-pending');
    const feedbackBtn = document.getElementById('admin-nav-feedback');

    if (pendingBtn && pendingBtn.dataset.bound !== 'true') {
        pendingBtn.addEventListener('click', () => switchAdminSection('pending'));
        pendingBtn.dataset.bound = 'true';
    }

    if (feedbackBtn && feedbackBtn.dataset.bound !== 'true') {
        feedbackBtn.addEventListener('click', () => switchAdminSection('feedback'));
        feedbackBtn.dataset.bound = 'true';
    }

    switchAdminSection(adminActiveSection);
}

export async function refreshAdminData() {
    try {
        ensureAdminSectionNavBinding();

        const { bookings: pending } = await API.getPendingRequests();
        state.pendingBookings = Array.isArray(pending) ? pending : [];

        const pendingTotalPages = Math.max(Math.ceil(state.pendingBookings.length / PENDING_PAGE_SIZE), 1);
        if (pendingCurrentPage > pendingTotalPages) {
            pendingCurrentPage = pendingTotalPages;
        }

        renderAdminPending();

        const pendingBadge = document.getElementById('admin-stat-pending');
        if (pendingBadge) pendingBadge.textContent = state.pendingBookings.length;

        // Also load feedback for admin
        refreshFeedbackData();
    } catch (e) {
        console.error("Admin data refresh failed", e);
    }
}

export function resetAdminPanelView() {
    pendingCurrentPage = 1;
    feedbackCurrentPage = 1;
    adminActiveSection = 'pending';

    const roomFilter = document.getElementById('admin-feedback-room-filter');
    if (roomFilter) {
        roomFilter.value = '';
    }

    refreshAdminData();
}

export async function refreshFeedbackData() {
    const container = document.getElementById('admin-feedback-container');
    const paginationEl = document.getElementById('admin-feedback-pagination');
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

        const totalPages = Math.max(Math.ceil(filteredFeedback.length / FEEDBACK_PAGE_SIZE), 1);
        if (feedbackCurrentPage > totalPages) {
            feedbackCurrentPage = totalPages;
        }

        const start = (feedbackCurrentPage - 1) * FEEDBACK_PAGE_SIZE;
        const pagedFeedback = filteredFeedback.slice(start, start + FEEDBACK_PAGE_SIZE);

        renderFeedbackList(container, pagedFeedback);
        renderPaginationControls(paginationEl, feedbackCurrentPage, totalPages, (page) => {
            feedbackCurrentPage = page;
            refreshFeedbackData();
        });
    } catch (e) {
        container.innerHTML = `<p class="text-dim" style="text-align: center; padding: 1rem;">Could not load feedback.</p>`;
        if (paginationEl) {
            paginationEl.classList.add('hidden');
            paginationEl.innerHTML = '';
        }
    }
}

function renderAdminPending() {
    const container = document.getElementById('admin-pending-table');
    const paginationEl = document.getElementById('admin-pending-pagination');
    if (!container) return;

    if (!state.pendingBookings.length) {
        container.innerHTML = '<tr><td colspan="5" class="text-center text-dim">No pending requests found.</td></tr>';
        if (paginationEl) {
            paginationEl.classList.add('hidden');
            paginationEl.innerHTML = '';
        }
        return;
    }

    const totalPages = Math.max(Math.ceil(state.pendingBookings.length / PENDING_PAGE_SIZE), 1);
    if (pendingCurrentPage > totalPages) {
        pendingCurrentPage = totalPages;
    }

    const start = (pendingCurrentPage - 1) * PENDING_PAGE_SIZE;
    const pagedPending = state.pendingBookings.slice(start, start + PENDING_PAGE_SIZE);

    container.innerHTML = pagedPending.map(b => `
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

    renderPaginationControls(paginationEl, pendingCurrentPage, totalPages, (page) => {
        pendingCurrentPage = page;
        renderAdminPending();
    });
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

window.showAdminPendingSection = () => switchAdminSection('pending');
window.showAdminFeedbackSection = () => switchAdminSection('feedback');

window.downloadTodaySchedulePDF = () => {
    try {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert("PDF library is not loaded yet. Please try again in a moment.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        
        const todayBookings = state.bookings.filter(b => {
            if (b.status !== 'approved') return false;
            
            const bStart = new Date(String(b.start_time).replace(' ', 'T'));
            const bEnd = new Date(String(b.end_time).replace(' ', 'T'));
            
            if (Number.isNaN(bStart.getTime()) || Number.isNaN(bEnd.getTime())) return false;
            
            return bStart <= endOfDay && bEnd >= startOfDay;
        });

        todayBookings.sort((a, b) => new Date(String(a.start_time).replace(' ', 'T')) - new Date(String(b.start_time).replace(' ', 'T')));

        doc.setFontSize(18);
        doc.text("Today's Room Schedule", 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generated on: ${now.toLocaleString()}`, 14, 30);

        const tableColumn = ["User", "Room", "Time Slot", "Purpose"];
        const tableRows = [];

        todayBookings.forEach(b => {
            const bStart = new Date(String(b.start_time).replace(' ', 'T'));
            const bEnd = new Date(String(b.end_time).replace(' ', 'T'));
            const timeSlot = `${bStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${bEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            const roomData = b.room_name || `Room ${b.room_id}`;
            const userData = b.user_name || 'Unknown User';
            const purposeData = b.purpose || '-';
            tableRows.push([userData, roomData, timeSlot, purposeData]);
        });

        if (tableRows.length === 0) {
            doc.text("No meetings scheduled for today.", 14, 40);
        } else {
            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: 40,
                theme: 'striped',
                styles: { fontSize: 10, cellPadding: 3 },
                headStyles: { fillColor: [30, 41, 59] }
            });
        }

        doc.save(`Schedule_${now.toISOString().split('T')[0]}.pdf`);
    } catch (e) {
        console.error("PDF Generation failed:", e);
        alert("Failed to generate PDF. Check console for details.");
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

/**
 * ROOK - Calendar Module
 * Handles FullCalendar initialization.
 */

import state from './state.js';

function openCalendarBookingDetails(bookingId) {
    const modal = document.getElementById('activity-details-modal');
    const booking = state.bookings.find(b => Number(b.id) === Number(bookingId));
    if (!modal || !booking) return;

    const statusEl = document.getElementById('activity-detail-status');
    const purposeEl = document.getElementById('activity-detail-purpose');
    const userEl = document.getElementById('activity-detail-user');
    const roomEl = document.getElementById('activity-detail-room');
    const slotEl = document.getElementById('activity-detail-slot');
    const attendeesEl = document.getElementById('activity-detail-attendees');
    const refreshmentsEl = document.getElementById('activity-detail-refreshments');

    const startDate = new Date(booking.start_time);
    const endDate = new Date(booking.end_time);

    if (statusEl) {
        statusEl.className = `status-badge status-${booking.status}`;
        statusEl.textContent = booking.status || '-';
    }

    if (purposeEl) purposeEl.textContent = booking.purpose || '-';
    if (userEl) userEl.textContent = booking.user_name || state.user?.name || '-';
    if (roomEl) roomEl.textContent = booking.room_name || `Room #${booking.room_id || '-'}`;

    if (slotEl) {
        const startText = Number.isNaN(startDate.getTime()) ? (booking.start_time || '-') : startDate.toLocaleString();
        const endText = Number.isNaN(endDate.getTime()) ? (booking.end_time || '-') : endDate.toLocaleString();
        slotEl.textContent = `${startText} to ${endText}`;
    }

    if (attendeesEl) attendeesEl.textContent = booking.expected_people || '-';
    if (refreshmentsEl) refreshmentsEl.textContent = booking.snacks_requested ? 'Requested' : 'Not requested';

    modal.classList.remove('hidden');

    if (modal.dataset.calendarBound !== 'true') {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.add('hidden');
            }
        });
        modal.dataset.calendarBound = 'true';
    }
}

export function initCalendar() {
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
        eventClick: (info) => {
            const bookingId = Number(info.event.id);
            if (!Number.isNaN(bookingId)) {
                openCalendarBookingDetails(bookingId);
            }
        },
        eventDidMount: (info) => {
            info.el.style.cursor = 'pointer';
            info.el.setAttribute('title', 'Click for booking details');
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
                textColor: style.border,
                extendedProps: {
                    status: b.status,
                    roomId: b.room_id
                }
            };
        })
    });
    state.calendar.render();
}

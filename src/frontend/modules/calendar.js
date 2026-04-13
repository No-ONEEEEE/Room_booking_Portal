/**
 * ROOK - Calendar Module
 * Handles FullCalendar initialization.
 */

import state from './state.js';

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

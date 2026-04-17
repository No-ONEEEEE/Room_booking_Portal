/**
 * ROOK - Shared Application State
 */

let state = {
    currentView: 'dashboard',
    user: null,
    rooms: [],
    bookings: [],
    pendingBookings: [],
    notifications: [],
    bookingFilter: 'all',
    scheduleScope: 'own',
    calendar: null,
    charts: {}
};

export default state;

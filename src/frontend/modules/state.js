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
    calendar: null,
    charts: {}
};

export default state;

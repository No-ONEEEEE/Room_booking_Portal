/**
 * ROOK - API Service Utility
 * Handles all fetch requests to the PHP backend.
 */

const API_BASE_URL = '/backend/public';

/**
 * Enhanced Fetch Wrapper
 */
async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Request failed');
        }
        
        return result.data;
    } catch (error) {
        console.error(`API Error [${endpoint}]:`, error);
        showToast(error.message, 'error');
        throw error;
    }
}

/**
 * Toast Notification System
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} fade-in`;
    toast.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// --- API Methods ---

const API = {
    // Auth
    login: (email) => apiRequest('/login', 'POST', { email }),
    logout: () => apiRequest('/logout', 'POST'),
    me: () => apiRequest('/me'),
    getUsers: () => apiRequest('/users'),

    // Rooms
    getRooms: (filters = {}) => {
        const query = new URLSearchParams(filters).toString();
        return apiRequest(`/rooms?${query}`);
    },
    filterRooms: (filters) => API.getRooms(filters),
    
    getAvailableRooms: (startTime, endTime, filters = {}) => {
        const query = new URLSearchParams({ startTime, endTime, ...filters }).toString();
        return apiRequest(`/rooms/available?${query}`);
    },

    checkAvailability: (roomId, startTime, endTime) => {
        const query = new URLSearchParams({ startTime, endTime }).toString();
        return apiRequest(`/rooms/${roomId}/availability?${query}`);
    },
    getRoomFeedback: (roomId) => apiRequest(`/rooms/${roomId}/feedback`),

    // Bookings
    getUserBookings: (filters = {}) => {
        const query = new URLSearchParams(filters).toString();
        return apiRequest(`/bookings?${query}`);
    },
    getPendingRequests: () => apiRequest('/bookings?status=pending'),
    createBooking: (bookingData) => apiRequest('/bookings', 'POST', bookingData),
    cancelBooking: (bookingId) => apiRequest(`/bookings/${bookingId}/cancel`, 'PATCH'),
    markCompleted: (bookingId) => apiRequest(`/bookings/${bookingId}/complete`, 'PATCH'),
    getCalendarBookings: (start, end) => apiRequest(`/bookings?startDate=${start}&endDate=${end}`),
    getStats: () => apiRequest('/bookings/statistics'),

    // Admin
    approveBooking: (bookingId) => apiRequest(`/bookings/${bookingId}/approve`, 'PATCH'),
    declineBooking: (bookingId, reason) => apiRequest(`/bookings/${bookingId}/decline`, 'PATCH', { reason }),
    requestMoreDetails: (bookingId, notes) => apiRequest(`/bookings/${bookingId}/request-details`, 'PATCH', { notes }),

    // Feedback
    submitFeedback: (bookingId, rating, comments) => apiRequest('/feedback', 'POST', { bookingId, rating, comments }),
    getFeedback: (bookingId) => apiRequest(`/feedback?bookingId=${bookingId}`),
    getAllFeedback: () => apiRequest('/feedback')
};

export default API;

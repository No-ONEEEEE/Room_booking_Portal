/**
 * ROOK - Search Rooms Module
 * Handles searching rooms and displaying their availability calendar.
 */

import API from '../api.js';
import state from './state.js';

let roomCalendar = null;
let performSearchHandler = null;
let feedbackStatsByRoom = new Map();
let feedbackStatsLoaded = false;
const SEARCH_PAGE_SIZE = 16;
let searchCurrentPage = 1;
let searchLastResults = [];

function parseDateSafe(value) {
    const parsed = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildFeedbackStats(feedbackList) {
    const stats = new Map();

    feedbackList.forEach(item => {
        const roomId = Number(item.room_id);
        const rating = Number(item.rating);

        if (Number.isNaN(roomId) || Number.isNaN(rating)) return;

        if (!stats.has(roomId)) {
            stats.set(roomId, { sum: 0, count: 0 });
        }

        const current = stats.get(roomId);
        current.sum += rating;
        current.count += 1;
    });

    return stats;
}

async function ensureFeedbackStatsLoaded() {
    if (feedbackStatsLoaded) return;

    if (!state.user || state.user.role !== 'admin') {
        feedbackStatsLoaded = true;
        return;
    }

    try {
        const { feedbacks } = await API.getAllFeedback();
        const list = Array.isArray(feedbacks) ? feedbacks : [];
        feedbackStatsByRoom = buildFeedbackStats(list);
    } catch (_) {
        feedbackStatsByRoom = new Map();
    } finally {
        feedbackStatsLoaded = true;
    }
}

function computeTrendingScore(room, allBookings, maxBookingCount) {
    const now = new Date();
    const roomBookings = allBookings.filter(b => Number(b.room_id) === Number(room.id));

    const bookingCount = roomBookings.length;
    const volumeScore = maxBookingCount > 0 ? bookingCount / maxBookingCount : 0;

    const recencyRaw = roomBookings.reduce((sum, booking) => {
        const bookingDate = parseDateSafe(booking.start_time);
        if (!bookingDate) return sum;

        const ageInDays = Math.max((now - bookingDate) / (1000 * 60 * 60 * 24), 0);
        const halfLifeDays = 14;
        return sum + Math.exp(-ageInDays / halfLifeDays);
    }, 0);

    const maxRecencyRaw = Math.max(maxBookingCount, 1);
    const recencyScore = Math.min(recencyRaw / maxRecencyRaw, 1);

    const feedbackStats = feedbackStatsByRoom.get(Number(room.id));
    const averageRating = feedbackStats && feedbackStats.count > 0
        ? feedbackStats.sum / feedbackStats.count
        : 3;
    const qualityScore = averageRating / 5;

    // WTRS: Weighted Trend Ranking Score = 0.55*volume + 0.30*recency + 0.15*quality
    return 0.55 * volumeScore + 0.30 * recencyScore + 0.15 * qualityScore;
}

function getTrendingRooms(rooms) {
    const trendRelevantBookings = state.bookings.filter(b =>
        ['pending', 'approved', 'completed'].includes(String(b.status || '').toLowerCase())
    );

    const bookingCountByRoom = trendRelevantBookings.reduce((acc, booking) => {
        const roomId = Number(booking.room_id);
        if (Number.isNaN(roomId)) return acc;
        acc.set(roomId, (acc.get(roomId) || 0) + 1);
        return acc;
    }, new Map());

    const maxBookingCount = Math.max(...bookingCountByRoom.values(), 0);

    return [...rooms]
        .map(room => ({
            room,
            score: computeTrendingScore(room, trendRelevantBookings, maxBookingCount)
        }))
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if ((b.room.capacity || 0) !== (a.room.capacity || 0)) {
                return (b.room.capacity || 0) - (a.room.capacity || 0);
            }
            return String(a.room.room_name || '').localeCompare(String(b.room.room_name || ''));
        })
        .map(item => item.room);
}

export async function initSearchRooms() {
    const nameInput = document.getElementById('search-room-name');
    const typeSelect = document.getElementById('search-room-type');
    const capacityInput = document.getElementById('search-room-capacity');

    if (!nameInput) return;

    const performSearch = async () => {
        const query = nameInput.value.toLowerCase();
        const type = typeSelect.value;
        const minCapacity = parseInt(capacityInput.value) || 0;

        if (query === "" && type === "" && minCapacity === 0) {
            await ensureFeedbackStatsLoaded();
            searchCurrentPage = 1;
            renderSearchResults(getTrendingRooms(state.rooms));
            return;
        }

        const filtered = state.rooms.filter(room => {
            const matchesName = room.room_name.toLowerCase().includes(query);
            const matchesType = type === "" || room.type === type;
            const matchesCapacity = room.capacity >= minCapacity;
            return matchesName && matchesType && matchesCapacity;
        });

        searchCurrentPage = 1;
        renderSearchResults(filtered);
    };

    performSearchHandler = performSearch;

    nameInput.addEventListener('input', performSearch);
    typeSelect.addEventListener('change', performSearch);
    capacityInput.addEventListener('input', performSearch);

    // Default state shows all rooms in trending order.
    performSearch();
}

function renderSearchResults(rooms) {
    const resultsList = document.getElementById('search-results-list');
    const paginationEl = document.getElementById('search-results-pagination');
    searchLastResults = Array.isArray(rooms) ? rooms : [];

    if (!searchLastResults.length) {
        resultsList.innerHTML = `
            <div style="padding: 1.5rem; text-align: center; color: var(--text-dim);">
                <i class="fas fa-search" style="display: block; font-size: 1.5rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                No matching rooms found
            </div>`;
        resultsList.classList.remove('hidden');
        if (paginationEl) {
            paginationEl.classList.add('hidden');
            paginationEl.innerHTML = '';
        }
        return;
    }

    const totalPages = Math.max(Math.ceil(searchLastResults.length / SEARCH_PAGE_SIZE), 1);
    if (searchCurrentPage > totalPages) {
        searchCurrentPage = totalPages;
    }

    const start = (searchCurrentPage - 1) * SEARCH_PAGE_SIZE;
    const pagedRooms = searchLastResults.slice(start, start + SEARCH_PAGE_SIZE);

    resultsList.classList.remove('hidden');
    resultsList.innerHTML = `
        <div class="table-container">
            <table class="admin-table search-results-table">
                <thead>
                    <tr>
                        <th>Room</th>
                        <th>Type</th>
                        <th>Capacity</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${pagedRooms.map(room => `
                        <tr>
                            <td><strong style="color: var(--text-primary);">${room.room_name}</strong></td>
                            <td style="text-transform: uppercase;">${room.type}</td>
                            <td>${room.capacity}</td>
                            <td>
                                <button class="btn btn-small more-info-btn" onclick='selectRoomForSchedule(${room.id}, ${JSON.stringify(room.room_name)})'>View Schedule</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    if (!paginationEl) return;

    if (totalPages <= 1) {
        paginationEl.classList.add('hidden');
        paginationEl.innerHTML = '';
        return;
    }

    let startPage = Math.max(1, searchCurrentPage - 1);
    let endPage = Math.min(totalPages, startPage + 2);
    startPage = Math.max(1, endPage - 2);

    const pageButtons = [];
    for (let page = startPage; page <= endPage; page++) {
        pageButtons.push(`<button class="pagination-btn ${page === searchCurrentPage ? 'active' : ''}" data-page="${page}">${page}</button>`);
    }

    paginationEl.innerHTML = `
        <button class="pagination-btn" data-page="${Math.max(1, searchCurrentPage - 1)}" ${searchCurrentPage === 1 ? 'disabled' : ''}>Prev</button>
        ${pageButtons.join('')}
        <button class="pagination-btn" data-page="${Math.min(totalPages, searchCurrentPage + 1)}" ${searchCurrentPage === totalPages ? 'disabled' : ''}>Next</button>
    `;
    paginationEl.classList.remove('hidden');

    paginationEl.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const selectedPage = Number(btn.getAttribute('data-page'));
            if (!Number.isNaN(selectedPage) && selectedPage !== searchCurrentPage) {
                searchCurrentPage = selectedPage;
                renderSearchResults(searchLastResults);
            }
        });
    });
}

window.selectRoomForSchedule = async (roomId, roomName) => {
    document.getElementById('search-results-list').classList.add('hidden');
    document.getElementById('search-results-pagination')?.classList.add('hidden');
    document.getElementById('search-room-name').value = roomName;
    document.getElementById('room-schedule-container').classList.remove('hidden');
    await loadRoomSchedule(roomId);
};

async function loadRoomSchedule(roomId) {
    try {
        const { bookings } = await API.getRoomBookings(roomId);
        renderRoomCalendar(bookings);
    } catch (error) {
        console.error("Failed to load room schedule", error);
    }
}

function renderRoomCalendar(bookings) {
    const calendarEl = document.getElementById('room-calendar');
    if (!calendarEl) return;

    if (roomCalendar) {
        roomCalendar.destroy();
    }

    // Process bookings to identify occupied days
    const occupiedDates = new Set();
    bookings.forEach(b => {
        if (b.status === 'approved' || b.status === 'pending') {
            const start = new Date(b.start_time);
            const end = new Date(b.end_time);

            // Add all dates between start and end
            let current = new Date(start.toDateString());
            const last = new Date(end.toDateString());

            while (current <= last) {
                occupiedDates.add(current.toISOString().split('T')[0]);
                current.setDate(current.getDate() + 1);
            }
        }
    });

    roomCalendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: ''
        },
        height: 'auto',
        dayCellDidMount: (info) => {
            const dateStr = info.date.toISOString().split('T')[0];
            if (occupiedDates.has(dateStr)) {
                info.el.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                info.el.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                info.el.setAttribute('title', 'Occupied');
            } else {
                info.el.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                info.el.style.border = '1px solid rgba(16, 185, 129, 0.2)';
                info.el.setAttribute('title', 'Available');
            }
        },
        events: bookings.filter(b => b.status === 'approved' || b.status === 'pending').map(b => ({
            title: b.purpose,
            start: b.start_time,
            end: b.end_time,
            backgroundColor: b.status === 'approved' ? '#ef4444' : '#f59e0b',
            borderColor: 'transparent',
            textColor: '#fff'
        }))
    });

    roomCalendar.render();

    // Fix for calendar not rendering correctly in hidden containers
    setTimeout(() => {
        roomCalendar.updateSize();
    }, 10);
}

export function refreshSearchRooms() {
    if (roomCalendar) {
        roomCalendar.updateSize();
    }

    if (typeof performSearchHandler === 'function') {
        performSearchHandler();
    }
}

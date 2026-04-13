/**
 * ROOK - Search Rooms Module
 * Handles searching rooms and displaying their availability calendar.
 */

import API from '../api.js';
import state from './state.js';

let roomCalendar = null;

export async function initSearchRooms() {
    const nameInput = document.getElementById('search-room-name');
    const typeSelect = document.getElementById('search-room-type');
    const capacityInput = document.getElementById('search-room-capacity');

    if (!nameInput) return;

    const performSearch = () => {
        const query = nameInput.value.toLowerCase();
        const type = typeSelect.value;
        const minCapacity = parseInt(capacityInput.value) || 0;

        if (query === "" && type === "" && minCapacity === 0) {
            document.getElementById('search-results-list').classList.add('hidden');
            return;
        }

        const filtered = state.rooms.filter(room => {
            const matchesName = room.room_name.toLowerCase().includes(query);
            const matchesType = type === "" || room.type === type;
            const matchesCapacity = room.capacity >= minCapacity;
            return matchesName && matchesType && matchesCapacity;
        });

        renderSearchResults(filtered);
    };

    nameInput.addEventListener('input', performSearch);
    typeSelect.addEventListener('change', performSearch);
    capacityInput.addEventListener('input', performSearch);

    // Initial hint of all rooms if inputs are empty? 
    // Usually it's better to wait for input.
}

function renderSearchResults(rooms) {
    const resultsList = document.getElementById('search-results-list');

    if (!rooms.length) {
        resultsList.innerHTML = `
            <div style="padding: 1.5rem; text-align: center; color: var(--text-dim);">
                <i class="fas fa-search" style="display: block; font-size: 1.5rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                No matching rooms found
            </div>`;
        resultsList.classList.remove('hidden');
        return;
    }

    resultsList.classList.remove('hidden');
    resultsList.innerHTML = rooms.map(room => `
        <div class="search-result-item" onclick="selectRoomForSchedule(${room.id}, '${room.room_name}')" style="padding: 0.75rem 1rem; cursor: pointer; border-bottom: 1px solid var(--border-glass); transition: background 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--text-primary);">${room.room_name}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase;">${room.type} • Capacity: ${room.capacity}</div>
                </div>
                <i class="fas fa-chevron-right" style="color: var(--text-dim); font-size: 0.8rem;"></i>
            </div>
        </div>
    `).join('');
}

window.selectRoomForSchedule = async (roomId, roomName) => {
    document.getElementById('search-results-list').classList.add('hidden');
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
}

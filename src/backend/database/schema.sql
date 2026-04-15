SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS booking_guests;
DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    role ENUM('user', 'admin') NOT NULL
);

CREATE TABLE rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_name VARCHAR(100) NOT NULL,
    type ENUM('classroom', 'meeting') NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0)
);

CREATE TABLE bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,
    room_id INT NOT NULL,

    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,

    purpose TEXT NOT NULL,

    expected_people INT NOT NULL CHECK (expected_people > 0),

    remarks TEXT,

    snacks_requested BOOLEAN DEFAULT FALSE,
    refreshment_details JSON DEFAULT NULL,

    status ENUM(
        'pending',
        'approved',
        'declined',
        'cancelled',
        'completed'
    ) DEFAULT 'pending',

    decline_reason TEXT,
    clarification_notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_booking_time
        CHECK (end_time > start_time),

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (room_id)
        REFERENCES rooms(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE booking_guests (
    booking_id INT NOT NULL,
    user_id INT NOT NULL,

    PRIMARY KEY (booking_id, user_id),

    FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,

    booking_id INT NOT NULL UNIQUE,

    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),

    comments TEXT,

    FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_bookings_room
ON bookings(room_id);

CREATE INDEX idx_bookings_user
ON bookings(user_id);

CREATE INDEX idx_bookings_status
ON bookings(status);

CREATE INDEX idx_bookings_start_time
ON bookings(start_time);

CREATE INDEX idx_booking_guests_user
ON booking_guests(user_id);

CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    booking_id INT,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
);
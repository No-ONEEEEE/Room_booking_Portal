<?php

require_once __DIR__ . '/connection.php';

function seedDatabase($pdo) {

    try {

        $pdo->setAttribute(PDO::ATTR_AUTOCOMMIT, 0);
        $pdo->beginTransaction();

        echo "Resetting tables...\n";

        $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
        $pdo->exec("TRUNCATE TABLE feedback");
        $pdo->exec("TRUNCATE TABLE booking_guests");
        $pdo->exec("TRUNCATE TABLE bookings");
        $pdo->exec("TRUNCATE TABLE users");
        $pdo->exec("TRUNCATE TABLE rooms");
        $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");


        /*
        =========================
        USERS
        =========================
        */

        echo "Seeding users...\n";

        $users = [
            ['John Doe','john@example.com','user'],
            ['Jane Smith','jane@example.com','user'],
            ['Mike Johnson','mike@example.com','user'],
            ['Sarah Williams','sarah@example.com','user'],
            ['Tom Brown','tom@example.com','user'],
            ['Emily Davis','emily@example.com','user'],
            ['Robert Miller','robert@example.com','user'],
            ['Lisa Anderson','lisa@example.com','user'],
            ['James Taylor','james@example.com','user'],
            ['Mary Thomas','mary@example.com','user'],
            ['David Jackson','david@example.com','user'],
            ['Jennifer White','jennifer@example.com','user'],
            ['Charles Harris','charles@example.com','user'],
            ['Patricia Martin','patricia@example.com','user'],
            ['Christopher Lee','christopher@example.com','user'],
            ['Barbara Clark','barbara@example.com','user'],
            ['Daniel Lewis','daniel@example.com','user'],
            ['Nancy Walker','nancy@example.com','user'],
            ['Matthew Hall','matthew@example.com','user'],
            ['Karen Young','karen@example.com','user'],
            ['Admin User','admin@example.com','admin'],
            ['Admin Two','admin2@example.com','admin']
        ];

        $userIds = [];

        $stmtUser = $pdo->prepare("
            INSERT INTO users (name,email,role)
            VALUES (?,?,?)
        ");

        foreach ($users as $user) {
            $stmtUser->execute($user);
            $userIds[] = $pdo->lastInsertId();
        }

        echo "Created ".count($userIds)." users\n";


        /*
        =========================
        ROOMS
        =========================
        */

        echo "Seeding rooms...\n";

        $rooms = [
            ['Conference Room A','meeting',20],
            ['Conference Room B','meeting',15],
            ['Conference Room C','meeting',10],
            ['Board Room','meeting',30],
            ['Executive Suite','meeting',8],
            ['Classroom 101','classroom',40],
            ['Classroom 102','classroom',35],
            ['Classroom 103','classroom',30],
            ['Classroom 104','classroom',25],
            ['Seminar Room','classroom',50],
            ['Training Lab','classroom',20],
            ['Studio A','meeting',12],
            ['Studio B','meeting',12],
            ['Auditorium','classroom',100],
            ['Small Meeting Room','meeting',6],
            ['Medium Board Room','meeting',18],
            ['Large Classroom','classroom',60],
            ['Workshop Room','classroom',28],
            ['Focus Room 1','meeting',4],
            ['Focus Room 2','meeting',4]
        ];

        $roomIds = [];

        $stmtRoom = $pdo->prepare("
            INSERT INTO rooms (room_name,type,capacity)
            VALUES (?,?,?)
        ");

        foreach ($rooms as $room) {
            $stmtRoom->execute($room);
            $roomIds[] = $pdo->lastInsertId();
        }

        echo "Created ".count($roomIds)." rooms\n";


        /*
        =========================
        BOOKINGS
        =========================
        */

        echo "Seeding bookings...\n";

        $statuses = ['pending','approved','declined','cancelled','completed'];

        $purposes = [
            'Team meeting','Project kickoff','Client presentation','Training session',
            'Workshop','Orientation','Performance review','Department meeting',
            'Budget planning','Strategy session','Product demo','Brainstorming',
            'Interview','Board meeting','Quarterly review','Team building',
            'Guest lecture','Conference setup','Planning session','Discussion forum'
        ];

        $stmtBooking = $pdo->prepare("
            INSERT INTO bookings
            (
                user_id,
                room_id,
                start_time,
                end_time,
                purpose,
                expected_people,
                remarks,
                snacks_requested,
                status,
                decline_reason,
                clarification_notes
            )
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ");

        $stmtGuest = $pdo->prepare("
            INSERT IGNORE INTO booking_guests (booking_id,user_id)
            VALUES (?,?)
        ");

        $now = new DateTime();
        $bookingCount = 0;

        for ($i = 0; $i < 150; $i++) {

            $userId = $userIds[array_rand($userIds)];
            $roomId = $roomIds[array_rand($roomIds)];

            $status = $statuses[array_rand($statuses)];
            $purpose = $purposes[array_rand($purposes)];

            $expectedPeople = rand(2,40);
            $remarks = rand(0,1) ? "Special setup required" : null;
            $snacksRequested = rand(0,1);

            $daysOffset = rand(-60,60);

            $startTime = clone $now;
            $startTime->modify("$daysOffset days");
            $startTime->setTime(rand(8,16),0,0);

            $endTime = clone $startTime;
            $endTime->modify("+".rand(1,4)." hours");

            $declineReason = null;

            if ($status === 'declined') {
                $reasons = [
                    'Room not available',
                    'Conflicting booking',
                    'Maintenance scheduled',
                    'Insufficient details'
                ];
                $declineReason = $reasons[array_rand($reasons)];
            }

            $clarificationNotes = null;

            if (rand(0,1)) {
                $notes = [
                    'Please confirm attendee list',
                    'Clarify agenda',
                    'Provide equipment details',
                    'Confirm headcount'
                ];
                $clarificationNotes = $notes[array_rand($notes)];
            }

            $stmtBooking->execute([
                $userId,
                $roomId,
                $startTime->format('Y-m-d H:i:s'),
                $endTime->format('Y-m-d H:i:s'),
                $purpose,
                $expectedPeople,
                $remarks,
                $snacksRequested,
                $status,
                $declineReason,
                $clarificationNotes
            ]);

            $bookingId = $pdo->lastInsertId();
            $bookingCount++;

            $guestCount = rand(0,3);

            for ($g=0; $g<$guestCount; $g++) {

                $guestId = $userIds[array_rand($userIds)];

                if ($guestId == $userId) continue;

                $stmtGuest->execute([$bookingId,$guestId]);
            }
        }

        echo "Created $bookingCount bookings\n";


        /*
        =========================
        FEEDBACK
        =========================
        */

        echo "Seeding feedback...\n";

        $comments = [
            'Excellent room','Great facilities','Comfortable space',
            'Perfect for meetings','Good AV equipment','Very clean room',
            'Professional environment','Highly recommended','Good lighting',
            'Slightly noisy but ok'
        ];

        $completedBookings = $pdo->query("
            SELECT id
            FROM bookings
            WHERE status='completed'
            LIMIT 80
        ")->fetchAll(PDO::FETCH_COLUMN);

        $stmtFeedback = $pdo->prepare("
            INSERT INTO feedback (booking_id,rating,comments)
            VALUES (?,?,?)
        ");

        $feedbackCount = 0;

        foreach ($completedBookings as $bookingId) {

            if (rand(0,100) < 70) {

                $rating = rand(3,5);
                $comment = rand(0,1) ? $comments[array_rand($comments)] : null;

                $stmtFeedback->execute([$bookingId,$rating,$comment]);
                $feedbackCount++;
            }
        }

        echo "Created $feedbackCount feedback entries\n";


        $pdo->commit();
        $pdo->setAttribute(PDO::ATTR_AUTOCOMMIT, 1);

        echo "\nDatabase seeding completed successfully!\n";

        echo "Summary:\n";
        echo "Users: ".count($userIds)."\n";
        echo "Rooms: ".count($roomIds)."\n";
        echo "Bookings: $bookingCount\n";
        echo "Feedback: $feedbackCount\n";

    }

    catch (Exception $e) {

        $pdo->setAttribute(PDO::ATTR_AUTOCOMMIT,1);

        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        echo "Error seeding database: ".$e->getMessage()."\n";
        exit(1);
    }
}

if (php_sapi_name() !== 'cli') {
    echo "This script must be run from CLI.\n";
    exit(1);
}

seedDatabase($pdo);
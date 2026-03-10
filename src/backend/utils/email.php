<?php

require_once __DIR__ . '/../libs/Exception.php';
require_once __DIR__ . '/../libs/PHPMailer.php';
require_once __DIR__ . '/../libs/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

/**
 * Send an email using PHPMailer with SMTP
 */
function sendEmail($to, $subject, $message) {
    $config = require __DIR__ . '/../config/mail.php';

    if (empty($config['smtp_username']) || empty($config['smtp_password'])) {
        error_log("Email not sent: SMTP credentials not configured in config/mail.php");
        return false;
    }

    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        $mail->Host       = $config['smtp_host'];
        $mail->SMTPAuth   = $config['smtp_auth'];
        $mail->Username   = $config['smtp_username'];
        $mail->Password   = $config['smtp_password'];
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = $config['smtp_port'];

        $mail->setFrom($config['from_email'], $config['from_name']);
        $mail->addAddress($to);

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $message;

        $mail->send();
        error_log("Email sent successfully to: $to");
        return true;
    } catch (Exception $e) {
        error_log("Email sending failed to $to: " . $mail->ErrorInfo);
        return false;
    }
}

/**
 * Send booking approval email
 * 
 * @param string $userEmail User's email address
 * @param string $userName User's name
 * @param array $booking Booking details
 * @return bool
 */
function sendBookingApprovalEmail($userEmail, $userName, $booking) {
    $subject = "Booking Approved - Room Booking System";
    
    $message = "
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
            .booking-details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
            .booking-details p { margin: 8px 0; }
            .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
            .label { font-weight: bold; }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <h1>✓ Booking Approved</h1>
            </div>
            <div class='content'>
                <p>Dear " . htmlspecialchars($userName) . ",</p>
                <p>Great news! Your booking request has been <strong>approved</strong>.</p>
                
                <div class='booking-details'>
                    <h3>Booking Details:</h3>
                    <p><span class='label'>Booking ID:</span> #" . htmlspecialchars($booking['id']) . "</p>
                    <p><span class='label'>Room:</span> " . htmlspecialchars($booking['room_name']) . "</p>
                    <p><span class='label'>Start Time:</span> " . htmlspecialchars(date('F j, Y g:i A', strtotime($booking['start_time']))) . "</p>
                    <p><span class='label'>End Time:</span> " . htmlspecialchars(date('F j, Y g:i A', strtotime($booking['end_time']))) . "</p>
                    <p><span class='label'>Purpose:</span> " . htmlspecialchars($booking['purpose']) . "</p>
                    <p><span class='label'>Snacks Requested:</span> " . ($booking['snacks_requested'] ? 'Yes' : 'No') . "</p>
                </div>
                
                <p>Please make sure to arrive on time and use the room responsibly.</p>
                <p>If you need to make any changes or cancel this booking, please do so through the booking system.</p>
            </div>
            <div class='footer'>
                <p>This is an automated message from the Room Booking System. Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    ";
    
    return sendEmail($userEmail, $subject, $message);
}

/**
 * Send booking rejection/decline email
 * 
 * @param string $userEmail User's email address
 * @param string $userName User's name
 * @param array $booking Booking details
 * @param string $reason Reason for rejection
 * @return bool
 */
function sendBookingRejectionEmail($userEmail, $userName, $booking, $reason) {
    $subject = "Booking Declined - Room Booking System";
    
    $message = "
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f44336; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
            .booking-details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #f44336; }
            .booking-details p { margin: 8px 0; }
            .reason-box { background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 4px; }
            .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
            .label { font-weight: bold; }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <h1>✗ Booking Declined</h1>
            </div>
            <div class='content'>
                <p>Dear " . htmlspecialchars($userName) . ",</p>
                <p>We regret to inform you that your booking request has been <strong>declined</strong>.</p>
                
                <div class='booking-details'>
                    <h3>Booking Details:</h3>
                    <p><span class='label'>Booking ID:</span> #" . htmlspecialchars($booking['id']) . "</p>
                    <p><span class='label'>Room:</span> " . htmlspecialchars($booking['room_name']) . "</p>
                    <p><span class='label'>Start Time:</span> " . htmlspecialchars(date('F j, Y g:i A', strtotime($booking['start_time']))) . "</p>
                    <p><span class='label'>End Time:</span> " . htmlspecialchars(date('F j, Y g:i A', strtotime($booking['end_time']))) . "</p>
                    <p><span class='label'>Purpose:</span> " . htmlspecialchars($booking['purpose']) . "</p>
                </div>
                
                <div class='reason-box'>
                    <p><span class='label'>Reason for Decline:</span></p>
                    <p>" . nl2br(htmlspecialchars($reason)) . "</p>
                </div>
                
                <p>If you have any questions or would like to discuss this further, please contact the administrator.</p>
                <p>You can make a new booking request at any time through the booking system.</p>
            </div>
            <div class='footer'>
                <p>This is an automated message from the Room Booking System. Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    ";
    
    return sendEmail($userEmail, $subject, $message);
}

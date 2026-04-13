/**
 * ROOK - Feedback Module
 * Handles feedback modal and star rating.
 */

import API from '../api.js';
import state from './state.js';
import { showToast } from './utils.js';
import { refreshAppData } from '../app.js';

export async function openFeedbackModal(bookingId) {
    document.getElementById('feedback-booking-id').value = bookingId;
    document.getElementById('feedback-rating').value = '0';
    document.getElementById('feedback-comments').value = '';
    // Reset stars
    document.querySelectorAll('#star-rating .fa-star').forEach(s => s.classList.remove('active'));

    // Try to load existing feedback for rewriting
    try {
        const { feedback } = await API.getFeedback(bookingId);
        if (feedback) {
            document.getElementById('feedback-rating').value = feedback.rating;
            document.getElementById('feedback-comments').value = feedback.comments || '';
            document.querySelectorAll('#star-rating .fa-star').forEach(s => {
                s.classList.toggle('active', parseInt(s.getAttribute('data-value')) <= feedback.rating);
            });
        }
    } catch (e) {
        // No existing feedback — that's fine, leave blank
    }

    document.getElementById('feedback-modal').classList.remove('hidden');
}

export function closeFeedbackModal() {
    document.getElementById('feedback-modal').classList.add('hidden');
    document.getElementById('feedback-form').reset();
    document.querySelectorAll('#star-rating .fa-star').forEach(s => s.classList.remove('active'));
}

export function initStarRating() {
    const stars = document.querySelectorAll('#star-rating .fa-star');
    const ratingInput = document.getElementById('feedback-rating');

    stars.forEach(star => {
        star.addEventListener('mouseenter', () => {
            const val = parseInt(star.getAttribute('data-value'));
            stars.forEach(s => {
                s.classList.toggle('hovered', parseInt(s.getAttribute('data-value')) <= val);
            });
        });

        star.addEventListener('mouseleave', () => {
            stars.forEach(s => s.classList.remove('hovered'));
        });

        star.addEventListener('click', () => {
            const val = star.getAttribute('data-value');
            ratingInput.value = val;
            stars.forEach(s => {
                s.classList.toggle('active', parseInt(s.getAttribute('data-value')) <= parseInt(val));
            });
        });
    });
}

export function initFeedbackForm() {
    const form = document.getElementById('feedback-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const bookingId = document.getElementById('feedback-booking-id').value;
        const rating = parseInt(document.getElementById('feedback-rating').value);
        const comments = document.getElementById('feedback-comments').value;

        if (!rating || rating < 1) {
            showToast("Please select a rating.", "error");
            return;
        }

        try {
            await API.submitFeedback(parseInt(bookingId), rating, comments || null);
            showToast("Thank you for your feedback!", "info");
            closeFeedbackModal();
            await refreshAppData();
        } catch (e) { }
    });
}

window.openFeedbackModal = openFeedbackModal;
window.closeFeedbackModal = closeFeedbackModal;

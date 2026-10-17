package com.studyhive.service;

import com.studyhive.repository.BookingRepository;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;

/**
 * Human-readable references such as {@code SH-7KQ3PA}. The alphabet omits 0/O and 1/I/L so references can be
 * read aloud or typed without ambiguity. ~887 million combinations; uniqueness is also enforced by the database.
 */
@Component
public class BookingReferenceGenerator {

    private static final char[] ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ".toCharArray();
    private static final int LENGTH = 6;

    private final SecureRandom random = new SecureRandom();
    private final BookingRepository bookings;

    public BookingReferenceGenerator(BookingRepository bookings) {
        this.bookings = bookings;
    }

    public String next() {
        for (int attempt = 0; attempt < 10; attempt++) {
            String candidate = randomReference();
            if (!bookings.existsByBookingReference(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not generate a unique booking reference");
    }

    String randomReference() {
        StringBuilder sb = new StringBuilder("SH-");
        for (int i = 0; i < LENGTH; i++) {
            sb.append(ALPHABET[random.nextInt(ALPHABET.length)]);
        }
        return sb.toString();
    }
}

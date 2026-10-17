package com.studyhive.service;

import com.studyhive.repository.BookingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;

/** Moves confirmed bookings whose end time has passed to COMPLETED. */
@Component
public class BookingCompletionJob {

    private static final Logger log = LoggerFactory.getLogger(BookingCompletionJob.class);

    private final BookingRepository bookings;
    private final Clock clock;

    public BookingCompletionJob(BookingRepository bookings, Clock clock) {
        this.bookings = bookings;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${app.completion-job-interval-ms:300000}", initialDelay = 30_000)
    @Transactional
    public void completeFinishedBookings() {
        int updated = bookings.markCompleted(LocalDateTime.now(clock), Instant.now());
        if (updated > 0) {
            log.info("Marked {} finished booking(s) as completed", updated);
        }
    }
}

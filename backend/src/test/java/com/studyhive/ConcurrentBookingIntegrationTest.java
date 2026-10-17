package com.studyhive;

import com.studyhive.dto.BookingDtos.CreateBookingRequest;
import com.studyhive.entity.User;
import com.studyhive.exception.ApiException;
import com.studyhive.service.BookingService;
import com.studyhive.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Fires simultaneous booking requests at the real service and MySQL database to prove that row locking plus
 * READ COMMITTED prevents double booking under contention.
 */
class ConcurrentBookingIntegrationTest extends IntegrationTest {

    @Autowired
    private BookingService bookingService;

    private sealed interface Outcome permits Success, Failure {
    }

    private record Success(String reference, boolean created) implements Outcome {
    }

    private record Failure(int status, String code) implements Outcome {
    }

    private List<Outcome> runConcurrently(List<Callable<Outcome>> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        CountDownLatch ready = new CountDownLatch(tasks.size());
        CountDownLatch go = new CountDownLatch(1);
        List<Future<Outcome>> futures = new ArrayList<>();
        for (Callable<Outcome> task : tasks) {
            futures.add(pool.submit(() -> {
                ready.countDown();
                go.await();
                return task.call();
            }));
        }
        ready.await(10, TimeUnit.SECONDS);
        go.countDown();
        List<Outcome> outcomes = new ArrayList<>();
        for (Future<Outcome> f : futures) {
            outcomes.add(f.get(60, TimeUnit.SECONDS));
        }
        pool.shutdown();
        return outcomes;
    }

    private Callable<Outcome> attempt(Long userId, Long roomId, LocalDateTime start, LocalDateTime end, String key) {
        return () -> {
            try {
                BookingService.CreationResult r = bookingService.create(userId,
                        new CreateBookingRequest(roomId, start, end, "Race", 4, null), key);
                return new Success(r.booking().bookingReference(), r.created());
            } catch (ApiException e) {
                return new Failure(e.getStatus().value(), e.getCode());
            }
        };
    }

    @Test
    void onlyOneOfManySimultaneousRequestsForTheSameSlotSucceeds() throws Exception {
        Long room = roomId("G-102");
        List<Callable<Outcome>> tasks = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            User u = student("racer" + i);
            // Different but overlapping windows: 10-12, 11-13, 10-11 ...
            LocalDateTime start = tuesdayAt(10 + (i % 2));
            tasks.add(attempt(u.getId(), room, start, start.plusHours(i % 3 == 0 ? 1 : 2), null));
        }

        List<Outcome> outcomes = runConcurrently(tasks);

        long successes = outcomes.stream().filter(o -> o instanceof Success).count();
        assertThat(outcomes.stream().filter(o -> o instanceof Failure)
                .allMatch(o -> ((Failure) o).status() == 409)).isTrue();
        Integer rows = jdbc.queryForObject("""
                SELECT COUNT(*) FROM bookings a JOIN bookings b
                  ON a.room_id = b.room_id AND a.id < b.id AND a.start_time < b.end_time AND a.end_time > b.start_time
                WHERE a.status = 'CONFIRMED' AND b.status = 'CONFIRMED'
                """, Integer.class);
        assertThat(rows).as("overlapping confirmed bookings in the database").isZero();
        assertThat(successes).isBetween(1L, 2L); // e.g. 10-11 and 11-13 can legitimately both win
    }

    @Test
    void identicalWindowRaceHasExactlyOneWinner() throws Exception {
        Long room = roomId("F-201");
        List<Callable<Outcome>> tasks = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            tasks.add(attempt(student("same" + i).getId(), room, tuesdayAt(15), tuesdayAt(17), null));
        }
        List<Outcome> outcomes = runConcurrently(tasks);
        assertThat(outcomes.stream().filter(o -> o instanceof Success).count()).isEqualTo(1);
        assertThat(outcomes.stream().filter(o -> o instanceof Failure f && f.code().equals("SLOT_TAKEN")).count()).isEqualTo(9);
    }

    @Test
    void parallelRequestsForDifferentRoomsAllSucceed() throws Exception {
        List<Callable<Outcome>> tasks = new ArrayList<>();
        for (String number : List.of("G-101", "G-102", "F-201", "F-202", "F-203")) {
            tasks.add(attempt(student("room-" + number).getId(), roomId(number), tuesdayAt(10), tuesdayAt(11), null));
        }
        List<Outcome> outcomes = runConcurrently(tasks);
        assertThat(outcomes).allMatch(o -> o instanceof Success);
    }

    @Test
    void duplicateSubmissionsWithOneIdempotencyKeyCreateOneBooking() throws Exception {
        User u = student("doubleclick");
        Long room = roomId("G-102");
        List<Callable<Outcome>> tasks = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            tasks.add(attempt(u.getId(), room, tuesdayAt(18), tuesdayAt(19), "same-key-1234"));
        }
        List<Outcome> outcomes = runConcurrently(tasks);
        assertThat(outcomes).allMatch(o -> o instanceof Success);
        Set<String> references = new HashSet<>();
        outcomes.forEach(o -> references.add(((Success) o).reference()));
        assertThat(references).hasSize(1);
        assertThat(outcomes.stream().filter(o -> ((Success) o).created()).count()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM bookings", Integer.class)).isEqualTo(1);
    }
}

package com.studyhive.repository;

import com.studyhive.entity.Booking;
import com.studyhive.entity.BookingStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long>, JpaSpecificationExecutor<Booking> {

    /** Overlap rule: existing.start < requested.end AND existing.end > requested.start. */
    @Query("""
            select count(b) from Booking b
            where b.room.id = :roomId and b.status in :statuses
              and b.startTime < :end and b.endTime > :start
            """)
    long countRoomOverlaps(@Param("roomId") Long roomId,
                           @Param("start") LocalDateTime start,
                           @Param("end") LocalDateTime end,
                           @Param("statuses") Collection<BookingStatus> statuses);

    @Query("""
            select count(b) from Booking b
            where b.user.id = :userId and b.status in :statuses
              and b.startTime < :end and b.endTime > :start
            """)
    long countUserOverlaps(@Param("userId") Long userId,
                           @Param("start") LocalDateTime start,
                           @Param("end") LocalDateTime end,
                           @Param("statuses") Collection<BookingStatus> statuses);

    @Query("""
            select count(b) from Booking b
            where b.user.id = :userId and b.status = com.studyhive.entity.BookingStatus.CONFIRMED
              and b.endTime > :now
            """)
    long countActiveForUser(@Param("userId") Long userId, @Param("now") LocalDateTime now);

    @Query("""
            select b from Booking b
            where b.room.id in :roomIds and b.status in :statuses
              and b.startTime < :end and b.endTime > :start
            """)
    List<Booking> findForRoomsInWindow(@Param("roomIds") Collection<Long> roomIds,
                                       @Param("start") LocalDateTime start,
                                       @Param("end") LocalDateTime end,
                                       @Param("statuses") Collection<BookingStatus> statuses);

    @EntityGraph(attributePaths = {"room", "user"})
    @Query("""
            select b from Booking b
            where b.status = com.studyhive.entity.BookingStatus.CONFIRMED
              and b.startTime < :end and b.endTime > :start
              and (:roomId is null or b.room.id = :roomId)
            order by b.startTime
            """)
    List<Booking> findConfirmedOverlapping(@Param("roomId") Long roomId,
                                           @Param("start") LocalDateTime start,
                                           @Param("end") LocalDateTime end);

    @EntityGraph(attributePaths = {"room", "user"})
    @Query("""
            select b from Booking b
            where b.room.id = :roomId and b.status = com.studyhive.entity.BookingStatus.CONFIRMED
              and b.startTime >= :from
            order by b.startTime
            """)
    List<Booking> findFutureConfirmedForRoom(@Param("roomId") Long roomId, @Param("from") LocalDateTime from);

    @EntityGraph(attributePaths = {"room", "user"})
    Optional<Booking> findByUserIdAndIdempotencyKey(Long userId, String idempotencyKey);

    @EntityGraph(attributePaths = {"room", "user"})
    @Query("select b from Booking b where b.id = :id")
    Optional<Booking> findDetailedById(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from Booking b where b.id = :id")
    Optional<Booking> findByIdForUpdate(@Param("id") Long id);

    boolean existsByBookingReference(String bookingReference);

    /** Rows of [roomId, count] for confirmed bookings starting after {@code now}. */
    @Query("""
            select b.room.id, count(b) from Booking b
            where b.status = com.studyhive.entity.BookingStatus.CONFIRMED and b.startTime > :now
            group by b.room.id
            """)
    List<Object[]> countUpcomingByRoom(@Param("now") LocalDateTime now);

    /** Rows of [userId, count]. */
    @Query("select b.user.id, count(b) from Booking b where b.user.id in :userIds group by b.user.id")
    List<Object[]> countByUserIds(@Param("userIds") Collection<Long> userIds);

    boolean existsByRoomId(Long roomId);

    // ---- Student dashboard -------------------------------------------------------------------

    @EntityGraph(attributePaths = {"room"})
    @Query("""
            select b from Booking b
            where b.user.id = :userId and b.status = com.studyhive.entity.BookingStatus.CONFIRMED
              and b.endTime > :now
            """)
    Page<Booking> findUpcomingForUser(@Param("userId") Long userId, @Param("now") LocalDateTime now, Pageable pageable);

    @EntityGraph(attributePaths = {"room"})
    @Query("""
            select b from Booking b
            where b.user.id = :userId
              and (b.status = com.studyhive.entity.BookingStatus.COMPLETED
                   or (b.status = com.studyhive.entity.BookingStatus.CONFIRMED and b.endTime <= :now))
            """)
    Page<Booking> findPastForUser(@Param("userId") Long userId, @Param("now") LocalDateTime now, Pageable pageable);

    @EntityGraph(attributePaths = {"room"})
    Page<Booking> findByUserIdAndStatus(Long userId, BookingStatus status, Pageable pageable);

    long countByUserIdAndStatus(Long userId, BookingStatus status);

    long countByUserId(Long userId);

    // ---- Admin -------------------------------------------------------------------------------

    @Override
    @EntityGraph(attributePaths = {"room", "user"})
    Page<Booking> findAll(Specification<Booking> spec, Pageable pageable);

    long countByStatus(BookingStatus status);

    @Query("""
            select count(b) from Booking b
            where b.status <> com.studyhive.entity.BookingStatus.CANCELLED
              and b.startTime >= :from and b.startTime < :to
            """)
    long countActiveStartingBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("""
            select count(b) from Booking b
            where b.status = com.studyhive.entity.BookingStatus.CONFIRMED and b.startTime > :now
            """)
    long countUpcoming(@Param("now") LocalDateTime now);

    @Query("""
            select b from Booking b
            where b.status in :statuses and b.startTime < :to and b.endTime > :from
            """)
    List<Booking> findInWindow(@Param("from") LocalDateTime from,
                               @Param("to") LocalDateTime to,
                               @Param("statuses") Collection<BookingStatus> statuses);

    @Modifying
    @Query("""
            update Booking b set b.status = com.studyhive.entity.BookingStatus.COMPLETED, b.updatedAt = :at
            where b.status = com.studyhive.entity.BookingStatus.CONFIRMED and b.endTime <= :now
            """)
    int markCompleted(@Param("now") LocalDateTime now, @Param("at") Instant at);
}

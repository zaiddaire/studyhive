package com.studyhive.repository;

import com.studyhive.entity.BookingEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface BookingEventRepository extends JpaRepository<BookingEvent, Long> {

    @EntityGraph(attributePaths = {"booking", "booking.room", "actor"})
    @Query("select e from BookingEvent e order by e.createdAt desc, e.id desc")
    List<BookingEvent> findRecent(Pageable pageable);

    @EntityGraph(attributePaths = {"actor"})
    List<BookingEvent> findByBookingIdOrderByCreatedAtAscIdAsc(Long bookingId);
}

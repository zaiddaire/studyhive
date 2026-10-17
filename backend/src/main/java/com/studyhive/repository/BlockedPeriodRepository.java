package com.studyhive.repository;

import com.studyhive.entity.BlockedPeriod;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface BlockedPeriodRepository extends JpaRepository<BlockedPeriod, Long> {

    /** Blocks affecting the room: room-specific blocks plus facility-wide blocks (room is null). */
    @Query("""
            select bp from BlockedPeriod bp
            where (bp.room is null or bp.room.id = :roomId)
              and bp.startTime < :end and bp.endTime > :start
            order by bp.startTime
            """)
    List<BlockedPeriod> findOverlapping(@Param("roomId") Long roomId,
                                        @Param("start") LocalDateTime start,
                                        @Param("end") LocalDateTime end);

    @EntityGraph(attributePaths = {"room"})
    @Query("""
            select bp from BlockedPeriod bp
            where bp.startTime < :end and bp.endTime > :start
            order by bp.startTime
            """)
    List<BlockedPeriod> findAllOverlapping(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @EntityGraph(attributePaths = {"room", "createdBy"})
    @Query("""
            select bp from BlockedPeriod bp
            where bp.endTime > :after and (:roomId is null or bp.room is null or bp.room.id = :roomId)
            order by bp.startTime
            """)
    List<BlockedPeriod> findCurrentAndUpcoming(@Param("after") LocalDateTime after, @Param("roomId") Long roomId);
}

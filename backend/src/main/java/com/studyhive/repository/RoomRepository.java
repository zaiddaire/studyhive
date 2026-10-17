package com.studyhive.repository;

import com.studyhive.entity.Room;
import com.studyhive.entity.RoomStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, Long> {

    List<Room> findAllByStatusOrderByNameAsc(RoomStatus status);

    List<Room> findAllByOrderByRoomNumberAsc();

    long countByStatus(RoomStatus status);

    Optional<Room> findByRoomNumberIgnoreCase(String roomNumber);

    /**
     * Row-level lock on the room (SELECT ... FOR UPDATE). Every booking transaction for a room
     * acquires this lock before checking for overlaps, which serialises concurrent bookings per room
     * while leaving other rooms unaffected.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Room r where r.id = :id")
    Optional<Room> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Room r order by r.id asc")
    List<Room> findAllForUpdate();
}

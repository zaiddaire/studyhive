package com.studyhive.repository;

import com.studyhive.entity.OperatingHours;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface OperatingHoursRepository extends JpaRepository<OperatingHours, Long> {

    List<OperatingHours> findByRoomIsNullOrderByDayOfWeekAsc();

    List<OperatingHours> findByRoomIdOrderByDayOfWeekAsc(Long roomId);

    @Query("select h from OperatingHours h where h.room is not null")
    List<OperatingHours> findAllRoomOverrides();

    @Modifying(flushAutomatically = true)
    @Query("delete from OperatingHours h where h.room.id = :roomId")
    int deleteByRoomId(@Param("roomId") Long roomId);

    @Modifying(flushAutomatically = true)
    @Query("delete from OperatingHours h where h.room is null")
    int deleteGlobal();
}

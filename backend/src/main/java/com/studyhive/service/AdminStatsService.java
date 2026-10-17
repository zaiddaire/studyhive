package com.studyhive.service;

import com.studyhive.dto.AdminDtos.ActivityItem;
import com.studyhive.dto.AdminDtos.DayCount;
import com.studyhive.dto.AdminDtos.RoomUtilization;
import com.studyhive.dto.AdminDtos.StatsResponse;
import com.studyhive.entity.Booking;
import com.studyhive.entity.BookingEvent;
import com.studyhive.entity.BookingStatus;
import com.studyhive.entity.Role;
import com.studyhive.entity.Room;
import com.studyhive.entity.RoomStatus;
import com.studyhive.repository.BookingEventRepository;
import com.studyhive.repository.BookingRepository;
import com.studyhive.repository.RoomRepository;
import com.studyhive.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Dashboard metrics, all computed from persisted data. */
@Service
public class AdminStatsService {

    static final int UTILIZATION_DAYS = 7;

    private final RoomRepository rooms;
    private final UserRepository users;
    private final BookingRepository bookings;
    private final BookingEventRepository events;
    private final ScheduleService schedule;
    private final Clock clock;

    public AdminStatsService(RoomRepository rooms, UserRepository users, BookingRepository bookings,
                             BookingEventRepository events, ScheduleService schedule, Clock clock) {
        this.rooms = rooms;
        this.users = users;
        this.bookings = bookings;
        this.events = events;
        this.schedule = schedule;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public StatsResponse stats() {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate today = now.toLocalDate();

        List<RoomUtilization> perRoom = utilization(now);
        double totalBooked = perRoom.stream().mapToDouble(RoomUtilization::bookedHours).sum();
        double totalOpen = perRoom.stream().mapToDouble(RoomUtilization::openHours).sum();
        Double overall = totalOpen > 0 ? round1(totalBooked / totalOpen * 100) : null;

        Map<LocalDate, Long> perDay = bookings.findInWindow(today.atStartOfDay(), today.plusDays(UTILIZATION_DAYS).atStartOfDay(),
                        BookingStatus.BLOCKING).stream()
                .filter(b -> !b.getStartTime().toLocalDate().isBefore(today))
                .collect(Collectors.groupingBy(b -> b.getStartTime().toLocalDate(), Collectors.counting()));
        List<DayCount> next7 = new ArrayList<>();
        for (int i = 0; i < UTILIZATION_DAYS; i++) {
            LocalDate d = today.plusDays(i);
            next7.add(new DayCount(d, perDay.getOrDefault(d, 0L)));
        }

        List<ActivityItem> recent = events.findRecent(PageRequest.of(0, 10)).stream().map(this::toActivity).toList();

        return new StatsResponse(
                rooms.count(),
                rooms.countByStatus(RoomStatus.ACTIVE),
                users.countByRole(Role.STUDENT),
                bookings.countActiveStartingBetween(today.atStartOfDay(), today.plusDays(1).atStartOfDay()),
                bookings.countUpcoming(now),
                bookings.countByStatus(BookingStatus.CANCELLED),
                bookings.countByStatus(BookingStatus.COMPLETED),
                overall,
                UTILIZATION_DAYS,
                perRoom,
                next7,
                recent);
    }

    /**
     * Utilisation over the last 7 days up to now: booked hours divided by open hours, per active room.
     * Today only counts the hours that have already elapsed.
     */
    private List<RoomUtilization> utilization(LocalDateTime now) {
        LocalDate today = now.toLocalDate();
        LocalDateTime windowStart = today.minusDays(UTILIZATION_DAYS - 1L).atStartOfDay();
        HoursResolver hours = schedule.hoursResolver();
        List<Room> active = rooms.findAllByStatusOrderByNameAsc(RoomStatus.ACTIVE);
        Map<Long, List<Booking>> byRoom = bookings.findInWindow(windowStart, now, BookingStatus.BLOCKING).stream()
                .collect(Collectors.groupingBy(b -> b.getRoom().getId()));

        List<RoomUtilization> result = new ArrayList<>();
        for (Room room : active) {
            long openMinutes = 0;
            for (int i = 0; i < UTILIZATION_DAYS; i++) {
                LocalDate d = windowStart.toLocalDate().plusDays(i);
                DayHours h = hours.forRoom(room.getId(), d);
                if (!h.closed()) {
                    openMinutes += overlapMinutes(d.atTime(h.open()), d.atTime(h.close()), windowStart, now);
                }
            }
            long bookedMinutes = byRoom.getOrDefault(room.getId(), List.of()).stream()
                    .mapToLong(b -> overlapMinutes(b.getStartTime(), b.getEndTime(), windowStart, now))
                    .sum();
            Double percent = openMinutes > 0 ? round1(Math.min(100.0, bookedMinutes * 100.0 / openMinutes)) : null;
            result.add(new RoomUtilization(room.getId(), room.getRoomNumber(), room.getName(),
                    round1(bookedMinutes / 60.0), round1(openMinutes / 60.0), percent));
        }
        return result;
    }

    static long overlapMinutes(LocalDateTime aStart, LocalDateTime aEnd, LocalDateTime bStart, LocalDateTime bEnd) {
        LocalDateTime s = aStart.isAfter(bStart) ? aStart : bStart;
        LocalDateTime e = aEnd.isBefore(bEnd) ? aEnd : bEnd;
        return e.isAfter(s) ? Duration.between(s, e).toMinutes() : 0;
    }

    private ActivityItem toActivity(BookingEvent e) {
        return new ActivityItem(e.getEventType(), e.getBooking().getId(), e.getBooking().getBookingReference(),
                e.getBooking().getRoom().getName(), e.getActor() == null ? null : e.getActor().getFullName(),
                e.getDetails(), e.getCreatedAt());
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}

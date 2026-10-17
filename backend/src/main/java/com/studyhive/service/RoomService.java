package com.studyhive.service;

import com.studyhive.config.AppProperties;
import com.studyhive.dto.PageResponse;
import com.studyhive.dto.RoomDtos.AmenityResponse;
import com.studyhive.dto.RoomDtos.AvailabilityStatus;
import com.studyhive.dto.RoomDtos.AvailabilitySummary;
import com.studyhive.dto.RoomDtos.DayAvailabilityResponse;
import com.studyhive.dto.RoomDtos.RoomDetail;
import com.studyhive.dto.RoomDtos.RoomSummary;
import com.studyhive.dto.RoomDtos.SlotResponse;
import com.studyhive.dto.RoomDtos.SlotStatus;
import com.studyhive.entity.Amenity;
import com.studyhive.entity.BlockedPeriod;
import com.studyhive.entity.Booking;
import com.studyhive.entity.BookingSettings;
import com.studyhive.entity.BookingStatus;
import com.studyhive.entity.Room;
import com.studyhive.entity.RoomStatus;
import com.studyhive.exception.ApiException;
import com.studyhive.mapper.RoomMapper;
import com.studyhive.repository.AmenityRepository;
import com.studyhive.repository.BlockedPeriodRepository;
import com.studyhive.repository.BookingRepository;
import com.studyhive.repository.RoomRepository;
import com.studyhive.service.SlotCalculator.Interval;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/** Public room discovery: search, filters, details and slot availability. */
@Service
public class RoomService {

    public enum Sort { NAME, CAPACITY, CAPACITY_DESC, ROOM_NUMBER }

    public record SearchCriteria(
            String q,
            Integer groupSize,
            Set<String> amenities,
            LocalDate date,
            LocalTime startTime,
            Integer durationMinutes,
            boolean availableOnly,
            Sort sort,
            int page,
            int size) {
    }

    private final RoomRepository rooms;
    private final AmenityRepository amenities;
    private final BookingRepository bookings;
    private final BlockedPeriodRepository blocks;
    private final ScheduleService schedule;
    private final BookingRules rules;
    private final RoomMapper mapper;
    private final AppProperties properties;
    private final Clock clock;

    public RoomService(RoomRepository rooms, AmenityRepository amenities, BookingRepository bookings,
                       BlockedPeriodRepository blocks, ScheduleService schedule, BookingRules rules,
                       RoomMapper mapper, AppProperties properties, Clock clock) {
        this.rooms = rooms;
        this.amenities = amenities;
        this.bookings = bookings;
        this.blocks = blocks;
        this.schedule = schedule;
        this.rules = rules;
        this.mapper = mapper;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<AmenityResponse> listAmenities() {
        return amenities.findAllByOrderByCategoryAscNameAsc().stream().map(mapper::toAmenity).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<RoomSummary> search(SearchCriteria c) {
        if (c.startTime() != null && c.date() == null) {
            throw ApiException.invalidField("date", "Choose a date to search by start time.");
        }
        if (c.availableOnly() && c.date() == null) {
            throw ApiException.invalidField("date", "Choose a date to filter by availability.");
        }
        BookingSettings settings = schedule.settings();
        String q = c.q() == null ? null : c.q().trim().toLowerCase(Locale.ROOT);
        Set<String> wanted = c.amenities() == null ? Set.of() : c.amenities();

        List<Room> candidates = rooms.findAllByStatusOrderByNameAsc(RoomStatus.ACTIVE).stream()
                .filter(r -> q == null || q.isEmpty()
                        || r.getName().toLowerCase(Locale.ROOT).contains(q)
                        || r.getRoomNumber().toLowerCase(Locale.ROOT).contains(q))
                .filter(r -> c.groupSize() == null
                        || (c.groupSize() >= r.getMinimumCapacity() && c.groupSize() <= r.getMaximumCapacity()))
                .filter(r -> wanted.isEmpty() || r.getAmenities().stream().map(Amenity::getCode)
                        .collect(Collectors.toSet()).containsAll(wanted))
                .toList();

        Map<Long, AvailabilitySummary> availability = c.date() == null || candidates.isEmpty()
                ? Map.of()
                : computeAvailability(candidates, c, settings);

        List<Room> filtered = candidates.stream()
                .filter(r -> !c.availableOnly()
                        || availability.get(r.getId()).status() == AvailabilityStatus.AVAILABLE)
                .sorted(comparator(c.sort()))
                .toList();

        List<RoomSummary> summaries = filtered.stream()
                .map(r -> mapper.toSummary(r, settings.isPricingEnabled(), availability.get(r.getId())))
                .toList();
        return PageResponse.ofList(summaries, c.page(), c.size());
    }

    private Map<Long, AvailabilitySummary> computeAvailability(List<Room> candidates, SearchCriteria c,
                                                              BookingSettings settings) {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime dayStart = c.date().atStartOfDay();
        LocalDateTime dayEnd = dayStart.plusDays(1);
        List<Long> ids = candidates.stream().map(Room::getId).toList();

        Map<Long, List<Interval>> bookingsByRoom = new HashMap<>();
        for (Booking b : bookings.findForRoomsInWindow(ids, dayStart, dayEnd, BookingStatus.BLOCKING)) {
            bookingsByRoom.computeIfAbsent(b.getRoom().getId(), k -> new ArrayList<>())
                    .add(new Interval(b.getStartTime(), b.getEndTime()));
        }
        List<BlockedPeriod> dayBlocks = blocks.findAllOverlapping(dayStart, dayEnd);
        HoursResolver hours = schedule.hoursResolver();

        Map<Long, AvailabilitySummary> result = new HashMap<>();
        for (Room room : candidates) {
            List<Interval> roomBookings = bookingsByRoom.getOrDefault(room.getId(), List.of());
            List<Interval> roomBlocks = dayBlocks.stream()
                    .filter(bp -> bp.getRoom() == null || bp.getRoom().getId().equals(room.getId()))
                    .map(bp -> new Interval(bp.getStartTime(), bp.getEndTime()))
                    .toList();
            DayHours dayHours = hours.forRoom(room.getId(), c.date());
            if (c.startTime() != null) {
                int duration = c.durationMinutes() != null ? c.durationMinutes() : settings.getMinDurationMinutes();
                LocalDateTime start = c.date().atTime(c.startTime());
                LocalDateTime end = start.plusMinutes(duration);
                result.put(room.getId(), exactWindow(room, dayHours, settings, start, end, now, roomBookings, roomBlocks));
            } else {
                List<SlotResponse> slots = SlotCalculator.slots(true, dayHours, settings, c.date(), now, roomBookings, roomBlocks);
                int free = (int) slots.stream().filter(s -> s.status() == SlotStatus.AVAILABLE).count();
                String message = dayHours.closed() ? "Closed on this day"
                        : free == 0 ? "Fully booked" : free + (free == 1 ? " slot" : " slots") + " free";
                result.put(room.getId(), new AvailabilitySummary(
                        free > 0 ? AvailabilityStatus.AVAILABLE : AvailabilityStatus.UNAVAILABLE, message, free, slots.size()));
            }
        }
        return result;
    }

    private AvailabilitySummary exactWindow(Room room, DayHours hours, BookingSettings settings,
                                            LocalDateTime start, LocalDateTime end, LocalDateTime now,
                                            List<Interval> roomBookings, List<Interval> roomBlocks) {
        Optional<BookingRules.RuleViolation> violation =
                rules.checkWindow(room.isActive(), hours, settings, start, end, now);
        if (violation.isPresent()) {
            return new AvailabilitySummary(AvailabilityStatus.UNAVAILABLE, violation.get().message(), null, null);
        }
        if (roomBlocks.stream().anyMatch(b -> b.overlaps(start, end))) {
            return new AvailabilitySummary(AvailabilityStatus.UNAVAILABLE, "Unavailable (maintenance or event)", null, null);
        }
        if (roomBookings.stream().anyMatch(b -> b.overlaps(start, end))) {
            return new AvailabilitySummary(AvailabilityStatus.UNAVAILABLE, "Already booked at this time", null, null);
        }
        return new AvailabilitySummary(AvailabilityStatus.AVAILABLE, "Available for your time", null, null);
    }

    private static Comparator<Room> comparator(Sort sort) {
        Comparator<Room> byName = Comparator.comparing(r -> r.getName().toLowerCase(Locale.ROOT));
        return switch (sort == null ? Sort.NAME : sort) {
            case NAME -> byName;
            case CAPACITY -> Comparator.comparingInt(Room::getMaximumCapacity).thenComparing(byName);
            case CAPACITY_DESC -> Comparator.comparingInt(Room::getMaximumCapacity).reversed().thenComparing(byName);
            case ROOM_NUMBER -> Comparator.comparing(Room::getRoomNumber);
        };
    }

    @Transactional(readOnly = true)
    public RoomDetail detail(Long id) {
        Room room = rooms.findById(id).orElseThrow(() -> ApiException.notFound("Room not found."));
        return mapper.toDetail(room, schedule.settings(), schedule.hoursResolver(), properties.zoneId());
    }

    @Transactional(readOnly = true)
    public DayAvailabilityResponse availability(Long roomId, LocalDate date) {
        Room room = rooms.findById(roomId).orElseThrow(() -> ApiException.notFound("Room not found."));
        BookingSettings settings = schedule.settings();
        LocalDateTime now = LocalDateTime.now(clock);
        DayHours hours = schedule.hoursFor(room.getId(), date);
        LocalDateTime dayStart = date.atStartOfDay();
        LocalDateTime dayEnd = dayStart.plusDays(1);

        List<Interval> roomBookings = bookings.findForRoomsInWindow(List.of(room.getId()), dayStart, dayEnd, BookingStatus.BLOCKING)
                .stream().map(b -> new Interval(b.getStartTime(), b.getEndTime())).toList();
        List<Interval> roomBlocks = blocks.findOverlapping(room.getId(), dayStart, dayEnd)
                .stream().map(b -> new Interval(b.getStartTime(), b.getEndTime())).toList();
        List<SlotResponse> slots = SlotCalculator.slots(room.isActive(), hours, settings, date, now, roomBookings, roomBlocks);

        String message;
        if (!room.isActive()) {
            message = "This room is not accepting bookings right now.";
        } else if (hours.closed()) {
            message = "The room is closed on this day.";
        } else if (date.isBefore(now.toLocalDate())) {
            message = "This date is in the past.";
        } else if (date.isAfter(now.toLocalDate().plusDays(settings.getAdvanceBookingDays()))) {
            message = "Bookings open " + settings.getAdvanceBookingDays() + " days in advance.";
        } else if (slots.stream().noneMatch(s -> s.status() == SlotStatus.AVAILABLE)) {
            message = "No free slots remain on this day.";
        } else {
            message = null;
        }
        return new DayAvailabilityResponse(room.getId(), date, room.isActive(), !hours.closed(),
                hours.closed() ? null : hours.open(), hours.closed() ? null : hours.close(), message,
                settings.getSlotDurationMinutes(), slots);
    }
}

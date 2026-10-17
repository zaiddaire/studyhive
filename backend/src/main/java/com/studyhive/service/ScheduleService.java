package com.studyhive.service;

import com.studyhive.config.AppProperties;
import com.studyhive.dto.RoomDtos.DayHoursResponse;
import com.studyhive.dto.ScheduleDtos.BookingSettingsRequest;
import com.studyhive.dto.ScheduleDtos.BookingSettingsResponse;
import com.studyhive.dto.ScheduleDtos.DayHoursRequest;
import com.studyhive.dto.ScheduleDtos.PublicConfigResponse;
import com.studyhive.dto.ScheduleDtos.RoomHoursRequest;
import com.studyhive.dto.ScheduleDtos.RoomHoursResponse;
import com.studyhive.entity.BookingSettings;
import com.studyhive.entity.OperatingHours;
import com.studyhive.entity.Room;
import com.studyhive.exception.ApiException;
import com.studyhive.mapper.RoomMapper;
import com.studyhive.repository.BookingSettingsRepository;
import com.studyhive.repository.OperatingHoursRepository;
import com.studyhive.repository.RoomRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.IntStream;

/** Booking configuration and weekly operating hours. */
@Service
public class ScheduleService {

    private static final Set<Integer> ALLOWED_SLOTS = Set.of(15, 30, 60, 90, 120);

    private final BookingSettingsRepository settingsRepository;
    private final OperatingHoursRepository hoursRepository;
    private final RoomRepository rooms;
    private final RoomMapper roomMapper;
    private final AppProperties properties;
    private final Clock clock;
    private final MailService mailService;

    public ScheduleService(BookingSettingsRepository settingsRepository, OperatingHoursRepository hoursRepository,
                           RoomRepository rooms, RoomMapper roomMapper, AppProperties properties, Clock clock,
                           MailService mailService) {
        this.settingsRepository = settingsRepository;
        this.hoursRepository = hoursRepository;
        this.rooms = rooms;
        this.roomMapper = roomMapper;
        this.properties = properties;
        this.clock = clock;
        this.mailService = mailService;
    }

    // ---- Settings ------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public BookingSettings settings() {
        return settingsRepository.findById(BookingSettings.SINGLETON_ID)
                .orElseThrow(() -> new IllegalStateException("booking_settings row is missing; check migrations"));
    }

    @Transactional(readOnly = true)
    public PublicConfigResponse publicConfig() {
        BookingSettings s = settings();
        LocalDateTime now = LocalDateTime.now(clock);
        return new PublicConfigResponse(properties.zoneId().getId(), now.toLocalDate(), now.withNano(0),
                s.getSlotDurationMinutes(), s.getMinDurationMinutes(), s.getMaxDurationMinutes(),
                s.getAdvanceBookingDays(), s.getCancellationDeadlineMinutes(), s.getMaxActiveBookingsPerUser(),
                s.isPricingEnabled(), mailService.isEnabled(), defaultHours());
    }

    @Transactional(readOnly = true)
    public BookingSettingsResponse settingsResponse() {
        return toResponse(settings());
    }

    @Transactional
    public BookingSettingsResponse updateSettings(BookingSettingsRequest req) {
        int slot = req.slotDurationMinutes();
        if (!ALLOWED_SLOTS.contains(slot)) {
            throw ApiException.invalidField("slotDurationMinutes", "Slot length must be 15, 30, 60, 90 or 120 minutes.");
        }
        if (req.minDurationMinutes() % slot != 0 || req.minDurationMinutes() < slot) {
            throw ApiException.invalidField("minDurationMinutes", "Minimum duration must be a whole number of slots.");
        }
        if (req.maxDurationMinutes() % slot != 0 || req.maxDurationMinutes() < req.minDurationMinutes()) {
            throw ApiException.invalidField("maxDurationMinutes",
                    "Maximum duration must be a whole number of slots and at least the minimum duration.");
        }
        BookingSettings s = settings();
        s.setSlotDurationMinutes(slot);
        s.setMinDurationMinutes(req.minDurationMinutes());
        s.setMaxDurationMinutes(req.maxDurationMinutes());
        s.setAdvanceBookingDays(req.advanceBookingDays());
        s.setCancellationDeadlineMinutes(req.cancellationDeadlineMinutes());
        s.setMaxActiveBookingsPerUser(req.maxActiveBookingsPerUser());
        s.setPricingEnabled(req.pricingEnabled());
        return toResponse(settingsRepository.saveAndFlush(s));
    }

    private BookingSettingsResponse toResponse(BookingSettings s) {
        return new BookingSettingsResponse(s.getSlotDurationMinutes(), s.getMinDurationMinutes(), s.getMaxDurationMinutes(),
                s.getAdvanceBookingDays(), s.getCancellationDeadlineMinutes(), s.getMaxActiveBookingsPerUser(),
                s.isPricingEnabled(), s.getUpdatedAt());
    }

    // ---- Operating hours ---------------------------------------------------------------------

    @Transactional(readOnly = true)
    public HoursResolver hoursResolver() {
        Map<Integer, DayHours> defaults = new HashMap<>();
        for (OperatingHours h : hoursRepository.findByRoomIsNullOrderByDayOfWeekAsc()) {
            defaults.put(h.getDayOfWeek(), toDayHours(h));
        }
        Map<Long, Map<Integer, DayHours>> overrides = new HashMap<>();
        for (OperatingHours h : hoursRepository.findAllRoomOverrides()) {
            overrides.computeIfAbsent(h.getRoom().getId(), k -> new HashMap<>()).put(h.getDayOfWeek(), toDayHours(h));
        }
        return new HoursResolver(defaults, overrides);
    }

    /** Effective hours for one room/day, read directly (used inside the booking transaction). */
    @Transactional(readOnly = true)
    public DayHours hoursFor(Long roomId, LocalDate date) {
        int dow = date.getDayOfWeek().getValue();
        List<OperatingHours> roomRows = hoursRepository.findByRoomIdOrderByDayOfWeekAsc(roomId);
        List<OperatingHours> source = roomRows.isEmpty() ? hoursRepository.findByRoomIsNullOrderByDayOfWeekAsc() : roomRows;
        return source.stream().filter(h -> h.getDayOfWeek() == dow).findFirst()
                .map(ScheduleService::toDayHours).orElse(DayHours.closedDay());
    }

    @Transactional(readOnly = true)
    public List<DayHoursResponse> defaultHours() {
        HoursResolver resolver = hoursResolver();
        return IntStream.rangeClosed(1, 7)
                .mapToObj(d -> roomMapper.toDayHours(d, resolver.defaults().getOrDefault(d, DayHours.closedDay())))
                .toList();
    }

    @Transactional
    public List<DayHoursResponse> updateDefaultHours(List<DayHoursRequest> days) {
        validateWeek(days);
        hoursRepository.deleteGlobal();
        for (DayHoursRequest d : days) {
            hoursRepository.save(toEntity(null, d));
        }
        hoursRepository.flush();
        return defaultHours();
    }

    @Transactional(readOnly = true)
    public RoomHoursResponse roomHours(Long roomId) {
        Room room = rooms.findById(roomId).orElseThrow(() -> ApiException.notFound("Room not found."));
        HoursResolver resolver = hoursResolver();
        return new RoomHoursResponse(!resolver.hasOverride(room.getId()), roomMapper.weeklyHours(room.getId(), resolver));
    }

    @Transactional
    public RoomHoursResponse updateRoomHours(Long roomId, RoomHoursRequest req) {
        Room room = rooms.findById(roomId).orElseThrow(() -> ApiException.notFound("Room not found."));
        hoursRepository.deleteByRoomId(room.getId());
        if (!req.useDefault()) {
            if (req.days() == null || req.days().size() != 7) {
                throw ApiException.invalidField("days", "Provide hours for all seven days.");
            }
            validateWeek(req.days());
            for (DayHoursRequest d : req.days()) {
                hoursRepository.save(toEntity(room, d));
            }
        }
        hoursRepository.flush();
        return roomHours(roomId);
    }

    @Transactional
    public void deleteRoomHours(Long roomId) {
        hoursRepository.deleteByRoomId(roomId);
    }

    private static void validateWeek(List<DayHoursRequest> days) {
        Set<Integer> seen = new HashSet<>();
        for (DayHoursRequest d : days) {
            if (!seen.add(d.dayOfWeek())) {
                throw ApiException.invalidField("days", "Each weekday may appear only once.");
            }
            if (!d.closed()) {
                if (d.openTime() == null || d.closeTime() == null) {
                    throw ApiException.invalidField("days", "Open days need both an opening and a closing time.");
                }
                if (!d.closeTime().isAfter(d.openTime())) {
                    throw ApiException.invalidField("days", "Closing time must be after opening time.");
                }
                if (d.openTime().getSecond() != 0 || d.closeTime().getSecond() != 0
                        || d.openTime().getMinute() % 15 != 0 || d.closeTime().getMinute() % 15 != 0) {
                    throw ApiException.invalidField("days", "Opening and closing times must be on a quarter hour.");
                }
            }
        }
        if (seen.size() != 7) {
            throw ApiException.invalidField("days", "Provide hours for all seven days.");
        }
    }

    private static OperatingHours toEntity(Room room, DayHoursRequest d) {
        OperatingHours h = new OperatingHours();
        h.setRoom(room);
        h.setDayOfWeek(d.dayOfWeek());
        h.setClosed(d.closed());
        h.setOpenTime(d.closed() ? null : d.openTime());
        h.setCloseTime(d.closed() ? null : d.closeTime());
        return h;
    }

    private static DayHours toDayHours(OperatingHours h) {
        if (h.isClosed() || h.getOpenTime() == null || h.getCloseTime() == null) {
            return DayHours.closedDay();
        }
        return new DayHours(false, h.getOpenTime(), h.getCloseTime());
    }
}

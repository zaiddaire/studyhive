package com.studyhive.service;

import com.studyhive.config.AppProperties;
import com.studyhive.dto.BookingDtos.BookingResponse;
import com.studyhive.dto.BookingDtos.BookingSummaryResponse;
import com.studyhive.dto.BookingDtos.CreateBookingRequest;
import com.studyhive.dto.PageResponse;
import com.studyhive.entity.Booking;
import com.studyhive.entity.BookingEvent;
import com.studyhive.entity.BookingEventType;
import com.studyhive.entity.BookingSettings;
import com.studyhive.entity.BookingStatus;
import com.studyhive.entity.Room;
import com.studyhive.entity.User;
import com.studyhive.exception.ApiException;
import com.studyhive.mapper.BookingMapper;
import com.studyhive.repository.BlockedPeriodRepository;
import com.studyhive.repository.BookingEventRepository;
import com.studyhive.repository.BookingRepository;
import com.studyhive.repository.RoomRepository;
import com.studyhive.repository.UserRepository;
import com.studyhive.security.UserPrincipal;
import jakarta.persistence.criteria.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Booking lifecycle. Creation is the critical path for double-booking prevention:
 *
 * <ol>
 *   <li>The transaction runs at READ COMMITTED so every query sees rows committed by competing transactions
 *       (under InnoDB's default REPEATABLE READ a waiting transaction could check overlaps against a stale
 *       snapshot).</li>
 *   <li>The student's user row and then the room row are locked with SELECT ... FOR UPDATE, always in that
 *       order, so concurrent requests for the same room (or by the same student) are serialised and cannot
 *       deadlock. Requests for different rooms by different students proceed in parallel.</li>
 *   <li>Only after holding both locks are blocked periods, overlapping bookings and per-student limits checked.
 *       The losing request of a race therefore sees the winner's booking and receives HTTP 409.</li>
 * </ol>
 */
@Service
public class BookingService {

    private static final Logger log = LoggerFactory.getLogger(BookingService.class);
    private static final Pattern IDEMPOTENCY_KEY = Pattern.compile("^[A-Za-z0-9_-]{8,64}$");

    public enum Scope { UPCOMING, PAST, CANCELLED }

    public enum AdminSort { START_DESC, START_ASC, CREATED_DESC }

    public record CreationResult(BookingResponse booking, boolean created) {
    }

    public record AdminSearch(String reference, Long roomId, BookingStatus status, String student,
                              LocalDate from, LocalDate to, AdminSort sort, int page, int size) {
    }

    private final BookingRepository bookings;
    private final BookingEventRepository events;
    private final RoomRepository rooms;
    private final UserRepository users;
    private final BlockedPeriodRepository blocks;
    private final ScheduleService schedule;
    private final BookingRules rules;
    private final BookingReferenceGenerator references;
    private final BookingMapper mapper;
    private final AppProperties properties;
    private final Clock clock;
    private final TransactionTemplate bookingTx;
    private final TransactionTemplate readTx;

    public BookingService(BookingRepository bookings, BookingEventRepository events, RoomRepository rooms,
                          UserRepository users, BlockedPeriodRepository blocks, ScheduleService schedule,
                          BookingRules rules, BookingReferenceGenerator references, BookingMapper mapper,
                          AppProperties properties, Clock clock, PlatformTransactionManager transactionManager) {
        this.bookings = bookings;
        this.events = events;
        this.rooms = rooms;
        this.users = users;
        this.blocks = blocks;
        this.schedule = schedule;
        this.rules = rules;
        this.references = references;
        this.mapper = mapper;
        this.properties = properties;
        this.clock = clock;
        this.bookingTx = new TransactionTemplate(transactionManager);
        this.bookingTx.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        this.bookingTx.setTimeout(15);
        this.readTx = new TransactionTemplate(transactionManager);
        this.readTx.setReadOnly(true);
    }

    // ---- Create ----------------------------------------------------------------------------------

    public CreationResult create(Long userId, CreateBookingRequest request, String idempotencyKey) {
        String key = normalizeKey(idempotencyKey);
        try {
            return bookingTx.execute(status -> doCreate(userId, request, key));
        } catch (DataIntegrityViolationException e) {
            // A concurrent duplicate submission with the same idempotency key won the insert: replay it.
            if (key != null) {
                CreationResult replay = readTx.execute(status -> bookings.findByUserIdAndIdempotencyKey(userId, key)
                        .map(b -> new CreationResult(mapper.toResponse(b, context(false)), false))
                        .orElse(null));
                if (replay != null) {
                    return replay;
                }
            }
            throw e;
        }
    }

    private CreationResult doCreate(Long userId, CreateBookingRequest req, String key) {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime start = req.startTime();
        LocalDateTime end = req.endTime();

        // Lock 1: the student (serialises the student's own concurrent requests and limit checks).
        User user = users.findByIdForUpdate(userId)
                .orElseThrow(() -> ApiException.unauthorized("UNAUTHENTICATED", "Please log in again."));
        if (!user.isActive()) {
            throw ApiException.forbidden("ACCOUNT_SUSPENDED", "Your account is suspended and cannot make bookings.");
        }

        if (key != null) {
            Optional<Booking> previous = bookings.findByUserIdAndIdempotencyKey(userId, key);
            if (previous.isPresent()) {
                Booking b = previous.get();
                if (!b.getRoom().getId().equals(req.roomId()) || !b.getStartTime().equals(start) || !b.getEndTime().equals(end)) {
                    throw ApiException.rule("IDEMPOTENCY_KEY_REUSED",
                            "This booking request was already used for a different reservation. Please start again.");
                }
                return new CreationResult(mapper.toResponse(b, context(false)), false);
            }
        }

        // Lock 2: the room (serialises all bookings for this room).
        Room room = rooms.findByIdForUpdate(req.roomId())
                .orElseThrow(() -> ApiException.notFound("Room not found."));
        BookingSettings settings = schedule.settings();
        DayHours hours = schedule.hoursFor(room.getId(), start.toLocalDate());

        rules.checkWindow(room.isActive(), hours, settings, start, end, now).ifPresent(v -> {
            throw new ApiException(v.status(), v.code(), v.message());
        });

        int groupSize = req.groupSize();
        if (groupSize < room.getMinimumCapacity() || groupSize > room.getMaximumCapacity()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "GROUP_SIZE_OUT_OF_RANGE",
                    room.getName() + " is for groups of " + room.getMinimumCapacity() + " to "
                            + room.getMaximumCapacity() + " students.", "groupSize");
        }
        if (!blocks.findOverlapping(room.getId(), start, end).isEmpty()) {
            throw ApiException.rule("ROOM_BLOCKED", "The room is unavailable at this time because of maintenance or an event.");
        }
        if (bookings.countRoomOverlaps(room.getId(), start, end, BookingStatus.BLOCKING) > 0) {
            throw ApiException.conflict("SLOT_TAKEN",
                    "Sorry - this room has just been booked for an overlapping time. Please choose another slot.");
        }
        if (bookings.countUserOverlaps(userId, start, end, Set.of(BookingStatus.CONFIRMED)) > 0) {
            throw ApiException.conflict("USER_DOUBLE_BOOKED", "You already have another booking that overlaps this time.");
        }
        if (bookings.countActiveForUser(userId, now) >= settings.getMaxActiveBookingsPerUser()) {
            throw ApiException.rule("TOO_MANY_ACTIVE_BOOKINGS", "You can hold up to " + settings.getMaxActiveBookingsPerUser()
                    + " upcoming bookings at a time. Cancel one to make another.");
        }

        Booking booking = new Booking();
        booking.setBookingReference(references.next());
        booking.setUser(user);
        booking.setRoom(room);
        booking.setGroupName(blankToNull(req.groupName()));
        booking.setGroupSize(groupSize);
        booking.setPurpose(blankToNull(req.purpose()));
        booking.setStartTime(start);
        booking.setEndTime(end);
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setIdempotencyKey(key);
        booking.setTotalPrice(price(room, settings, start, end));
        bookings.saveAndFlush(booking);
        recordEvent(booking, BookingEventType.CREATED, user, "Reserved for " + groupSize + " students");

        log.info("Booking {} created: room {} {} - {}", booking.getBookingReference(), room.getRoomNumber(), start, end);
        return new CreationResult(mapper.toResponse(booking, new BookingMapper.Context(settings, now, properties.zoneId(), false)), true);
    }

    private static BigDecimal price(Room room, BookingSettings settings, LocalDateTime start, LocalDateTime end) {
        if (!settings.isPricingEnabled() || room.getHourlyPrice() == null) {
            return null;
        }
        long minutes = Duration.between(start, end).toMinutes();
        return room.getHourlyPrice().multiply(BigDecimal.valueOf(minutes))
                .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
    }

    private static String normalizeKey(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        String trimmed = key.trim();
        if (!IDEMPOTENCY_KEY.matcher(trimmed).matches()) {
            throw ApiException.badRequest("INVALID_IDEMPOTENCY_KEY", "Invalid Idempotency-Key header.");
        }
        return trimmed;
    }

    // ---- Cancel ----------------------------------------------------------------------------------

    @Transactional
    public BookingResponse cancelAsStudent(Long userId, Long bookingId, String reason) {
        Booking booking = bookings.findByIdForUpdate(bookingId)
                .filter(b -> b.getUser().getId().equals(userId))
                .orElseThrow(() -> ApiException.notFound("Booking not found."));
        BookingMapper.Context ctx = context(false);
        if (booking.getStatus() == BookingStatus.CANCELLED) {
            return mapper.toResponse(booking, ctx); // repeated click: already done
        }
        if (booking.getStatus() != BookingStatus.CONFIRMED || !booking.getEndTime().isAfter(ctx.now())) {
            throw ApiException.rule("NOT_CANCELLABLE", "Only upcoming bookings can be cancelled.");
        }
        int deadline = ctx.settings().getCancellationDeadlineMinutes();
        if (!ctx.now().isBefore(booking.getStartTime().minusMinutes(deadline))) {
            throw ApiException.rule("CANCELLATION_DEADLINE_PASSED", deadline == 0
                    ? "This session has already started and can no longer be cancelled."
                    : "Bookings can be cancelled up to " + BookingRules.formatMinutes(deadline) + " before they start.");
        }
        User actor = users.getReferenceById(userId);
        cancel(booking, actor, reason == null || reason.isBlank() ? "Cancelled by student" : reason.trim(),
                BookingEventType.CANCELLED_BY_STUDENT);
        return mapper.toResponse(booking, ctx);
    }

    @Transactional
    public BookingResponse cancelAsAdmin(Long adminId, Long bookingId, String reason) {
        Booking booking = bookings.findByIdForUpdate(bookingId)
                .orElseThrow(() -> ApiException.notFound("Booking not found."));
        BookingMapper.Context ctx = context(true);
        if (booking.getStatus() == BookingStatus.CANCELLED) {
            return mapper.toResponse(booking, ctx, events.findByBookingIdOrderByCreatedAtAscIdAsc(booking.getId()));
        }
        if (booking.getStatus() != BookingStatus.CONFIRMED || !booking.getEndTime().isAfter(ctx.now())) {
            throw ApiException.rule("NOT_CANCELLABLE", "Only upcoming or in-progress bookings can be cancelled.");
        }
        cancel(booking, users.getReferenceById(adminId), reason.trim(), BookingEventType.CANCELLED_BY_ADMIN);
        return mapper.toResponse(booking, ctx, events.findByBookingIdOrderByCreatedAtAscIdAsc(booking.getId()));
    }

    /** Cancels inside the caller's transaction (room deactivation, maintenance blocks). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void cancel(Booking booking, User actor, String reason, BookingEventType type) {
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason(reason);
        booking.setCancelledAt(Instant.now());
        booking.setCancelledBy(actor);
        bookings.save(booking);
        recordEvent(booking, type, actor, reason);
        log.info("Booking {} cancelled ({})", booking.getBookingReference(), type);
    }

    private void recordEvent(Booking booking, BookingEventType type, User actor, String details) {
        BookingEvent event = new BookingEvent();
        event.setBooking(booking);
        event.setEventType(type);
        event.setActor(actor);
        event.setDetails(details == null ? null : details.length() > 500 ? details.substring(0, 500) : details);
        events.save(event);
    }

    // ---- Read --------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PageResponse<BookingResponse> myBookings(Long userId, Scope scope, int page, int size) {
        BookingMapper.Context ctx = context(false);
        Page<Booking> result = switch (scope) {
            case UPCOMING -> bookings.findUpcomingForUser(userId, ctx.now(),
                    PageRequest.of(page, size, Sort.by("startTime").ascending()));
            case PAST -> bookings.findPastForUser(userId, ctx.now(),
                    PageRequest.of(page, size, Sort.by("startTime").descending()));
            case CANCELLED -> bookings.findByUserIdAndStatus(userId, BookingStatus.CANCELLED,
                    PageRequest.of(page, size, Sort.by("cancelledAt").descending()));
        };
        return PageResponse.of(result, b -> mapper.toResponse(b, ctx));
    }

    @Transactional(readOnly = true)
    public BookingSummaryResponse mySummary(Long userId) {
        BookingMapper.Context ctx = context(false);
        Page<Booking> upcoming = bookings.findUpcomingForUser(userId, ctx.now(),
                PageRequest.of(0, 1, Sort.by("startTime").ascending()));
        Page<Booking> past = bookings.findPastForUser(userId, ctx.now(), PageRequest.of(0, 1));
        long cancelled = bookings.countByUserIdAndStatus(userId, BookingStatus.CANCELLED);
        BookingResponse next = upcoming.hasContent() ? mapper.toResponse(upcoming.getContent().get(0), ctx) : null;
        return new BookingSummaryResponse(upcoming.getTotalElements(), past.getTotalElements(), cancelled, next);
    }

    /** Owners see their own bookings; administrators see any. Everyone else gets 404 (no existence leak). */
    @Transactional(readOnly = true)
    public BookingResponse getForViewer(UserPrincipal viewer, Long bookingId) {
        Booking booking = bookings.findDetailedById(bookingId)
                .filter(b -> viewer.isAdmin() || b.getUser().getId().equals(viewer.getId()))
                .orElseThrow(() -> ApiException.notFound("Booking not found."));
        boolean adminView = viewer.isAdmin() && !booking.getUser().getId().equals(viewer.getId());
        return adminView
                ? mapper.toResponse(booking, context(true), events.findByBookingIdOrderByCreatedAtAscIdAsc(booking.getId()))
                : mapper.toResponse(booking, context(false));
    }

    @Transactional(readOnly = true)
    public BookingResponse getForAdmin(Long bookingId) {
        Booking booking = bookings.findDetailedById(bookingId)
                .orElseThrow(() -> ApiException.notFound("Booking not found."));
        return mapper.toResponse(booking, context(true), events.findByBookingIdOrderByCreatedAtAscIdAsc(booking.getId()));
    }

    @Transactional(readOnly = true)
    public PageResponse<BookingResponse> adminSearch(AdminSearch s) {
        Specification<Booking> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (s.reference() != null && !s.reference().isBlank()) {
                predicates.add(cb.like(cb.upper(root.get("bookingReference")),
                        "%" + escapeLike(s.reference().trim().toUpperCase(Locale.ROOT)) + "%", '\\'));
            }
            if (s.roomId() != null) {
                predicates.add(cb.equal(root.get("room").get("id"), s.roomId()));
            }
            if (s.status() != null) {
                predicates.add(cb.equal(root.get("status"), s.status()));
            }
            if (s.from() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("startTime"), s.from().atStartOfDay()));
            }
            if (s.to() != null) {
                predicates.add(cb.lessThan(root.get("startTime"), s.to().plusDays(1).atStartOfDay()));
            }
            if (s.student() != null && !s.student().isBlank()) {
                String pattern = "%" + escapeLike(s.student().trim().toLowerCase(Locale.ROOT)) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("user").get("fullName")), pattern, '\\'),
                        cb.like(cb.lower(root.get("user").get("email")), pattern, '\\')));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        Sort sort = switch (s.sort() == null ? AdminSort.START_DESC : s.sort()) {
            case START_DESC -> Sort.by("startTime").descending();
            case START_ASC -> Sort.by("startTime").ascending();
            case CREATED_DESC -> Sort.by("createdAt").descending();
        };
        BookingMapper.Context ctx = context(true);
        return PageResponse.of(bookings.findAll(spec, PageRequest.of(s.page(), s.size(), sort.and(Sort.by("id")))),
                b -> mapper.toResponse(b, ctx));
    }

    public BookingMapper.Context context(boolean adminView) {
        return new BookingMapper.Context(schedule.settings(), LocalDateTime.now(clock), properties.zoneId(), adminView);
    }

    static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

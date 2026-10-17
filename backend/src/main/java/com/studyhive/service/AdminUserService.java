package com.studyhive.service;

import com.studyhive.dto.AdminDtos.AdminUserResponse;
import com.studyhive.dto.PageResponse;
import com.studyhive.entity.AccountStatus;
import com.studyhive.entity.User;
import com.studyhive.exception.ApiException;
import com.studyhive.mapper.UserMapper;
import com.studyhive.repository.BookingRepository;
import com.studyhive.repository.UserRepository;
import com.studyhive.security.SessionRevoker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AdminUserService {

    private static final Logger log = LoggerFactory.getLogger(AdminUserService.class);

    private final UserRepository users;
    private final BookingRepository bookings;
    private final UserMapper mapper;
    private final SessionRevoker sessionRevoker;

    public AdminUserService(UserRepository users, BookingRepository bookings, UserMapper mapper, SessionRevoker sessionRevoker) {
        this.users = users;
        this.bookings = bookings;
        this.mapper = mapper;
        this.sessionRevoker = sessionRevoker;
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminUserResponse> list(String q, int page, int size) {
        String query = q == null || q.isBlank() ? null : BookingService.escapeLike(q.trim());
        Page<User> result = users.search(query, PageRequest.of(page, size, Sort.by("createdAt").descending().and(Sort.by("id"))));
        List<Long> ids = result.getContent().stream().map(User::getId).toList();
        Map<Long, Long> counts = new HashMap<>();
        if (!ids.isEmpty()) {
            for (Object[] row : bookings.countByUserIds(ids)) {
                counts.put((Long) row[0], (Long) row[1]);
            }
        }
        return PageResponse.of(result, u -> mapper.toAdmin(u, counts.getOrDefault(u.getId(), 0L)));
    }

    @Transactional
    public AdminUserResponse updateStatus(Long adminId, Long userId, AccountStatus status) {
        if (adminId.equals(userId)) {
            throw ApiException.rule("CANNOT_CHANGE_SELF", "You cannot change the status of your own account.");
        }
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound("User not found."));
        user.setAccountStatus(status);
        users.saveAndFlush(user);
        if (status == AccountStatus.SUSPENDED) {
            sessionRevoker.revokeAll(user.getEmail(), null);
        }
        log.info("User {} set to {}", user.getId(), status);
        return mapper.toAdmin(user, bookings.countByUserId(user.getId()));
    }
}

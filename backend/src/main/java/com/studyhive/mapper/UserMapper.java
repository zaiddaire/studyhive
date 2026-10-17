package com.studyhive.mapper;

import com.studyhive.dto.AdminDtos.AdminUserResponse;
import com.studyhive.dto.AuthDtos.UserResponse;
import com.studyhive.entity.User;
import org.springframework.stereotype.Component;

/** Maps users to API responses. Password hashes are never part of any response type. */
@Component
public class UserMapper {

    public UserResponse toResponse(User u) {
        return new UserResponse(u.getId(), u.getFullName(), u.getEmail(), u.getRole(), u.getAccountStatus(), u.getCreatedAt());
    }

    public AdminUserResponse toAdmin(User u, long totalBookings) {
        return new AdminUserResponse(u.getId(), u.getFullName(), u.getEmail(), u.getRole(), u.getAccountStatus(),
                u.getCreatedAt(), totalBookings);
    }
}

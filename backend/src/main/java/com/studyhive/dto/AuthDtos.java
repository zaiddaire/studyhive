package com.studyhive.dto;

import com.studyhive.entity.AccountStatus;
import com.studyhive.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class AuthDtos {

    private AuthDtos() {
    }

    /** At least 8 characters with at least one letter and one digit. Max 64 keeps us inside BCrypt's 72-byte limit. */
    public static final String PASSWORD_REGEX = "^(?=.*[A-Za-z])(?=.*\\d).{8,64}$";
    public static final String PASSWORD_MESSAGE = "Password must be 8-64 characters and include a letter and a number.";

    public record RegisterRequest(
            @NotBlank(message = "Full name is required.")
            @Size(min = 2, max = 100, message = "Full name must be 2-100 characters.")
            String fullName,
            @NotBlank(message = "Email is required.")
            @Email(message = "Enter a valid email address.")
            @Size(max = 254, message = "Email is too long.")
            String email,
            @NotBlank(message = "Password is required.")
            @Pattern(regexp = PASSWORD_REGEX, message = PASSWORD_MESSAGE)
            String password,
            @NotBlank(message = "Please confirm your password.")
            String confirmPassword) {
    }

    public record LoginRequest(
            @NotBlank(message = "Email is required.")
            @Size(max = 254)
            String email,
            @NotBlank(message = "Password is required.")
            @Size(max = 128)
            String password) {
    }

    public record UpdateProfileRequest(
            @NotBlank(message = "Full name is required.")
            @Size(min = 2, max = 100, message = "Full name must be 2-100 characters.")
            String fullName) {
    }

    public record ChangePasswordRequest(
            @NotBlank(message = "Current password is required.")
            @Size(max = 128)
            String currentPassword,
            @NotBlank(message = "New password is required.")
            @Pattern(regexp = PASSWORD_REGEX, message = PASSWORD_MESSAGE)
            String newPassword,
            @NotBlank(message = "Please confirm your new password.")
            String confirmPassword) {
    }

    public record ForgotPasswordRequest(
            @NotBlank(message = "Email is required.")
            @Email(message = "Enter a valid email address.")
            @Size(max = 254)
            String email) {
    }

    public record ResetPasswordRequest(
            @NotBlank(message = "Reset token is missing.")
            @Size(max = 128)
            String token,
            @NotBlank(message = "New password is required.")
            @Pattern(regexp = PASSWORD_REGEX, message = PASSWORD_MESSAGE)
            String newPassword,
            @NotBlank(message = "Please confirm your new password.")
            String confirmPassword) {
    }

    public record UserResponse(
            Long id,
            String fullName,
            String email,
            Role role,
            AccountStatus accountStatus,
            Instant createdAt) {
    }

    public record CsrfResponse(String headerName, String token) {
    }

    public record MessageResponse(String message) {
    }
}

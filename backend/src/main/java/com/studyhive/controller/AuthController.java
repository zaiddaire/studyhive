package com.studyhive.controller;

import com.studyhive.dto.AuthDtos.ChangePasswordRequest;
import com.studyhive.dto.AuthDtos.CsrfResponse;
import com.studyhive.dto.AuthDtos.ForgotPasswordRequest;
import com.studyhive.dto.AuthDtos.LoginRequest;
import com.studyhive.dto.AuthDtos.MessageResponse;
import com.studyhive.dto.AuthDtos.RegisterRequest;
import com.studyhive.dto.AuthDtos.ResetPasswordRequest;
import com.studyhive.dto.AuthDtos.UpdateProfileRequest;
import com.studyhive.dto.AuthDtos.UserResponse;
import com.studyhive.security.UserPrincipal;
import com.studyhive.service.AuthService;
import com.studyhive.service.PasswordResetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Authentication")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    public AuthController(AuthService authService, PasswordResetService passwordResetService) {
        this.authService = authService;
        this.passwordResetService = passwordResetService;
    }

    @Operation(summary = "Get the CSRF token to send in the X-XSRF-TOKEN header of state-changing requests")
    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getHeaderName(), token.getToken());
    }

    @Operation(summary = "Create a student account and sign in")
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(@Valid @RequestBody RegisterRequest body, HttpServletRequest request, HttpServletResponse response) {
        return authService.register(body, request, response);
    }

    @Operation(summary = "Sign in with email and password")
    @PostMapping("/login")
    public UserResponse login(@Valid @RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        return authService.login(body, request, response);
    }

    @Operation(summary = "The signed-in user")
    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal UserPrincipal principal) {
        return authService.me(principal.getId());
    }

    @Operation(summary = "Update profile details")
    @PutMapping("/me")
    public UserResponse updateProfile(@AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody UpdateProfileRequest body) {
        return authService.updateProfile(principal.getId(), body);
    }

    @Operation(summary = "Change password (signs out other sessions)")
    @PostMapping("/password/change")
    public MessageResponse changePassword(@AuthenticationPrincipal UserPrincipal principal,
                                          @Valid @RequestBody ChangePasswordRequest body, HttpServletRequest request) {
        authService.changePassword(principal.getId(), body, request);
        return new MessageResponse("Your password has been updated.");
    }

    @Operation(summary = "Request a password reset email")
    @PostMapping("/password/forgot")
    public ResponseEntity<MessageResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest body, HttpServletRequest request) {
        boolean delivered = passwordResetService.requestReset(body.email(), request.getRemoteAddr());
        if (!delivered) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(new MessageResponse(
                    "Password reset by email is not available on this deployment. Please contact an administrator."));
        }
        return ResponseEntity.accepted().body(new MessageResponse(
                "If an account exists for that email, a reset link is on its way. It expires in 30 minutes."));
    }

    @Operation(summary = "Set a new password using a reset token")
    @PostMapping("/password/reset")
    public MessageResponse resetPassword(@Valid @RequestBody ResetPasswordRequest body) {
        passwordResetService.resetPassword(body);
        return new MessageResponse("Your password has been reset. You can now log in.");
    }
}

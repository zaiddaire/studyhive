package com.studyhive.service;

import com.studyhive.config.AppProperties;
import com.studyhive.dto.AuthDtos.ResetPasswordRequest;
import com.studyhive.entity.PasswordResetToken;
import com.studyhive.entity.User;
import com.studyhive.exception.ApiException;
import com.studyhive.repository.PasswordResetTokenRepository;
import com.studyhive.repository.UserRepository;
import com.studyhive.security.RateLimiter;
import com.studyhive.security.SessionRevoker;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Email-based password reset. Tokens are 256-bit random values; only their SHA-256 hash is stored. They expire
 * after 30 minutes, are single-use, and using one ends every session of that account. Responses never reveal
 * whether an email is registered.
 */
@Service
public class PasswordResetService {

    static final Duration TOKEN_LIFETIME = Duration.ofMinutes(30);

    private final UserRepository users;
    private final PasswordResetTokenRepository tokens;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;
    private final RateLimiter rateLimiter;
    private final SessionRevoker sessionRevoker;
    private final AppProperties properties;
    private final SecureRandom random = new SecureRandom();

    public PasswordResetService(UserRepository users, PasswordResetTokenRepository tokens, PasswordEncoder passwordEncoder,
                                MailService mailService, RateLimiter rateLimiter, SessionRevoker sessionRevoker,
                                AppProperties properties) {
        this.users = users;
        this.tokens = tokens;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
        this.rateLimiter = rateLimiter;
        this.sessionRevoker = sessionRevoker;
        this.properties = properties;
    }

    /** Returns whether email delivery is available; the caller always answers with the same generic message. */
    @Transactional
    public boolean requestReset(String rawEmail, String clientIp) {
        if (!rateLimiter.tryAcquire("forgot:" + clientIp, 5, Duration.ofMinutes(15))) {
            throw ApiException.tooManyRequests("Too many reset requests. Please try again in a few minutes.");
        }
        if (!mailService.isEnabled()) {
            return false;
        }
        String email = AuthService.normalizeEmail(rawEmail);
        Optional<User> user = users.findByEmail(email).filter(User::isActive);
        if (user.isEmpty() || !rateLimiter.tryAcquire("forgot-account:" + email, 3, Duration.ofHours(1))) {
            return true;
        }
        Instant now = Instant.now();
        tokens.invalidateAllForUser(user.get().getId(), now);
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        PasswordResetToken entity = new PasswordResetToken();
        entity.setUser(user.get());
        entity.setTokenHash(sha256(token));
        entity.setExpiresAt(now.plus(TOKEN_LIFETIME));
        tokens.save(entity);

        String link = properties.publicBaseUrl().replaceAll("/+$", "") + "/reset-password?token=" + token;
        mailService.send(email, "Reset your StudyHive password",
                "Hello " + user.get().getFullName() + ",\n\n"
                        + "We received a request to reset your StudyHive password. Use the link below within 30 minutes:\n\n"
                        + link + "\n\n"
                        + "If you did not ask for this, you can ignore this email - your password will not change.\n");
        return true;
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest req) {
        if (!req.newPassword().equals(req.confirmPassword())) {
            throw ApiException.invalidField("confirmPassword", "Passwords do not match.");
        }
        AuthService.checkBcryptLength(req.newPassword(), "newPassword");
        PasswordResetToken token = tokens.findByTokenHash(sha256(req.token()))
                .filter(t -> t.getUsedAt() == null && t.getExpiresAt().isAfter(Instant.now()))
                .orElseThrow(() -> ApiException.badRequest("INVALID_RESET_TOKEN",
                        "This reset link is invalid or has expired. Please request a new one."));
        User user = token.getUser();
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        token.setUsedAt(Instant.now());
        users.save(user);
        tokens.invalidateAllForUser(user.getId(), Instant.now());
        sessionRevoker.revokeAll(user.getEmail(), null);
    }

    static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}

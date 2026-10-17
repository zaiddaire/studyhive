package com.studyhive.service;

import com.studyhive.config.AppProperties;
import com.studyhive.dto.AuthDtos.ChangePasswordRequest;
import com.studyhive.dto.AuthDtos.LoginRequest;
import com.studyhive.dto.AuthDtos.RegisterRequest;
import com.studyhive.dto.AuthDtos.UpdateProfileRequest;
import com.studyhive.dto.AuthDtos.UserResponse;
import com.studyhive.entity.AccountStatus;
import com.studyhive.entity.Role;
import com.studyhive.entity.User;
import com.studyhive.exception.ApiException;
import com.studyhive.mapper.UserMapper;
import com.studyhive.repository.UserRepository;
import com.studyhive.security.RateLimiter;
import com.studyhive.security.SessionRevoker;
import com.studyhive.security.UserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final String INVALID_CREDENTIALS = "Invalid email or password.";

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;
    private final CsrfAuthenticationStrategy csrfAuthenticationStrategy;
    private final RateLimiter rateLimiter;
    private final SessionRevoker sessionRevoker;
    private final UserMapper mapper;
    private final AppProperties properties;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder, AuthenticationManager authenticationManager,
                       SecurityContextRepository securityContextRepository, CsrfAuthenticationStrategy csrfAuthenticationStrategy,
                       RateLimiter rateLimiter, SessionRevoker sessionRevoker, UserMapper mapper, AppProperties properties) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.securityContextRepository = securityContextRepository;
        this.csrfAuthenticationStrategy = csrfAuthenticationStrategy;
        this.rateLimiter = rateLimiter;
        this.sessionRevoker = sessionRevoker;
        this.mapper = mapper;
        this.properties = properties;
    }

    public static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public UserResponse register(RegisterRequest req, HttpServletRequest request, HttpServletResponse response) {
        if (!rateLimiter.tryAcquire("register:" + request.getRemoteAddr(), 10, Duration.ofHours(1))) {
            throw ApiException.tooManyRequests("Too many sign-up attempts from this network. Please try again later.");
        }
        if (!req.password().equals(req.confirmPassword())) {
            throw ApiException.invalidField("confirmPassword", "Passwords do not match.");
        }
        checkBcryptLength(req.password(), "password");
        String email = normalizeEmail(req.email());
        if (users.existsByEmail(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "An account with this email already exists.", "email");
        }
        User user = new User();
        user.setFullName(req.fullName().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole(Role.STUDENT); // public registration can never create administrators
        user.setAccountStatus(AccountStatus.ACTIVE);
        try {
            users.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "An account with this email already exists.", "email");
        }
        UserPrincipal principal = new UserPrincipal(user.getId(), user.getEmail(), user.getRole(), null);
        establishSession(UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities()),
                request, response);
        log.info("New student account registered (id {})", user.getId());
        return mapper.toResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse login(LoginRequest req, HttpServletRequest request, HttpServletResponse response) {
        String email = normalizeEmail(req.email());
        String ip = request.getRemoteAddr();
        String accountKey = "login:" + email + "|" + ip;
        String ipKey = "login-ip:" + ip;
        int max = properties.security().maxLoginAttempts();
        Duration lockout = Duration.ofMinutes(properties.security().lockoutMinutes());
        if (rateLimiter.isBlocked(accountKey, max, lockout) || rateLimiter.isBlocked(ipKey, max * 6, lockout)) {
            throw ApiException.tooManyRequests("Too many sign-in attempts. Please wait "
                    + properties.security().lockoutMinutes() + " minutes and try again.");
        }
        Authentication auth;
        try {
            auth = authenticationManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(email, req.password()));
        } catch (AuthenticationException e) {
            rateLimiter.tryAcquire(accountKey, max, lockout);
            rateLimiter.tryAcquire(ipKey, max * 6, lockout);
            throw ApiException.unauthorized("INVALID_CREDENTIALS", INVALID_CREDENTIALS);
        }
        UserPrincipal principal = (UserPrincipal) auth.getPrincipal();
        User user = users.findById(principal.getId())
                .orElseThrow(() -> ApiException.unauthorized("INVALID_CREDENTIALS", INVALID_CREDENTIALS));
        if (!user.isActive()) {
            // Only reachable with the correct password, so this does not help account enumeration.
            throw ApiException.forbidden("ACCOUNT_SUSPENDED", "This account has been suspended. Please contact an administrator.");
        }
        rateLimiter.reset(accountKey);
        establishSession(auth, request, response);
        return mapper.toResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse me(Long userId) {
        return users.findById(userId).map(mapper::toResponse)
                .orElseThrow(() -> ApiException.unauthorized("UNAUTHENTICATED", "Please log in to continue."));
    }

    @Transactional
    public UserResponse updateProfile(Long userId, UpdateProfileRequest req) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound("User not found."));
        user.setFullName(req.fullName().trim());
        return mapper.toResponse(users.saveAndFlush(user));
    }

    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest req, HttpServletRequest request) {
        if (!rateLimiter.tryAcquire("change-password:" + userId, 10, Duration.ofHours(1))) {
            throw ApiException.tooManyRequests("Too many attempts. Please try again later.");
        }
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound("User not found."));
        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw ApiException.invalidField("currentPassword", "Current password is incorrect.");
        }
        if (!req.newPassword().equals(req.confirmPassword())) {
            throw ApiException.invalidField("confirmPassword", "Passwords do not match.");
        }
        checkBcryptLength(req.newPassword(), "newPassword");
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        users.saveAndFlush(user);
        HttpSession session = request.getSession(false);
        sessionRevoker.revokeAll(user.getEmail(), session == null ? null : session.getId());
    }

    /** Starts a fresh authenticated session: new session id (anti-fixation), stored context, rotated CSRF token. */
    private void establishSession(Authentication auth, HttpServletRequest request, HttpServletResponse response) {
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
        csrfAuthenticationStrategy.onAuthentication(auth, request, response);
    }

    static void checkBcryptLength(String password, String field) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw ApiException.invalidField(field, "Password is too long.");
        }
    }
}

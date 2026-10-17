package com.studyhive.security;

import com.studyhive.entity.AccountStatus;
import com.studyhive.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Sessions can outlive account changes. On every authenticated API request this filter confirms the account
 * still exists and is active; otherwise the session is invalidated and the request is rejected with 401.
 */
public class AccountStatusFilter extends OncePerRequestFilter {

    private final UserRepository users;
    private final JsonErrorWriter errorWriter;

    public AccountStatusFilter(UserRepository users, JsonErrorWriter errorWriter) {
        this.users = users;
        this.errorWriter = errorWriter;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal) {
            boolean active = users.findById(principal.getId())
                    .map(u -> u.getAccountStatus() == AccountStatus.ACTIVE && u.getRole() == principal.getRole())
                    .orElse(false);
            if (!active) {
                SecurityContextHolder.clearContext();
                HttpSession session = request.getSession(false);
                if (session != null) {
                    session.invalidate();
                }
                errorWriter.write(request, response, 401, "SESSION_REVOKED",
                        "Your session has ended. Please log in again.");
                return;
            }
        }
        chain.doFilter(request, response);
    }
}

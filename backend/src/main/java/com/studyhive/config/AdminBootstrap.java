package com.studyhive.config;

import com.studyhive.entity.AccountStatus;
import com.studyhive.entity.Role;
import com.studyhive.entity.User;
import com.studyhive.repository.UserRepository;
import com.studyhive.service.AuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates the first administrator from ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD when both are set.
 * It never modifies an existing account (so a pre-registered student with that email is not silently promoted)
 * and refuses weak passwords. Remove ADMIN_BOOTSTRAP_PASSWORD from the environment after the first start.
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);
    static final int MIN_PASSWORD_LENGTH = 12;

    private final AppProperties properties;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public AdminBootstrap(AppProperties properties, UserRepository users, PasswordEncoder passwordEncoder) {
        this.properties = properties;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        AppProperties.AdminBootstrap cfg = properties.adminBootstrap();
        if (cfg == null || isBlank(cfg.email()) || isBlank(cfg.password())) {
            return;
        }
        String email = AuthService.normalizeEmail(cfg.email());
        if (users.findByEmail(email).isPresent()) {
            log.info("Admin bootstrap skipped: an account with the configured email already exists. "
                    + "You can now remove ADMIN_BOOTSTRAP_PASSWORD from the environment.");
            return;
        }
        String password = cfg.password();
        if (password.length() < MIN_PASSWORD_LENGTH || password.length() > 64
                || !password.matches(".*[A-Za-z].*") || !password.matches(".*\\d.*")) {
            log.error("Admin bootstrap refused: ADMIN_BOOTSTRAP_PASSWORD must be 12-64 characters with letters and digits.");
            return;
        }
        User admin = new User();
        admin.setEmail(email);
        admin.setFullName(isBlank(cfg.fullName()) ? "StudyHive Administrator" : cfg.fullName().trim());
        admin.setPasswordHash(passwordEncoder.encode(password));
        admin.setRole(Role.ADMIN);
        admin.setAccountStatus(AccountStatus.ACTIVE);
        users.save(admin);
        log.info("Bootstrap administrator account created. Remove ADMIN_BOOTSTRAP_PASSWORD from the environment.");
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}

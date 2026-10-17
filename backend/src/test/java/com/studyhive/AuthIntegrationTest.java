package com.studyhive;

import com.fasterxml.jackson.databind.JsonNode;
import com.studyhive.entity.AccountStatus;
import com.studyhive.entity.Role;
import com.studyhive.entity.User;
import com.studyhive.support.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthIntegrationTest extends IntegrationTest {

    private MvcResult register(String email, String password, String confirm) throws Exception {
        return mvc.perform(post("/api/auth/register").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("fullName", "Asha Learner", "email", email,
                                "password", password, "confirmPassword", confirm))))
                .andReturn();
    }

    @Test
    void registerCreatesStudentWithHashedPasswordAndStartsSession() throws Exception {
        MvcResult result = register("New.Student@Example.test", "Password123", "Password123");

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        JsonNode body = body(result);
        assertThat(body.get("email").asText()).isEqualTo("new.student@example.test");
        assertThat(body.get("role").asText()).isEqualTo("STUDENT");
        assertThat(body.has("password")).isFalse();
        assertThat(body.has("passwordHash")).isFalse();

        User saved = users.findByEmail("new.student@example.test").orElseThrow();
        assertThat(saved.getPasswordHash()).startsWith("{bcrypt}$2").doesNotContain("Password123");
        assertThat(passwordEncoder.matches("Password123", saved.getPasswordHash())).isTrue();

        Cookie session = result.getResponse().getCookie("STUDYHIVE_SESSION");
        assertThat(session).isNotNull();
        assertThat(session.isHttpOnly()).isTrue();
        mvc.perform(get("/api/auth/me").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("new.student@example.test"));
    }

    @Test
    void registrationCannotCreateAdministrators() throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("fullName", "Sneaky", "email", "sneaky@example.test",
                                "password", "Password123", "confirmPassword", "Password123", "role", "ADMIN"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("STUDENT"));
    }

    @Test
    void registrationValidatesInput() throws Exception {
        MvcResult weak = register("weak@example.test", "short", "short");
        assertThat(weak.getResponse().getStatus()).isEqualTo(400);
        assertThat(body(weak).get("fieldErrors").toString()).contains("password");

        MvcResult mismatch = register("mismatch@example.test", "Password123", "Password124");
        assertThat(mismatch.getResponse().getStatus()).isEqualTo(400);
        assertThat(body(mismatch).get("fieldErrors").get(0).get("field").asText()).isEqualTo("confirmPassword");

        register("dup@example.test", "Password123", "Password123");
        MvcResult duplicate = register("DUP@example.test", "Password123", "Password123");
        assertThat(duplicate.getResponse().getStatus()).isEqualTo(409);
        assertThat(body(duplicate).get("code").asText()).isEqualTo("EMAIL_TAKEN");
    }

    @Test
    void loginUsesGenericErrorsAndSessionCookie() throws Exception {
        createUser("login@example.test", Role.STUDENT);

        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", "login@example.test", "password", "WrongPass1"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password."));
        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", "nobody@example.test", "password", "WrongPass1"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password."));

        MvcResult ok = mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", "LOGIN@example.test", "password", PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(cookie().httpOnly("STUDYHIVE_SESSION", true))
                .andReturn();
        Cookie session = ok.getResponse().getCookie("STUDYHIVE_SESSION");
        mvc.perform(get("/api/auth/me").cookie(session)).andExpect(status().isOk());

        mvc.perform(post("/api/auth/logout").with(csrf()).cookie(session)).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").cookie(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void repeatedFailuresAreThrottled() throws Exception {
        createUser("target@example.test", Role.STUDENT);
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                            .content(toJson(Map.of("email", "target@example.test", "password", "WrongPass" + i))))
                    .andExpect(status().isUnauthorized());
        }
        // Even the correct password is refused while locked out.
        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", "target@example.test", "password", PASSWORD))))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void suspendedAccountsCannotLogIn() throws Exception {
        User u = createUser("suspended@example.test", Role.STUDENT);
        u.setAccountStatus(AccountStatus.SUSPENDED);
        users.saveAndFlush(u);
        mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", "suspended@example.test", "password", PASSWORD))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SUSPENDED"));
    }

    @Test
    void stateChangingRequestsRequireCsrfToken() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", "x@example.test", "password", "Password123"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test
    void privateEndpointsRequireAuthentication() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mvc.perform(get("/api/bookings/my")).andExpect(status().isUnauthorized());
    }

    @Test
    void changePasswordRequiresCurrentPassword() throws Exception {
        User u = createUser("change@example.test", Role.STUDENT);
        mvc.perform(post("/api/auth/password/change").with(as(u)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("currentPassword", "nope12345", "newPassword", "NewPassword9",
                                "confirmPassword", "NewPassword9"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("currentPassword"));
        mvc.perform(post("/api/auth/password/change").with(as(u)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("currentPassword", PASSWORD, "newPassword", "NewPassword9",
                                "confirmPassword", "NewPassword9"))))
                .andExpect(status().isOk());
        assertThat(passwordEncoder.matches("NewPassword9", users.findById(u.getId()).orElseThrow().getPasswordHash())).isTrue();
    }

    @Test
    void forgotPasswordReportsWhenEmailIsNotConfigured() throws Exception {
        mvc.perform(post("/api/auth/password/forgot").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", "anyone@example.test"))))
                .andExpect(status().isServiceUnavailable());
    }
}

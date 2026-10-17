package com.studyhive;

import com.fasterxml.jackson.databind.JsonNode;
import com.studyhive.entity.Role;
import com.studyhive.support.IntegrationTest;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Exercises the exact sequence the React app performs, without Spring Security test helpers (the csrf()
 * helper replaces the CSRF repository of a shared context, so this class gets its own context).
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_CLASS)
class BrowserFlowIntegrationTest extends IntegrationTest {

    private static Cookie lastCookie(MvcResult result, String name) {
        Cookie found = null;
        for (Cookie c : result.getResponse().getCookies()) {
            if (c.getName().equals(name)) {
                found = c;
            }
        }
        return found;
    }

    @Test
    void csrfCookiePlusHeaderThenSessionCookieAllowsBooking() throws Exception {
        createUser("browser@example.test", Role.STUDENT);

        // 1. The SPA fetches a CSRF token; it arrives both in the body and as the XSRF-TOKEN cookie.
        MvcResult csrfResult = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        String token = body(csrfResult).get("token").asText();
        Cookie csrfCookie = csrfResult.getResponse().getCookie("XSRF-TOKEN");
        assertThat(csrfCookie).isNotNull();
        assertThat(csrfCookie.getValue()).isEqualTo(token);
        assertThat(csrfCookie.isHttpOnly()).isFalse(); // readable by the SPA (double-submit)

        // 2. A forged request with a cookie but the wrong header is refused.
        mvc.perform(post("/api/auth/login").cookie(csrfCookie).header("X-XSRF-TOKEN", "forged")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", "browser@example.test", "password", PASSWORD))))
                .andExpect(status().isForbidden());

        // 3. Login with cookie + matching header. The session cookie is HTTP-only; the CSRF token is rotated.
        MvcResult login = mvc.perform(post("/api/auth/login").cookie(csrfCookie).header("X-XSRF-TOKEN", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", "browser@example.test", "password", PASSWORD))))
                .andExpect(status().isOk()).andReturn();
        Cookie session = login.getResponse().getCookie("STUDYHIVE_SESSION");
        assertThat(session).isNotNull();
        assertThat(session.isHttpOnly()).isTrue();
        Cookie rotated = lastCookie(login, "XSRF-TOKEN"); // browsers apply Set-Cookie headers in order
        assertThat(rotated).isNotNull();
        assertThat(rotated.getValue()).isNotBlank().isNotEqualTo(token);

        // 4. Fetch the fresh token and book a room using only cookies + header.
        MvcResult fresh = mvc.perform(get("/api/auth/csrf").cookie(session, rotated)).andReturn();
        String freshToken = body(fresh).get("token").asText();
        assertThat(freshToken).isEqualTo(rotated.getValue());
        MvcResult booking = mvc.perform(post("/api/bookings").cookie(session, rotated).header("X-XSRF-TOKEN", freshToken)
                        .header("Idempotency-Key", "browser-flow-0001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(bookingBody(roomId("G-102"), tuesdayAt(10), tuesdayAt(11), 5))))
                .andExpect(status().isCreated()).andReturn();
        JsonNode created = body(booking);
        assertThat(created.get("status").asText()).isEqualTo("CONFIRMED");

        // 5. Without the header (what a cross-site form post would look like) the session alone is not enough.
        mvc.perform(post("/api/bookings").cookie(session, rotated)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(bookingBody(roomId("G-102"), tuesdayAt(12), tuesdayAt(13), 5))))
                .andExpect(status().isForbidden());
    }
}

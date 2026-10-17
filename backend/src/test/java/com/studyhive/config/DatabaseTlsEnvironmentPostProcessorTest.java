package com.studyhive.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DatabaseTlsEnvironmentPostProcessorTest {

    private final DatabaseTlsEnvironmentPostProcessor processor = new DatabaseTlsEnvironmentPostProcessor();

    @Test
    void doesNothingWithoutCertificate() {
        MockEnvironment env = new MockEnvironment();
        processor.postProcessEnvironment(env, null);
        assertThat(env.containsProperty("DB_TRUSTSTORE_URL")).isFalse();
    }

    @Test
    void refusesInvalidCertificateInsteadOfDisablingVerification() {
        MockEnvironment env = new MockEnvironment().withProperty("DB_SSL_CA_PEM",
                "-----BEGIN CERTIFICATE-----\nnot-a-cert\n-----END CERTIFICATE-----");
        assertThatThrownBy(() -> processor.postProcessEnvironment(env, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DB_SSL_CA_PEM");
    }
}

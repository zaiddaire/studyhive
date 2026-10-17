package com.studyhive.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.util.Base64;
import java.util.Collection;
import java.util.HexFormat;
import java.util.Map;

/**
 * Aiven MySQL presents a certificate signed by a project-specific CA. Hosting platforms such as Railway
 * only accept secrets as environment variables, so this post-processor turns the CA certificate supplied in
 * {@code DB_SSL_CA_PEM} (PEM text, or base64 of the PEM) into a temporary PKCS12 trust store and exposes it to
 * the JDBC URL as {@code DB_TRUSTSTORE_URL}. Certificate validation stays fully enabled.
 */
public class DatabaseTlsEnvironmentPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String pem = environment.getProperty("DB_SSL_CA_PEM");
        if (pem == null || pem.isBlank() || environment.containsProperty("DB_TRUSTSTORE_URL")) {
            return;
        }
        try {
            String text = pem.contains("BEGIN CERTIFICATE")
                    ? pem.replace("\n", "\n")
                    : new String(Base64.getMimeDecoder().decode(pem), StandardCharsets.US_ASCII);
            Collection<? extends Certificate> certs = CertificateFactory.getInstance("X.509")
                    .generateCertificates(new ByteArrayInputStream(text.getBytes(StandardCharsets.US_ASCII)));
            if (certs.isEmpty()) {
                throw new IllegalStateException("DB_SSL_CA_PEM does not contain a certificate");
            }
            byte[] random = new byte[18];
            new SecureRandom().nextBytes(random);
            String password = HexFormat.of().formatHex(random);
            KeyStore store = KeyStore.getInstance("PKCS12");
            store.load(null, null);
            int i = 0;
            for (Certificate cert : certs) {
                store.setCertificateEntry("db-ca-" + i++, cert);
            }
            Path file = Files.createTempFile("studyhive-db-ca", ".p12");
            file.toFile().deleteOnExit();
            try (OutputStream out = Files.newOutputStream(file)) {
                store.store(out, password.toCharArray());
            }
            environment.getPropertySources().addFirst(new MapPropertySource("studyhiveDbTls", Map.of(
                    "DB_TRUSTSTORE_URL", file.toUri().toString(),
                    "DB_TRUSTSTORE_PASSWORD", password)));
        } catch (Exception e) {
            throw new IllegalStateException("Could not load the database CA certificate from DB_SSL_CA_PEM", e);
        }
    }
}

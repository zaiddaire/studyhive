package com.studyhive.service;

import com.studyhive.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Optional outbound email. Enabled only when MAIL_ENABLED=true and SMTP settings are provided; otherwise
 * features that depend on email (password reset) report that delivery is unavailable instead of pretending.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final ObjectProvider<JavaMailSender> senderProvider;
    private final AppProperties properties;

    public MailService(ObjectProvider<JavaMailSender> senderProvider, AppProperties properties) {
        this.senderProvider = senderProvider;
        this.properties = properties;
    }

    public boolean isEnabled() {
        return properties.mail() != null && properties.mail().enabled()
                && properties.mail().from() != null && !properties.mail().from().isBlank()
                && senderProvider.getIfAvailable() != null;
    }

    /** Sends a plain-text email. Returns false (and logs) on failure; never throws to the caller. */
    public boolean send(String to, String subject, String body) {
        if (!isEnabled()) {
            return false;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(properties.mail().from());
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            senderProvider.getObject().send(message);
            return true;
        } catch (MailException e) {
            log.warn("Email delivery failed: {}", e.getMessage());
            return false;
        }
    }
}

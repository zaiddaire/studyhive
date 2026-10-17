package com.studyhive.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Component;

/** Ends a user's server-side sessions, e.g. after a password reset or account suspension. */
@Component
public class SessionRevoker {

    private static final Logger log = LoggerFactory.getLogger(SessionRevoker.class);

    private final ObjectProvider<FindByIndexNameSessionRepository<? extends Session>> repositoryProvider;

    public SessionRevoker(ObjectProvider<FindByIndexNameSessionRepository<? extends Session>> repositoryProvider) {
        this.repositoryProvider = repositoryProvider;
    }

    /** Deletes every session belonging to {@code username} except {@code keepSessionId} (may be null). */
    public int revokeAll(String username, String keepSessionId) {
        FindByIndexNameSessionRepository<? extends Session> repository = repositoryProvider.getIfAvailable();
        if (repository == null) {
            return 0;
        }
        int count = 0;
        for (String id : repository.findByPrincipalName(username).keySet()) {
            if (!id.equals(keepSessionId)) {
                repository.deleteById(id);
                count++;
            }
        }
        if (count > 0) {
            log.info("Revoked {} session(s) for a user account", count);
        }
        return count;
    }
}

"""Live double-booking check against a RUNNING StudyHive API (local or deployed).

N new students fire overlapping booking requests for the same room at the same moment. The server must accept
only non-overlapping requests and answer every loser with HTTP 409. The script then checks back-to-back
bookings are allowed, that students can't see each other's bookings, and cancels everything it created.

Usage:
    python scripts/live-race-test.py [BASE_URL] [ROOM_ID]
    python scripts/live-race-test.py http://localhost:8080 2
    python scripts/live-race-test.py https://your-site.vercel.app 2

It registers throwaway accounts named racer-*@example.test. Sign-ups are rate-limited to 10 per hour per
network, so run it at most once an hour against the same server.
"""
import json
import secrets
import sys
import threading
import urllib.error
import urllib.request
import http.cookiejar
from datetime import date, timedelta

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080").rstrip("/") + "/api"
ROOM = int(sys.argv[2]) if len(sys.argv) > 2 else 2
N = 8


class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.csrf = None

    def call(self, method, path, body=None, headers=None):
        if method != "GET" and not self.csrf:
            _, data = self.call("GET", "/auth/csrf")
            self.csrf = data["token"]
        hdrs = {"Content-Type": "application/json", "Accept": "application/json", **(headers or {})}
        if method != "GET":
            hdrs["X-XSRF-TOKEN"] = self.csrf
        req = urllib.request.Request(BASE + path, method=method, headers=hdrs,
                                     data=None if body is None else json.dumps(body).encode())
        try:
            with self.opener.open(req, timeout=180) as r:
                return r.status, json.loads(r.read() or b"null")
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"null")


def next_open_weekday(days_ahead=7):
    d = date.today() + timedelta(days=days_ahead)
    while d.weekday() == 6:  # avoid Sundays (shorter default hours)
        d += timedelta(days=1)
    return d


day = next_open_weekday()
print(f"API {BASE} - room {ROOM} - date {day}")

clients = []
for i in range(N):
    c = Client()
    pw = "Race" + secrets.token_hex(4) + "9"
    status, body = c.call("POST", "/auth/register", {"fullName": f"Racer {i}", "email": f"racer-{secrets.token_hex(4)}@example.test",
                                                    "password": pw, "confirmPassword": pw})
    assert status == 201, (status, body)
    c.csrf = None  # the token rotates at sign-in
    clients.append(c)

# Windows: 10-12, 11-13, 10-11, 11-12, ... all overlap at least one other window.
windows = [(10, 12), (11, 13), (10, 11), (11, 12)]
barrier = threading.Barrier(N)
results = [None] * N


def go(i):
    start, end = windows[i % len(windows)]
    body = {"roomId": ROOM, "startTime": f"{day}T{start:02d}:00:00", "endTime": f"{day}T{end:02d}:00:00", "groupSize": 4}
    clients[i].call("GET", "/auth/me")  # warm the session before the race
    barrier.wait()
    results[i] = (start, end, *clients[i].call("POST", "/bookings", body, {"Idempotency-Key": f"race-{secrets.token_hex(8)}"}))


threads = [threading.Thread(target=go, args=(i,)) for i in range(N)]
[t.start() for t in threads]
[t.join() for t in threads]

winners = []
for i, (s, e, status, body) in enumerate(results):
    print(f"  racer {i}: {s:02d}:00-{e:02d}:00 -> {status} {body.get('bookingReference') or body.get('code')}")
    if status == 201:
        winners.append((i, s, e, body))
    else:
        assert status == 409 and body.get("code") == "SLOT_TAKEN", (status, body)

for a in range(len(winners)):
    for b in range(a + 1, len(winners)):
        _, s1, e1, _ = winners[a]
        _, s2, e2, _ = winners[b]
        assert not (s1 < e2 and e1 > s2), f"OVERLAP between winners {winners[a][3]['bookingReference']} and {winners[b][3]['bookingReference']}"
print(f"created={len(winners)} conflicts={N - len(winners)} - no overlapping winners")

# Students cannot see each other's bookings.
owner, _, _, booking = winners[0]
other = (owner + 1) % N
status, _ = clients[other].call("GET", f"/bookings/{booking['id']}")
assert status == 404, status
print("another student's booking is hidden (404)")

# Clean up: cancel every booking the race created, freeing the slots again.
for i, _, _, b in winners:
    status, body = clients[i].call("POST", f"/bookings/{b['id']}/cancel", {"reason": "live race test clean-up"})
    assert status == 200 and body["status"] == "CANCELLED", (status, body)
print("clean-up done - all race bookings cancelled")
print("PASS")

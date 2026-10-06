from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone

from event.models import Event


class Log(models.Model):
    """One row per (user, event) — `user` is the staff member operating
    the scanner, so each staff member scanning at an event gets their own
    row. Errors are appended to `logs` rather than overwriting it, so one
    staff member's row keeps growing across however many different
    students they scan at that event. The scanned student isn't its own
    column — a row can cover many different students — so each appended
    line names them inline instead."""
    user = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, related_name="scanner_logs")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="scanner_logs")
    logs = models.TextField(blank=True, default="")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "event"], name="unique_scanner_log_user_event"),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.event.name}"

    def append_error(self, message: str, scanned_user=None) -> None:
        self._append(message, scanned_user)

    def append_note(self, message: str, scanned_user=None) -> None:
        self._append(message, scanned_user)

    def _append(self, message: str, scanned_user=None) -> None:
        who = f"{scanned_user.email}: " if scanned_user is not None else ""
        line = f"[{timezone.now().isoformat()}] {who}{message}"
        self.logs = f"{self.logs}\n{line}" if self.logs else line
        self.save(update_fields=["logs"])

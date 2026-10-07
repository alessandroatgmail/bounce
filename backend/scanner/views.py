from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from booking.models import Booking, ContributionStatus
from event.models import Event

from .models import Log
from .permissions import IsStaffOrAdmin


class RegisterListView(APIView):
    """Staff picks a class and switches to the "Register" view: one row
    per Booking for that event, with the booker's name, their
    contribution's status, and whether they've been marked attended.
    Deliberately flat and partner-free — the full couple-pairing grid
    lives at booking.register.build_register for the admin register
    page, this is just the staff check-in list."""

    permission_classes = [IsStaffOrAdmin]

    def get(self, request, event_id):
        try:
            event = Event.objects.get(pk=event_id)
        except Event.DoesNotExist:
            return Response({"detail": "Event not found."}, status=status.HTTP_404_NOT_FOUND)

        bookings = (
            Booking.objects.filter(event=event)
            .select_related("user", "contribution")
            .order_by("user__last_name", "user__first_name")
        )
        rows = [
            {
                "booking_id": booking.id,
                "first_name": booking.user.first_name,
                "last_name": booking.user.last_name,
                "status": booking.contribution.status if booking.contribution else None,
                "attended": booking.attended,
            }
            for booking in bookings
        ]
        return Response({"event_id": event.id, "rows": rows}, status=status.HTTP_200_OK)


class UpdateAttendanceView(APIView):
    """Staff flips a Register row's attended flag directly, by booking
    id. Always an explicit true/false (never a toggle), so a retried or
    duplicated request is a no-op instead of landing on the wrong
    value."""

    permission_classes = [IsStaffOrAdmin]

    def patch(self, request, booking_id):
        attended = request.data.get("attended")
        if not isinstance(attended, bool):
            return Response(
                {"detail": "attended is required and must be a boolean."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            booking = Booking.objects.get(pk=booking_id)
        except Booking.DoesNotExist:
            return Response({"detail": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

        booking.attended = attended
        booking.save(update_fields=["attended"])

        return Response({"booking_id": booking.id, "attended": booking.attended}, status=status.HTTP_200_OK)


class GetLogView(APIView):
    """The notes box at the bottom of the Register view: the requesting
    staff member's own Log row for this event (scoped to request.user —
    Log is keyed on (user, event), so this never shows another staff
    member's notes). No row yet is normal, not an error: returns an
    empty string."""

    permission_classes = [IsStaffOrAdmin]

    def get(self, request, event_id):
        try:
            event = Event.objects.get(pk=event_id)
        except Event.DoesNotExist:
            return Response({"detail": "Event not found."}, status=status.HTTP_404_NOT_FOUND)

        log = Log.objects.filter(user=request.user, event=event).first()
        return Response(
            {"event_id": event.id, "logs": log.logs if log else ""},
            status=status.HTTP_200_OK,
        )

    def post(self, request, event_id):
        note = request.data.get("note")
        if not isinstance(note, str) or not note.strip():
            return Response(
                {"detail": "note is required and cannot be blank."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            event = Event.objects.get(pk=event_id)
        except Event.DoesNotExist:
            return Response({"detail": "Event not found."}, status=status.HTTP_404_NOT_FOUND)

        log, _ = Log.objects.get_or_create(user=request.user, event=event)
        log.append_note(note.strip())

        return Response({"event_id": event.id, "logs": log.logs}, status=status.HTTP_200_OK)


class CheckInView(APIView):
    """Staff scans a student's QR code (their uuid) against the event
    picked in the "today's events" select, marking the matching Booking
    attended. Validation problems on the underlying contribution never
    block the check-in — attended is set regardless — they're appended
    to the requesting staff member's Log row for (user, event) instead,
    so staff can review them later rather than being stopped at the
    door."""

    permission_classes = [IsStaffOrAdmin]

    def post(self, request):
        user_uuid = request.data.get("uuid")
        event_id = request.data.get("event_id")
        if not user_uuid or not event_id:
            return Response(
                {"detail": "uuid and event_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        User = get_user_model()
        try:
            student = User.objects.get(uuid=user_uuid)
        except (User.DoesNotExist, ValueError, ValidationError):
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        student_fields = {"first_name": student.first_name, "last_name": student.last_name}

        try:
            event = Event.objects.get(pk=event_id)
        except Event.DoesNotExist:
            return Response({"detail": "Event not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking = Booking.objects.select_related("contribution").get(user=student, event=event)
        except Booking.DoesNotExist:
            log, _ = Log.objects.get_or_create(user=request.user, event=event)
            log.append_error("No booking found for this user/event.", scanned_user=student)
            return Response(
                {"detail": "No booking found for this user/event.", **student_fields},
                status=status.HTTP_404_NOT_FOUND,
            )

        errors = []
        contribution = booking.contribution
        if contribution is None:
            errors.append("Booking has no linked contribution.")
        else:
            if contribution.status != ContributionStatus.PAYED:
                errors.append(f"Contribution status is '{contribution.status}', expected 'payed'.")
            if contribution.end_date is None:
                errors.append("Contribution has no end_date.")
            elif contribution.end_date < event.start_date:
                errors.append("Contribution end_date is before the event's start_date.")

        booking.attended = True
        booking.save(update_fields=["attended"])

        if errors:
            log, _ = Log.objects.get_or_create(user=request.user, event=event)
            for error in errors:
                log.append_error(error, scanned_user=student)
            return Response(
                {"detail": "Checked in with warnings.", "errors": errors, **student_fields},
                status=status.HTTP_200_OK,
            )

        return Response({"detail": "Checked in.", **student_fields}, status=status.HTTP_200_OK)

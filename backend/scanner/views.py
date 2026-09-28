from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from booking.models import Booking, ContributionStatus
from event.models import Event

from .models import Log
from .permissions import IsStaffOrAdmin


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

from rest_framework.permissions import BasePermission

from users.models import Role


class IsStaffOrAdmin(BasePermission):
    """Gate on the business `role` field (staff/admin), not Django's
    built-in is_staff — that flag is about Django admin access, a
    separate axis from who's allowed to run the scanner."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.role in (Role.STAFF, Role.ADMIN)
        )

# favorites/permissions.py
from rest_framework import permissions
from rest_framework.permissions import SAFE_METHODS

class IsStaffOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)

class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        user = getattr(request, "user", None)
        owner = getattr(obj, "user", None) or getattr(obj, "owner", None)
        return bool(user and (user.is_staff or owner == user))

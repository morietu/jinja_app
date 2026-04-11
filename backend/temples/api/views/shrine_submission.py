from __future__ import annotations

from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework import status

from temples.api.serializers.shrine_submission import ShrineSubmissionCreateSerializer


class ShrineSubmissionCreateView(generics.CreateAPIView):
    serializer_class = ShrineSubmissionCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = serializer.save()

        response_serializer = self.get_serializer(submission)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

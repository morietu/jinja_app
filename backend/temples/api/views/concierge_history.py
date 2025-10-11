from rest_framework.generics import ListCreateAPIView
from rest_framework.permissions import IsAuthenticated
from temples.api.serializers.concierge_history import ConciergeHistorySerializer
from temples.models.concierge import ConciergeHistory


class ConciergeHistoryView(ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConciergeHistorySerializer

    def get_queryset(self):
        return ConciergeHistory.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

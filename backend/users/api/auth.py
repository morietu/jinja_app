from rest_framework_simplejwt.views import TokenObtainPairView

from users.throttles import LoginThrottle


class AuthTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [LoginThrottle]

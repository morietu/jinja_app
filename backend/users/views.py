from django.shortcuts import render, redirect
from django.contrib.auth.forms import UserCreationForm
from django.views import View
from django.contrib.auth.decorators import login_required
from rest_framework.views import APIView
from rest_framework.response import Response

from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.exceptions import NotAuthenticated, NotFound
from .serializers import MeSerializer

class MeView(APIView):
    permission_classes = [IsAuthenticatedOrReadOnly]




    def get(self, request):
         if not request.user.is_authenticated:
            # フロント側は 401/403/404 を null として扱う設計
            raise NotFound()
        return Response(MeSerializer(request.user).data)

    def patch(self, request):
        profile = self.get_profile(request)
        serializer = MeSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    
    def patch(self, request):
        if not request.user.is_authenticated:
            raise NotAuthenticated()
        ser = MeSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        return Response(MeSerializer(user).data)

    # PUT も PATCH と同じ扱い
    def put(self, request):
        return self.patch(request)

    
# 会員登録ビュー（フォーム）
class RegisterView(View):
    def get(self, request):
        form = UserCreationForm()
        return render(request, "registration/register.html", {"form": form})

    def post(self, request):
        form = UserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect("login")
        return render(request, "registration/register.html", {"form": form})
    
class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    

    
# マイページ（HTML用）
@login_required
def mypage(request):
    return render(request, "users/mypage.html")

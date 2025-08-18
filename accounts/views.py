from django.contrib import messages
from django.contrib.auth.views import LoginView, LogoutView

from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.views import View

class RegisterView(View):
    def get(self, request):
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, "登録が完了しました。")
            return redirect("mypage")
        return render(request, "accounts/register.html", {"form": form})


    def post(self, request):
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect("mypage")
        return render(request, "accounts/register.html", {"form": form})

# 追加: ログイン/ログアウトでメッセージ
class MyLoginView(LoginView):
    def form_valid(self, form):
        resp = super().form_valid(form)
        messages.info(self.request, "ログインしました。")
        return resp

class MyLogoutView(LogoutView):
# LogoutViewはPOSTでのログアウトが推奨/既定（GETは不可）なので、そのままdispatchでOK
    def dispatch(self, request, *args, **kwargs):
        response = super().dispatch(request, *args, **kwargs)
        messages.info(request, "ログアウトしました。")
        return response
@login_required
def mypage(request):
    # 必要ならここでプロフィール情報を取得して context に渡す
    return render(request, "accounts/mypage.html")
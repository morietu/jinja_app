from django.shortcuts import render, redirect
from django.contrib.auth.forms import UserCreationForm
from django.views import View
from django.contrib.auth.decorators import login_required

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

# マイページ（HTML用）
@login_required
def mypage(request):
    return render(request, "users/mypage.html")

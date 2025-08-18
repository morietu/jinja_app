from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.views import View

class RegisterView(View):
    def get(self, request):
        return render(request, "accounts/register.html", {"form": UserCreationForm()})

    def post(self, request):
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect("mypage")
        return render(request, "accounts/register.html", {"form": form})

@login_required
def mypage(request):
    # 必要ならここでプロフィール情報を取得して context に渡す
    return render(request, "accounts/mypage.html")
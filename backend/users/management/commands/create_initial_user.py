# users/management/commands/create_initial_user.py
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = "本番環境向けに初期ユーザーを1件だけ作成する"

    def handle(self, *args, **options):
        User = get_user_model()

        username = "morietsu"      # 好きなIDにしてOK
        email = "ejb0515@gmail.com"
        password = "jdb50515"      # 後で変えてもOK

        if User.objects.filter(username=username).exists():
            self.stdout.write(self.style.SUCCESS("initial user already exists"))
            return

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
        )
        self.stdout.write(self.style.SUCCESS(f"created user: {user.username}"))

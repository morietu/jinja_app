# backend/create_user_once.py
from django.contrib.auth import get_user_model
User = get_user_model()

username = "morietsu"
password = "jdb50515"
email = "test@example.com"

# すでに存在する場合は何もしない
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username=username, email=email, password=password)
    print("User created:", username)
else:
    print("User already exists:", username)

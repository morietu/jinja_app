# temples/migrations/0052_goshuin_add_user_field_manual.py
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("temples", "0051_conciergeusage"),
    ]

    # 既に goshuin.user は過去のマイグレーションで作られているので、
    # ここでは何もしない（履歴だけ残す）
    operations = []

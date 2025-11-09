from django.db import migrations, models

class Migration(migrations.Migration):
    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Shrine",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("kind", models.CharField(max_length=20, default="shrine")),
                ("name_jp", models.CharField(max_length=255)),
                ("name_romaji", models.CharField(max_length=255, null=True, blank=True)),
                ("address", models.CharField(max_length=255, null=True, blank=True)),
                ("latitude", models.FloatField(null=True, blank=True)),
                ("longitude", models.FloatField(null=True, blank=True)),
                ("location", models.TextField(null=True, blank=True)),
                ("goriyaku", models.TextField(null=True, blank=True, default="")),
                ("sajin", models.TextField(null=True, blank=True, default="")),
                ("description", models.TextField(null=True, blank=True)),
                ("element", models.CharField(max_length=20, null=True, blank=True)),
                ("kyusei", models.CharField(max_length=20, null=True, blank=True)),
                ("views_30d",  models.PositiveIntegerField(default=0)),
                ("favorites_30d", models.PositiveIntegerField(default=0)),
                
                # ← 重複していた Decimal を削除し、Float を採用（models.py と一致）
                ("popular_score", models.FloatField(default=0.0)),
                ("last_popular_calc_at", models.DateTimeField(null=True, blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "temples_shrine",
                "indexes": [
                    models.Index(fields=["popular_score"], name="shrine_popular_idx"),
                ],
            },
        ),

        migrations.CreateModel(
            name="ConciergeSession",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("status", models.CharField(max_length=20, default="open")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user_id", models.IntegerField(null=True, blank=True)),
            ],
            options={"db_table": "temples_conciergesession"},
        ),
        migrations.CreateModel(
            name="ConciergeMessage",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("role", models.CharField(max_length=20)),
                ("content", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("session_id", models.IntegerField()),
            ],
            options={"db_table": "temples_conciergemessage"},
        ),
        migrations.CreateModel(
            name="GoriyakuTag",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=64, unique=True)),
            ],
            options={"db_table": "temples_goriyakutag"},
        ),


    ]

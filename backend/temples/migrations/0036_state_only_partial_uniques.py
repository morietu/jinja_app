# backend/temples/migrations/0036_state_only_partial_uniques.py
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("temples", "0035_unique_when_location_null"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AddConstraint(
                    model_name="shrine",
                    constraint=models.UniqueConstraint(
                        fields=["name_jp", "address", "location"],
                        condition=models.Q(("location__isnull", False)),
                        name="uq_shrine_name_loc",
                    ),
                ),
                migrations.AddConstraint(
                    model_name="shrine",
                    constraint=models.UniqueConstraint(
                        fields=["name_jp", "address"],
                        condition=models.Q(("location__isnull", True)),
                        name="uq_shrine_name_addr_when_loc_null",
                    ),
                ),
            ],
        ),
    ]

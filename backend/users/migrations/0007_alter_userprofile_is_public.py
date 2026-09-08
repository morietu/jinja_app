from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("users", "0006_userprofile_birth_profile_fields")]

    operations = [
        migrations.AlterField(
            model_name="userprofile",
            name="is_public",
            field=models.BooleanField(default=False),
        ),
    ]

from django.conf import settings
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('temples', '0014_finalize_drop_legacy_name'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.AlterUniqueTogether(
            name='favorite',
            unique_together=set(),
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(model_name='shrine', name='name'),
                migrations.RemoveField(model_name='shrine', name='owner'),
            ],
            database_operations=[
                migrations.RunSQL(
                    sql="ALTER TABLE temples_shrine DROP COLUMN IF EXISTS name",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    sql="ALTER TABLE temples_shrine DROP COLUMN IF EXISTS owner_id",
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name='favorite',
            constraint=models.UniqueConstraint(
                fields=('user', 'shrine'),
                name='uq_favorite_user_shrine',
            ),
        ),
    ]
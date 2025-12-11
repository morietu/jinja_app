from django.db import migrations

SQL = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'temples_goshuin'
          AND column_name = 'user_id'
    ) THEN
        ALTER TABLE temples_goshuin
        ADD COLUMN user_id bigint NULL;
    END IF;
END;
$$;
"""

class Migration(migrations.Migration):

    dependencies = [
        ("temples", "0053_alter_goshuin_user"),
    ]

    operations = [
        migrations.RunSQL(SQL),
    ]

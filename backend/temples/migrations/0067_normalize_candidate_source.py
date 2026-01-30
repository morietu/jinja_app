from django.db import migrations

def forwards(apps, schema_editor):
    ShrineCandidate = apps.get_model("temples", "ShrineCandidate")
    ShrineCandidate.objects.filter(source="stub").update(source="manual")

def backwards(apps, schema_editor):
    ShrineCandidate = apps.get_model("temples", "ShrineCandidate")
    ShrineCandidate.objects.filter(source="manual").update(source="stub")

class Migration(migrations.Migration):
    dependencies = [
        ("temples", "0066_alter_shrinecandidate_source_and_more"),
    ]
    operations = [
        migrations.RunPython(forwards, backwards),
    ]

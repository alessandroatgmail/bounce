import uuid

from django.db import migrations, models


def populate_uuids(apps, schema_editor):
    User = apps.get_model('users', 'User')
    for user in User.objects.all():
        user.uuid = uuid.uuid4()
        user.save(update_fields=['uuid'])


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_user_language'),
    ]

    operations = [
        # Step 1: add nullable, no unique yet
        migrations.AddField(
            model_name='user',
            name='uuid',
            field=models.UUIDField(null=True, blank=True, editable=False),
        ),
        migrations.AddField(
            model_name='user',
            name='profile_image',
            field=models.ImageField(blank=True, null=True, upload_to='profiles/'),
        ),
        # Step 2: fill each existing row with a distinct UUID
        migrations.RunPython(populate_uuids, migrations.RunPython.noop),
        # Step 3: make it non-nullable and unique
        migrations.AlterField(
            model_name='user',
            name='uuid',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]

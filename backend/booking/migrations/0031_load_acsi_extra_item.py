from decimal import Decimal

from django.db import migrations


def create_acsi_extra_item(apps, schema_editor):
    ExtraItem = apps.get_model('booking', 'ExtraItem')
    ExtraItem.objects.get_or_create(
        name='ACSI Membership',
        defaults={
            'name_it': 'Tessera ACSI',
            'name_en': 'ACSI Membership',
            'value': Decimal('5.00'),
        }
    )


def delete_acsi_extra_item(apps, schema_editor):
    ExtraItem = apps.get_model('booking', 'ExtraItem')
    ExtraItem.objects.filter(name='ACSI Membership').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('booking', '0030_extraitem'),
    ]

    operations = [
        migrations.RunPython(create_acsi_extra_item, delete_acsi_extra_item),
    ]

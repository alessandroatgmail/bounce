from django.db import migrations


def seed_discounts(apps, schema_editor):
    # IMPORTANT: always get the model via apps.get_model(), never import directly.
    # This gives you the "historical" version of the model at this point in time,
    # which is safe even if the model changes in future migrations.
    Discount = apps.get_model('membership', 'Discount')

    discounts = [
        {'name': 'COUPLE', 'name_ext': 'COUPLE DISCOUNT', 'rate': 10},
        {'name': 'DOUBLE', 'name_ext': 'DOUBLE MONTHLY COURSE', 'rate': 10},
        {'name': 'DOUBLE4M', 'name_ext': 'DOUBLE MONTHLY COURSE 4 MONTHS', 'rate': 20},
    ]

    for data in discounts:
        Discount.objects.get_or_create(
            name=data['name'],   # lookup field: avoids duplicates if run twice
            defaults=data        # fields to set only on creation
        )


def reverse_seed_discounts(apps, schema_editor):
    # Defines what happens on migrate --reverse (optional but good practice)
    Discount = apps.get_model('membership', 'Discount')
    Discount.objects.filter(code__in=['COUPLE', 'DOUBLE', 'DOUBLE-QUARTER']).delete()


class Migration(migrations.Migration):

    dependencies = [
        # Make sure this points to the migration that CREATED the Discount table
        ('membership', '0006_discount_alter_membership_options_and_more'),
    ]

    operations = [
        migrations.RunPython(
            seed_discounts,         # forward: applied on migrate
            reverse_seed_discounts, # backward: applied on migrate --reverse
        ),
    ]
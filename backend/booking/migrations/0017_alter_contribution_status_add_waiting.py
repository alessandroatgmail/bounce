from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('booking', '0016_load_waiting_list_for_role_email_template'),
    ]

    operations = [
        migrations.AlterField(
            model_name='contribution',
            name='status',
            field=models.CharField(
                choices=[
                    ('received', 'Received'),
                    ('accepted', 'Accepted'),
                    ('confirmed', 'Confirmed'),
                    ('payed', 'Payed'),
                    ('cancelled', 'Cancelled'),
                    ('waiting', 'Waiting'),
                ],
                default='received',
                max_length=20,
            ),
        ),
    ]

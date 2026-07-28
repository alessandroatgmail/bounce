# users/migrations/0004_load_registration_email_templates.py
from django.db import migrations

def create_email_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='welcome_email',
        language='',
        default_template=None,
        defaults={
            'subject': 'Conferma iscrizione - Bounce Swing Lovers',
            'content': """
                                        Hi {{user.first_name}},
                                        Please activate your Bounce by clicking the link below:
                                        {{activation_link}} 
                                    """,
            'html_content': """
                                        Hi {{user.first_name}},
                                        Please activate your Bounce by clicking the link below:
                                        {{activation_link}} 
                                    """,
        }
    )

    # Italian translation
    EmailTemplate.objects.get_or_create(
        name='welcome_email',
        language='it',
        default_template=base,
        defaults={
            'subject': 'Conferma iscrizione - Bounce Swing Lovers',
            'content': """
                                Hi {{user.first_name}},
                                Please activate your Bounce by clicking the link below:
                                {{activation_link}} 
                            """,
            'html_content': """
                                Hi {{user.first_name}},
                                Please activate your Bounce by clicking the link below:
                                {{activation_link}} 
                            """,
        }
    )
    EmailTemplate.objects.get_or_create(
        name='welcome_email',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Conferma iscrizione - Bounce Swing Lovers',
            'content': """
                                    Hi {{user.first_name}},
                                    Please activate your Bounce by clicking the link below:
                                    {{activation_link}} 
                                """,
            'html_content': """
                                    Hi {{user.first_name}},
                                    Please activate your Bounce by clicking the link below:
                                    {{activation_link}} 
                                """,
        }
    )


def delete_email_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')
    EmailTemplate.objects.filter(name__in=[
        'welcome_email',
    ]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_alter_user_city_alter_user_place_of_birth'),  # aggiorna con la tua ultima migration
        ('post_office', '0014_alter_email_recipient_delivery_status_and_more'),  # dipendenza da post_office
    ]

    operations = [
        migrations.RunPython(create_email_templates, delete_email_templates),
    ]

from django.db import migrations


def create_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='password_reset_email',
        language='',
        default_template=None,
        defaults={
            'subject': 'Reset your Bounce password',
            'content': 'Hi {{ first_name }}, click here to reset your password: {{ reset_link }}',
            'html_content': '<p>Hi {{ first_name }},</p><p>Click the link below to reset your password:</p><p><a href="{{ reset_link }}">{{ reset_link }}</a></p><p>If you did not request a password reset, ignore this email.</p>',
        }
    )

    EmailTemplate.objects.get_or_create(
        name='password_reset_email',
        language='it',
        default_template=base,
        defaults={
            'subject': 'Reimposta la tua password Bounce',
            'content': 'Ciao {{ first_name }}, clicca qui per reimpostare la password: {{ reset_link }}',
            'html_content': '<p>Ciao {{ first_name }},</p><p>Clicca il link qui sotto per reimpostare la tua password:</p><p><a href="{{ reset_link }}">{{ reset_link }}</a></p><p>Se non hai richiesto il reset della password, ignora questa email.</p>',
        }
    )

    EmailTemplate.objects.get_or_create(
        name='password_reset_email',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Reset your Bounce password',
            'content': 'Hi {{ first_name }}, click here to reset your password: {{ reset_link }}',
            'html_content': '<p>Hi {{ first_name }},</p><p>Click the link below to reset your password:</p><p><a href="{{ reset_link }}">{{ reset_link }}</a></p><p>If you did not request a password reset, ignore this email.</p>',
        }
    )


def delete_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')
    EmailTemplate.objects.filter(name='password_reset_email').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_user_uuid_profile_image'),
        ('post_office', '0014_alter_email_recipient_delivery_status_and_more'),
    ]

    operations = [
        migrations.RunPython(create_templates, delete_templates),
    ]

from django.db import migrations


def create_template(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='spot_available_email',
        language='',
        default_template=None,
        defaults={
            'subject': "Bounce Swing Lovers - Posto disponibile {{event.name}}",
            'content': (
                "Gentile {{user.first_name}}, si è liberato un posto per l'evento {{event.name}}. "
                "Contattaci per confermare la tua iscrizione."
            ),
            'html_content': (
                "<p>Gentile {{user.first_name}},</p>"
                "<p>si è liberato un posto per l'evento <strong>{{event.name}}</strong>.</p>"
                "<p>Contattaci per confermare la tua iscrizione.</p>"
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='spot_available_email',
        language='it',
        default_template=base,
        defaults={
            'subject': "Bounce Swing Lovers - Posto disponibile {{event.name}}",
            'content': (
                "Gentile {{user.first_name}}, si è liberato un posto per l'evento {{event.name}}. "
                "Contattaci per confermare la tua iscrizione."
            ),
            'html_content': (
                "<p>Gentile {{user.first_name}},</p>"
                "<p>si è liberato un posto per l'evento <strong>{{event.name}}</strong>.</p>"
                "<p>Contattaci per confermare la tua iscrizione.</p>"
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='spot_available_email',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - Spot available {{event.name}}',
            'content': (
                "Dear {{user.first_name}}, a spot has become available for {{event.name}}. "
                "Contact us to confirm your registration."
            ),
            'html_content': (
                "<p>Dear {{user.first_name}},</p>"
                "<p>a spot has become available for <strong>{{event.name}}</strong>.</p>"
                "<p>Contact us to confirm your registration.</p>"
            ),
        }
    )


def delete_template(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')
    EmailTemplate.objects.filter(name='spot_available_email').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('booking', '0018_load_waiting_list_max_email_template'),
        ('post_office', '0014_alter_email_recipient_delivery_status_and_more'),
    ]

    operations = [
        migrations.RunPython(create_template, delete_template),
    ]

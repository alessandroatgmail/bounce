from django.db import migrations


def create_template(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='waiting_list_max',
        language='',
        default_template=None,
        defaults={
            'subject': "Bounce Swing Lovers - Lista d'attesa {{event.name}}",
            'content': (
                "Gentile {{user.first_name}}, la tua iscrizione all'evento {{event.name}} "
                "è in lista d'attesa perché l'evento ha raggiunto la capienza massima."
            ),
            'html_content': (
                "<p>Gentile {{user.first_name}},</p>"
                "<p>la tua iscrizione all'evento <strong>{{event.name}}</strong> "
                "è in lista d'attesa perché l'evento ha raggiunto la capienza massima.</p>"
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='waiting_list_max',
        language='it',
        default_template=base,
        defaults={
            'subject': "Bounce Swing Lovers - Lista d'attesa {{event.name}}",
            'content': (
                "Gentile {{user.first_name}}, la tua iscrizione all'evento {{event.name}} "
                "è in lista d'attesa perché l'evento ha raggiunto la capienza massima."
            ),
            'html_content': (
                "<p>Gentile {{user.first_name}},</p>"
                "<p>la tua iscrizione all'evento <strong>{{event.name}}</strong> "
                "è in lista d'attesa perché l'evento ha raggiunto la capienza massima.</p>"
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='waiting_list_max',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - Waiting list {{event.name}}',
            'content': (
                "Dear {{user.first_name}}, your registration for {{event.name}} "
                "has been placed on the waiting list because the event has reached maximum capacity."
            ),
            'html_content': (
                "<p>Dear {{user.first_name}},</p>"
                "<p>your registration for <strong>{{event.name}}</strong> "
                "has been placed on the waiting list because the event has reached maximum capacity.</p>"
            ),
        }
    )


def delete_template(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')
    EmailTemplate.objects.filter(name='waiting_list_max').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('booking', '0017_alter_contribution_status_add_waiting'),
        ('post_office', '0014_alter_email_recipient_delivery_status_and_more'),
    ]

    operations = [
        migrations.RunPython(create_template, delete_template),
    ]

from django.db import migrations


def create_template(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='waiting_list_for_role',
        language='',
        default_template=None,
        description=(
            "Notifica lista d'attesa per ruolo non disponibile. "
            "Variabili: {{user.first_name}}, {{event.name}}, {{contribution.role}}"
        ),
        defaults={
            'subject': "Bounce Swing Lovers - Lista d'attesa per ruolo {{event.name}}",
            'content': (
                "Gentile {{user.first_name}}, la tua iscrizione all'evento {{event.name}} "
                "è in lista d'attesa perché il ruolo richiesto non è al momento disponibile."
            ),
            'html_content': (
                "<p>Gentile {{user.first_name}},</p>"
                "<p>la tua iscrizione all'evento <strong>{{event.name}}</strong> "
                "è in lista d'attesa perché il ruolo richiesto non è al momento disponibile.</p>"
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='waiting_list_for_role',
        language='it',
        default_template=base,
        defaults={
            'subject': "Bounce Swing Lovers - Lista d'attesa per ruolo {{event.name}}",
            'content': (
                "Gentile {{user.first_name}}, la tua iscrizione all'evento {{event.name}} "
                "è in lista d'attesa perché il ruolo richiesto non è al momento disponibile."
            ),
            'html_content': (
                "<p>Gentile {{user.first_name}},</p>"
                "<p>la tua iscrizione all'evento <strong>{{event.name}}</strong> "
                "è in lista d'attesa perché il ruolo richiesto non è al momento disponibile.</p>"
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='waiting_list_for_role',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - Waiting list for role {{event.name}}',
            'content': (
                "Dear {{user.first_name}}, your registration for {{event.name}} "
                "has been placed on the waiting list because the requested role is not currently available."
            ),
            'html_content': (
                "<p>Dear {{user.first_name}},</p>"
                "<p>your registration for <strong>{{event.name}}</strong> "
                "has been placed on the waiting list because the requested role is not currently available.</p>"
            ),
        }
    )


def delete_template(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')
    EmailTemplate.objects.filter(name='waiting_list_for_role').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('booking', '0015_alter_contribution_status'),
        ('post_office', '0014_alter_email_recipient_delivery_status_and_more'),
    ]

    operations = [
        migrations.RunPython(create_template, delete_template),
    ]

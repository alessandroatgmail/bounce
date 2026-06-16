from django.db import migrations


def create_template(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='contribution_cancelled_email',
        language='',
        default_template=None,
        description=(
            "Notifica annullamento iscrizione per mancato pagamento. "
            "Variabili: {{user.first_name}}, {{event.name}}, {{contribution.amount}}"
        ),
        defaults={
            'subject': 'Bounce Swing Lovers - Iscrizione annullata {{event.name}}',
            'content': (
                "Gentile {{user.first_name}}, la tua iscrizione all'evento {{event.name}} "
                "è stata annullata perché il pagamento non è stato ricevuto entro i termini. "
                "Puoi re-iscriverti accedendo alla tua area personale."
            ),
            'html_content': (
                "<p>Gentile {{user.first_name}},</p>"
                "<p>la tua iscrizione all'evento <strong>{{event.name}}</strong> "
                "è stata annullata perché il pagamento non è stato ricevuto entro i termini.</p>"
                "<p>Puoi re-iscriverti accedendo alla tua area personale.</p>"
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='contribution_cancelled_email',
        language='it',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - Iscrizione annullata {{event.name}}',
            'content': (
                "Gentile {{user.first_name}}, la tua iscrizione all'evento {{event.name}} "
                "è stata annullata perché il pagamento non è stato ricevuto entro i termini. "
                "Puoi re-iscriverti accedendo alla tua area personale."
            ),
            'html_content': (
                "<p>Gentile {{user.first_name}},</p>"
                "<p>la tua iscrizione all'evento <strong>{{event.name}}</strong> "
                "è stata annullata perché il pagamento non è stato ricevuto entro i termini.</p>"
                "<p>Puoi re-iscriverti accedendo alla tua area personale.</p>"
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='contribution_cancelled_email',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - Registration cancelled {{event.name}}',
            'content': (
                "Dear {{user.first_name}}, your registration for {{event.name}} "
                "has been cancelled because payment was not received within the deadline. "
                "You can re-register from your personal area."
            ),
            'html_content': (
                "<p>Dear {{user.first_name}},</p>"
                "<p>your registration for <strong>{{event.name}}</strong> "
                "has been cancelled because payment was not received within the deadline.</p>"
                "<p>You can re-register from your personal area.</p>"
            ),
        }
    )


def delete_template(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')
    EmailTemplate.objects.filter(name='contribution_cancelled_email').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('booking', '0012_contribution_date'),
    ]

    operations = [
        migrations.RunPython(create_template, delete_template),
    ]

from django.db import migrations


def create_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='cancellation_email',
        language='',
        default_template=None,
        defaults={
            'description': (
                'Sent to the user when they manually cancel a registration. '
                'Available context: first_name, event_name, url.'
            ),
            'subject': 'Bounce Swing Lovers – registration cancelled',
            'content': (
                'Hi {{first_name}},\n\n'
                'Your registration for {{event_name}} has been cancelled.\n\n'
                'If this was a mistake, please contact our support team and ask to reactivate your registration.\n\n'
                'You can reach us here: {{url}}\n\n'
                'Thank you,\nBounce Swing Lovers'
            ),
            'html_content': (
                '<p>Hi <strong>{{first_name}}</strong>,</p>'
                '<p>Your registration for <strong>{{event_name}}</strong> has been cancelled.</p>'
                '<p>If this was a mistake, please contact our support team and ask to reactivate your registration.</p>'
                '<p><a href="{{url}}">Contact support</a></p>'
                '<p>Thank you,<br>Bounce Swing Lovers</p>'
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='cancellation_email',
        language='it',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers – iscrizione annullata',
            'content': (
                'Ciao {{first_name}},\n\n'
                'La tua iscrizione a {{event_name}} è stata annullata.\n\n'
                'Se è stato un errore, contatta il nostro supporto e chiedi di riattivare la tua iscrizione.\n\n'
                'Puoi contattarci qui: {{url}}\n\n'
                'Grazie,\nBounce Swing Lovers'
            ),
            'html_content': (
                '<p>Ciao <strong>{{first_name}}</strong>,</p>'
                '<p>La tua iscrizione a <strong>{{event_name}}</strong> è stata annullata.</p>'
                '<p>Se è stato un errore, contatta il nostro supporto e chiedi di riattivare la tua iscrizione.</p>'
                '<p><a href="{{url}}">Contatta il supporto</a></p>'
                '<p>Grazie,<br>Bounce Swing Lovers</p>'
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='cancellation_email',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers – registration cancelled',
            'content': (
                'Hi {{first_name}},\n\n'
                'Your registration for {{event_name}} has been cancelled.\n\n'
                'If this was a mistake, please contact our support team and ask to reactivate your registration.\n\n'
                'You can reach us here: {{url}}\n\n'
                'Thank you,\nBounce Swing Lovers'
            ),
            'html_content': (
                '<p>Hi <strong>{{first_name}}</strong>,</p>'
                '<p>Your registration for <strong>{{event_name}}</strong> has been cancelled.</p>'
                '<p>If this was a mistake, please contact our support team and ask to reactivate your registration.</p>'
                '<p><a href="{{url}}">Contact support</a></p>'
                '<p>Thank you,<br>Bounce Swing Lovers</p>'
            ),
        }
    )


def delete_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')
    EmailTemplate.objects.filter(name='cancellation_email').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('booking', '0021_alter_contribution_start_date'),
    ]

    operations = [
        migrations.RunPython(create_templates, delete_templates),
    ]

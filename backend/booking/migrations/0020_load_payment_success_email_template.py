from django.db import migrations


def create_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='payment_success_email',
        language='',
        default_template=None,
        defaults={
            'description': (
                'Sent to each user after a Stripe payment is completed. '
                'Available context: first_name, event_name, membership_name, amount, url.'
            ),
            'subject': 'Bounce Swing Lovers – payment confirmed',
            'content': (
                'Hi {{first_name}},\n\n'
                'Your payment of €{{amount}} for {{event_name}} ({{membership_name}}) '
                'has been received.\n\n'
                'You will receive an email shortly with further confirmation.\n\n'
                'You can review your registrations here: {{url}}\n\n'
                'Thank you,\nBounce Swing Lovers'
            ),
            'html_content': (
                '<p>Hi <strong>{{first_name}}</strong>,</p>'
                '<p>Your payment of <strong>€{{amount}}</strong> for '
                '<strong>{{event_name}}</strong> ({{membership_name}}) has been received.</p>'
                '<p>You will receive an email shortly with further confirmation.</p>'
                '<p><a href="{{url}}">Review your registrations</a></p>'
                '<p>Thank you,<br>Bounce Swing Lovers</p>'
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='payment_success_email',
        language='it',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers – pagamento confermato',
            'content': (
                'Ciao {{first_name}},\n\n'
                'Il tuo pagamento di €{{amount}} per {{event_name}} ({{membership_name}}) '
                'è stato ricevuto.\n\n'
                'Riceverai a breve un\'email di conferma definitiva.\n\n'
                'Puoi consultare le tue iscrizioni qui: {{url}}\n\n'
                'Grazie,\nBounce Swing Lovers'
            ),
            'html_content': (
                '<p>Ciao <strong>{{first_name}}</strong>,</p>'
                '<p>Il tuo pagamento di <strong>€{{amount}}</strong> per '
                '<strong>{{event_name}}</strong> ({{membership_name}}) è stato ricevuto.</p>'
                '<p>Riceverai a breve un\'email di conferma definitiva.</p>'
                '<p><a href="{{url}}">Consulta le tue iscrizioni</a></p>'
                '<p>Grazie,<br>Bounce Swing Lovers</p>'
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='payment_success_email',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers – payment confirmed',
            'content': (
                'Hi {{first_name}},\n\n'
                'Your payment of €{{amount}} for {{event_name}} ({{membership_name}}) '
                'has been received.\n\n'
                'You will receive an email shortly with further confirmation.\n\n'
                'You can review your registrations here: {{url}}\n\n'
                'Thank you,\nBounce Swing Lovers'
            ),
            'html_content': (
                '<p>Hi <strong>{{first_name}}</strong>,</p>'
                '<p>Your payment of <strong>€{{amount}}</strong> for '
                '<strong>{{event_name}}</strong> ({{membership_name}}) has been received.</p>'
                '<p>You will receive an email shortly with further confirmation.</p>'
                '<p><a href="{{url}}">Review your registrations</a></p>'
                '<p>Thank you,<br>Bounce Swing Lovers</p>'
            ),
        }
    )


def delete_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')
    EmailTemplate.objects.filter(name='payment_success_email').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('booking', '0019_load_spot_available_email_template'),
    ]

    operations = [
        migrations.RunPython(create_templates, delete_templates),
    ]

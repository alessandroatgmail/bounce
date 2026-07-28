from django.db import migrations


def create_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='partner_events_booked_email',
        language='',
        default_template=None,
        defaults={
            'description': (
                'Sent on account activation when a booker had already named '
                'this email as partner: the mirrored contributions are created '
                'and the user is invited to review them. '
                'Available context: first_name, events (list of names), url.'
            ),
            'subject': 'Bounce Swing Lovers – some events are already booked for you',
            'content': (
                'Hi {{first_name}},\n\n'
                'Your account has been activated. A partner already booked '
                'the following events with you:\n\n'
                '{% for event in events %}- {{event}}\n{% endfor %}\n'
                'Please check your registrations in your personal area: {{url}}\n\n'
                'Thank you,\nBounce Swing Lovers'
            ),
            'html_content': (
                '<p>Hi <strong>{{first_name}}</strong>,</p>'
                '<p>Your account has been activated. A partner already booked '
                'the following events with you:</p>'
                '<ul>{% for event in events %}<li>{{event}}</li>{% endfor %}</ul>'
                '<p><a href="{{url}}">Check your registrations</a> in your personal area.</p>'
                '<p>Thank you,<br>Bounce Swing Lovers</p>'
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='partner_events_booked_email',
        language='it',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers – alcuni eventi sono già prenotati per te',
            'content': (
                'Ciao {{first_name}},\n\n'
                'Il tuo account è stato attivato. Un partner ha già prenotato '
                'i seguenti eventi con te:\n\n'
                '{% for event in events %}- {{event}}\n{% endfor %}\n'
                'Controlla le tue iscrizioni nella tua area personale: {{url}}\n\n'
                'Grazie,\nBounce Swing Lovers'
            ),
            'html_content': (
                '<p>Ciao <strong>{{first_name}}</strong>,</p>'
                '<p>Il tuo account è stato attivato. Un partner ha già prenotato '
                'i seguenti eventi con te:</p>'
                '<ul>{% for event in events %}<li>{{event}}</li>{% endfor %}</ul>'
                '<p><a href="{{url}}">Controlla le tue iscrizioni</a> nella tua area personale.</p>'
                '<p>Grazie,<br>Bounce Swing Lovers</p>'
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='partner_events_booked_email',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers – some events are already booked for you',
            'content': (
                'Hi {{first_name}},\n\n'
                'Your account has been activated. A partner already booked '
                'the following events with you:\n\n'
                '{% for event in events %}- {{event}}\n{% endfor %}\n'
                'Please check your registrations in your personal area: {{url}}\n\n'
                'Thank you,\nBounce Swing Lovers'
            ),
            'html_content': (
                '<p>Hi <strong>{{first_name}}</strong>,</p>'
                '<p>Your account has been activated. A partner already booked '
                'the following events with you:</p>'
                '<ul>{% for event in events %}<li>{{event}}</li>{% endfor %}</ul>'
                '<p><a href="{{url}}">Check your registrations</a> in your personal area.</p>'
                '<p>Thank you,<br>Bounce Swing Lovers</p>'
            ),
        }
    )


def delete_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')
    EmailTemplate.objects.filter(name='partner_events_booked_email').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('booking', '0028_booking_unique_booking_user_event'),
        ('post_office', '0014_alter_email_recipient_delivery_status_and_more'),
    ]

    operations = [
        migrations.RunPython(create_templates, delete_templates),
    ]

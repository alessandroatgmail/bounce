from django.db import migrations


def create_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='free_festival_partner_added_email',
        language='',
        default_template=None,
        defaults={
            'description': (
                'Sent when a student booking a free-choice festival names '
                'this already-active user as their partner for one or more '
                'child events — one email covering every event they were '
                'paired on, not one per event. '
                'Available context: first_name, events (list of names), url.'
            ),
            'subject': 'Bounce Swing Lovers – you were added as a dance partner',
            'content': (
                'Hi {{first_name}},\n\n'
                'A friend named you as their dance partner for the '
                'following event(s):\n\n'
                '{% for event in events %}- {{event}}\n{% endfor %}\n'
                'Check your bookings in your personal area: {{url}}\n\n'
                'Thank you,\nBounce Swing Lovers'
            ),
            'html_content': (
                '<p>Hi <strong>{{first_name}}</strong>,</p>'
                '<p>A friend named you as their dance partner for the '
                'following event(s):</p>'
                '<ul>{% for event in events %}<li>{{event}}</li>{% endfor %}</ul>'
                '<p><a href="{{url}}">Check your bookings</a> in your personal area.</p>'
                '<p>Thank you,<br>Bounce Swing Lovers</p>'
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='free_festival_partner_added_email',
        language='it',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers – sei stato aggiunto come partner di ballo',
            'content': (
                'Ciao {{first_name}},\n\n'
                'Un amico ti ha indicato come suo partner di ballo per i '
                'seguenti eventi:\n\n'
                '{% for event in events %}- {{event}}\n{% endfor %}\n'
                'Controlla le tue prenotazioni nella tua area personale: {{url}}\n\n'
                'Grazie,\nBounce Swing Lovers'
            ),
            'html_content': (
                '<p>Ciao <strong>{{first_name}}</strong>,</p>'
                '<p>Un amico ti ha indicato come suo partner di ballo per i '
                'seguenti eventi:</p>'
                '<ul>{% for event in events %}<li>{{event}}</li>{% endfor %}</ul>'
                '<p><a href="{{url}}">Controlla le tue prenotazioni</a> nella tua area personale.</p>'
                '<p>Grazie,<br>Bounce Swing Lovers</p>'
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='free_festival_partner_added_email',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers – you were added as a dance partner',
            'content': (
                'Hi {{first_name}},\n\n'
                'A friend named you as their dance partner for the '
                'following event(s):\n\n'
                '{% for event in events %}- {{event}}\n{% endfor %}\n'
                'Check your bookings in your personal area: {{url}}\n\n'
                'Thank you,\nBounce Swing Lovers'
            ),
            'html_content': (
                '<p>Hi <strong>{{first_name}}</strong>,</p>'
                '<p>A friend named you as their dance partner for the '
                'following event(s):</p>'
                '<ul>{% for event in events %}<li>{{event}}</li>{% endfor %}</ul>'
                '<p><a href="{{url}}">Check your bookings</a> in your personal area.</p>'
                '<p>Thank you,<br>Bounce Swing Lovers</p>'
            ),
        }
    )


def delete_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')
    EmailTemplate.objects.filter(name='free_festival_partner_added_email').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('booking', '0036_contribution_accepted_date'),
        ('post_office', '0014_alter_email_recipient_delivery_status_and_more'),
    ]

    operations = [
        migrations.RunPython(create_templates, delete_templates),
    ]

from django.db import migrations


def create_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='free_festival_waiting_list_email',
        language='',
        default_template=None,
        defaults={
            'description': (
                'Sent when booking a free-choice festival and at least one '
                'chosen child event is already at capacity — the whole '
                'registration goes to the waiting list, and this names '
                'specifically which chosen class(es) are full. '
                'Available context: first_name, events (list of names), url.'
            ),
            'subject': 'Bounce Swing Lovers – you are on the waiting list',
            'content': (
                'Hi {{first_name}},\n\n'
                'The following class(es) you chose are already full, so '
                'your registration has been put on the waiting list:\n\n'
                '{% for event in events %}- {{event}}\n{% endfor %}\n'
                'We will let you know if a spot opens up. Check your '
                'registrations in your personal area: {{url}}\n\n'
                'Thank you,\nBounce Swing Lovers'
            ),
            'html_content': (
                '<p>Hi <strong>{{first_name}}</strong>,</p>'
                '<p>The following class(es) you chose are already full, so '
                'your registration has been put on the waiting list:</p>'
                '<ul>{% for event in events %}<li>{{event}}</li>{% endfor %}</ul>'
                '<p>We will let you know if a spot opens up. '
                '<a href="{{url}}">Check your registrations</a> in your personal area.</p>'
                '<p>Thank you,<br>Bounce Swing Lovers</p>'
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='free_festival_waiting_list_email',
        language='it',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers – sei in lista d\'attesa',
            'content': (
                'Ciao {{first_name}},\n\n'
                'Le seguenti lezioni che hai scelto sono già al completo, '
                'quindi la tua iscrizione è stata messa in lista '
                'd\'attesa:\n\n'
                '{% for event in events %}- {{event}}\n{% endfor %}\n'
                'Ti avviseremo se si libera un posto. Controlla le tue '
                'iscrizioni nella tua area personale: {{url}}\n\n'
                'Grazie,\nBounce Swing Lovers'
            ),
            'html_content': (
                '<p>Ciao <strong>{{first_name}}</strong>,</p>'
                '<p>Le seguenti lezioni che hai scelto sono già al completo, '
                'quindi la tua iscrizione è stata messa in lista '
                'd\'attesa:</p>'
                '<ul>{% for event in events %}<li>{{event}}</li>{% endfor %}</ul>'
                '<p>Ti avviseremo se si libera un posto. '
                '<a href="{{url}}">Controlla le tue iscrizioni</a> nella tua area personale.</p>'
                '<p>Grazie,<br>Bounce Swing Lovers</p>'
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='free_festival_waiting_list_email',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers – you are on the waiting list',
            'content': (
                'Hi {{first_name}},\n\n'
                'The following class(es) you chose are already full, so '
                'your registration has been put on the waiting list:\n\n'
                '{% for event in events %}- {{event}}\n{% endfor %}\n'
                'We will let you know if a spot opens up. Check your '
                'registrations in your personal area: {{url}}\n\n'
                'Thank you,\nBounce Swing Lovers'
            ),
            'html_content': (
                '<p>Hi <strong>{{first_name}}</strong>,</p>'
                '<p>The following class(es) you chose are already full, so '
                'your registration has been put on the waiting list:</p>'
                '<ul>{% for event in events %}<li>{{event}}</li>{% endfor %}</ul>'
                '<p>We will let you know if a spot opens up. '
                '<a href="{{url}}">Check your registrations</a> in your personal area.</p>'
                '<p>Thank you,<br>Bounce Swing Lovers</p>'
            ),
        }
    )


def delete_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')
    EmailTemplate.objects.filter(name='free_festival_waiting_list_email').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('booking', '0038_update_free_festival_partner_added_email_template'),
    ]

    operations = [
        migrations.RunPython(create_templates, delete_templates),
    ]

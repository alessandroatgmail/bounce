from django.db import migrations

# Single bilingual body (Italian, then an "ENGLISH" section) sent to every
# user regardless of their language setting — so it's registered under
# 'it' and 'en' with identical content (mail.send(language=user.language)
# looks up that exact language row; User.language is always 'it' or 'en',
# never '', so a language='' row alone would never actually be found).
SUBJECT = 'Bounce Swinglovers – pagamento registrato / payment recorded'

CONTENT = (
    'Bounce Swinglovers\n\n'
    'Ciao {{ transaction.user.first_name }},\n\n'
    'ti ringraziamo per il tuo contributo di €{{ transaction.amount_total|floatformat:2 }}.\n\n'
    'Il pagamento è registrato per i seguenti eventi:\n'
    '{% for contribution in transaction.contributions.all %}{% for event in contribution.events.all %}\n'
    '- {{ event.name }}{% endfor %}{% endfor %}\n'
    '{% for contribution in transaction.contributions.all %}{% if contribution.extra_items.all %}\n'
    'E inoltre per:\n'
    '{% for extra in contribution.extra_items.all %}\n'
    '- {{ extra.name }}{% endfor %}\n'
    '{% endif %}{% endfor %}\n'
    'Grazie!\n\n'
    'Consulta le tue iscrizioni:\n'
    '{{ url }}\n\n'
    '---------------------------------------------------------------\n\n'
    'ENGLISH\n\n'
    'Hi {{ transaction.user.first_name }},\n\n'
    'thank you for your contribution of €{{ transaction.amount_total|floatformat:2 }}.\n\n'
    'The payment is recorded for the following events:\n'
    '{% for contribution in transaction.contributions.all %}{% for event in contribution.events.all %}\n'
    '- {{ event.name }}{% endfor %}{% endfor %}\n'
    '{% for contribution in transaction.contributions.all %}{% if contribution.extra_items.all %}\n'
    'And also for:\n'
    '{% for extra in contribution.extra_items.all %}\n'
    '- {{ extra.name }}{% endfor %}\n'
    '{% endif %}{% endfor %}\n'
    'Thank you!\n\n'
    'View my registrations:\n'
    '{{ url }}\n\n'
    '---------------------------------------------------------------\n\n'
    'Bounce Swinglovers\n\n'
    'Hai ricevuto questa email perché è stato registrato un pagamento con questo indirizzo.\n'
    'You received this email because a payment was recorded with this address.'
)

HTML_CONTENT = (
    '<p><strong>Bounce</strong><span style="color: rgb(107, 98, 89);">&nbsp;&nbsp;Swinglovers</span></p>'
    '<p>Ciao {{ transaction.user.first_name }},</p>'
    '<p>ti ringraziamo per il tuo contributo di <strong>€{{ transaction.amount_total|floatformat:2 }}</strong>.</p>'
    '<p>Il pagamento è registrato per i seguenti eventi:</p>'
    '<ul>'
    '{% for contribution in transaction.contributions.all %}{% for event in contribution.events.all %}'
    '  <li>{{ event.name }}</li>'
    '{% endfor %}{% endfor %}'
    '</ul>'
    '{% for contribution in transaction.contributions.all %}{% if contribution.extra_items.all %}'
    '<p>E inoltre per:</p>'
    '<ul>'
    '{% for extra in contribution.extra_items.all %}'
    '  <li>{{ extra.name }}</li>'
    '{% endfor %}'
    '</ul>'
    '{% endif %}{% endfor %}'
    '<p>Grazie!</p>'
    '<p><a target="_blank" rel="noopener noreferrer" href="{{ url }}"><strong>Consulta le tue iscrizioni</strong></a></p>'
    '<p>Il link non funziona? Copia e incolla questo indirizzo nel browser:</p>'
    '<p>{{ url }}</p>'
    '<p>&nbsp;<strong>ENGLISH</strong>&nbsp;</p>'
    '<p>Hi {{ transaction.user.first_name }},</p>'
    '<p>thank you for your contribution of <strong>€{{ transaction.amount_total|floatformat:2 }}</strong>.</p>'
    '<p>The payment is recorded for the following events:</p>'
    '<ul>'
    '{% for contribution in transaction.contributions.all %}{% for event in contribution.events.all %}'
    '  <li>{{ event.name }}</li>'
    '{% endfor %}{% endfor %}'
    '</ul>'
    '{% for contribution in transaction.contributions.all %}{% if contribution.extra_items.all %}'
    '<p>And also for:</p>'
    '<ul>'
    '{% for extra in contribution.extra_items.all %}'
    '  <li>{{ extra.name }}</li>'
    '{% endfor %}'
    '</ul>'
    '{% endif %}{% endfor %}'
    '<p>Thank you!</p>'
    '<p><a target="_blank" rel="noopener noreferrer" href="{{ url }}"><strong>View my registrations</strong></a></p>'
    '<p>Link not working? Copy and paste this address into your browser:</p>'
    '<p>{{ url }}</p>'
    '<p><strong>Bounce</strong> Swinglovers</p>'
    '<p>Hai ricevuto questa email perché è stato registrato un pagamento con questo indirizzo.<br>'
    'You received this email because a payment was recorded with this address.</p>'
)

DESCRIPTION = (
    'Sent to the user after any transaction (Stripe or manual cash/bank) is '
    'recorded, for the amount actually paid in that transaction — not '
    'necessarily the full amount owed on the linked contribution(s), since a '
    'contribution can be settled across several installment payments. '
    'Bilingual body (IT then EN), sent as-is regardless of user language. '
    'Available context: transaction, url.'
)


def create_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='transaction_completed',
        language='',
        default_template=None,
        defaults={
            'description': DESCRIPTION,
            'subject': SUBJECT,
            'content': CONTENT,
            'html_content': HTML_CONTENT,
        }
    )

    for language in ('it', 'en'):
        EmailTemplate.objects.get_or_create(
            name='transaction_completed',
            language=language,
            default_template=base,
            defaults={
                'subject': SUBJECT,
                'content': CONTENT,
                'html_content': HTML_CONTENT,
            }
        )


def delete_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')
    EmailTemplate.objects.filter(name='transaction_completed').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('booking', '0033_alter_contribution_status'),
    ]

    operations = [
        migrations.RunPython(create_templates, delete_templates),
    ]

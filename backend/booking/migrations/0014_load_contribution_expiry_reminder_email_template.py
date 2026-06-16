from django.db import migrations


def create_template(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='contribution_expiry_reminder_email',
        language='',
        default_template=None,
        description=(
            "Promemoria pagamento iscrizione: scade tra 2 giorni. "
            "Variabili: {{user.first_name}}, {{event.name}}, {{contribution.amount}}"
        ),
        defaults={
            'subject': 'Bounce Swing Lovers - Promemoria pagamento {{event.name}}',
            'content': (
                "Gentile {{user.first_name}}, ti ricordiamo che hai 2 giorni per completare "
                "il pagamento dell'iscrizione all'evento {{event.name}} (importo: {{contribution.amount}} €). "
                "Dopo questa data l'iscrizione verrà annullata automaticamente."
            ),
            'html_content': (
                "<p>Gentile {{user.first_name}},</p>"
                "<p>ti ricordiamo che hai <strong>2 giorni</strong> per completare il pagamento "
                "dell'iscrizione all'evento <strong>{{event.name}}</strong> "
                "(importo: {{contribution.amount}} €).</p>"
                "<p>Dopo questa data l'iscrizione verrà annullata automaticamente.</p>"
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='contribution_expiry_reminder_email',
        language='it',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - Promemoria pagamento {{event.name}}',
            'content': (
                "Gentile {{user.first_name}}, ti ricordiamo che hai 2 giorni per completare "
                "il pagamento dell'iscrizione all'evento {{event.name}} (importo: {{contribution.amount}} €). "
                "Dopo questa data l'iscrizione verrà annullata automaticamente."
            ),
            'html_content': (
                "<p>Gentile {{user.first_name}},</p>"
                "<p>ti ricordiamo che hai <strong>2 giorni</strong> per completare il pagamento "
                "dell'iscrizione all'evento <strong>{{event.name}}</strong> "
                "(importo: {{contribution.amount}} €).</p>"
                "<p>Dopo questa data l'iscrizione verrà annullata automaticamente.</p>"
            ),
        }
    )

    EmailTemplate.objects.get_or_create(
        name='contribution_expiry_reminder_email',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - Payment reminder for {{event.name}}',
            'content': (
                "Dear {{user.first_name}}, this is a reminder that you have 2 days left to complete "
                "payment for your registration to {{event.name}} (amount: {{contribution.amount}} €). "
                "After this date your registration will be automatically cancelled."
            ),
            'html_content': (
                "<p>Dear {{user.first_name}},</p>"
                "<p>this is a reminder that you have <strong>2 days</strong> left to complete payment "
                "for your registration to <strong>{{event.name}}</strong> "
                "(amount: {{contribution.amount}} €).</p>"
                "<p>After this date your registration will be automatically cancelled.</p>"
            ),
        }
    )


def delete_template(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')
    EmailTemplate.objects.filter(name='contribution_expiry_reminder_email').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('booking', '0013_load_contribution_cancelled_email_template'),
    ]

    operations = [
        migrations.RunPython(create_template, delete_template),
    ]

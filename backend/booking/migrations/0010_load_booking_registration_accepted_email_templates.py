# users/migrations/0004_load_registration_email_templates.py
from django.db import migrations

def create_registration_twin_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='registration_accepted_with_partner_email',
        language='',
        default_template=None,
        description="""
        Questa è il template per le email di accettazione ad un corso/evento, sono disponibili le informazioni degli oggetti user e contribution (registrazione) e event
        Per far si che l'invio riesca sono necessari i seguenti campi
        {{user.first_name}} {{user.last_name}}
        {{event.name}}
        {{contribution.amount}}
        {{url}} url alla sezione registrazioni dell'utente
        {{contribution.partner.first_name}} {{contribution.partner.last_name}}
        {{contribution.role}}
        """,
        defaults={
            'subject': 'Bounce Swing Lovers - accettazione {{event.name}}',
            'content': """
                Congratulazioni {{user.first_name}}|, ti confermiamo l'iscrizione all'evento {{event_name}} con il ruolo di {{contribution.role}} assieme a partner {{contribution.partner.first_name}} {{contribution.partner.last_name}}, puoi procedere rivedere l'iscrizione e procedere al pagamento al seguente link {{url}}.
            """,
            'html_content': """
                Congratulazioni {{user.first_name}}|, ti confermiamo l'iscrizione all'evento {{event_name}} con il ruolo di {{contribution.role}} assieme a partner {{contribution.partner.first_name}} {{contribution.partner.last_name}}, puoi procedere rivedere l'iscrizione e procedere al pagamento al seguente link {{url}}.
            """,
        }
    )

    EmailTemplate.objects.get_or_create(
        name='registration_accepted_with_partner_email',
        language='it',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - accettazione {{event.name}}',
            'content': """
                        Congratulazioni {{user.first_name}}|, ti confermiamo l'iscrizione all'evento {{event_name}} con il ruolo di {{contribution.role}} assieme a partner {{contribution.partner.first_name}} {{contribution.partner.last_name}}, puoi procedere rivedere l'iscrizione e procedere al pagamento al seguente link {{url}}.
                    """,
            'html_content': """
                        Congratulazioni {{user.first_name}}|, ti confermiamo l'iscrizione all'evento {{event_name}} con il ruolo di {{contribution.role}} assieme a partner {{contribution.partner.first_name}} {{contribution.partner.last_name}}, puoi procedere rivedere l'iscrizione e procedere al pagamento al seguente link {{url}}.
                    """,
        }
    )
    EmailTemplate.objects.get_or_create(
        name='registration_accepted_with_partner_email',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - accettazione {{event.name}}',
            'content': """
                        Congratulazioni {{user.first_name}}|, ti confermiamo l'iscrizione all'evento {{event_name}} con il ruolo di {{contribution.role}} assieme a partner {{contribution.partner.first_name}} {{contribution.partner.last_name}}, puoi procedere rivedere l'iscrizione e procedere al pagamento al seguente link {{url}}.
                    """,
            'html_content': """
                        Congratulazioni {{user.first_name}}|, ti confermiamo l'iscrizione all'evento {{event_name}} con il ruolo di {{contribution.role}} assieme a partner {{contribution.partner.first_name}} {{contribution.partner.last_name}}, puoi procedere rivedere l'iscrizione e procedere al pagamento al seguente link {{url}}.
                    """,
        }
    )


def create_registration_single_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='registration_accepted_email',
        language='',
        default_template=None,
        description="""
        Questa è il template per le email di accettazione ad un corso/evento, sono disponibili le informazioni degli oggetti user e contribution (registrazione) e event
        Per far si che l'invio riesca sono necessari i seguenti campi
        {{user.first_name}} {{user.last_name}}
        {{event.name}}
        {{contribution.amount}}
        {{url}} url alla sezione registrazioni dell'utente
        """,
        defaults={
            'subject': 'Bounce Swing Lovers - accettazione {{event.name}}',
            'content': """
                Congratulazioni {{user.first_name}}|, ti confermiamo l'iscrizione all'evento {{event_name}}, puoi procedere rivedere l'iscrizione e procedere al pagamento al seguente link {{url}}.
            """,
            'html_content': """
                Congratulazioni {{user.first_name}}|, ti confermiamo l'iscrizione all'evento {{event_name}}, puoi procedere rivedere l'iscrizione e procedere al pagamento al seguente link {{url}}.
            """,
        }
    )

    EmailTemplate.objects.get_or_create(
        name='registration_accepted_email',
        language='it',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - accettazione {{event.name}}',
            'content': """
                Congratulazioni {{user.first_name}}|, ti confermiamo l'iscrizione all'evento {{event_name}}, puoi procedere rivedere l'iscrizione e procedere al pagamento al seguente link {{url}}.
            """,
            'html_content': """
                Congratulazioni {{user.first_name}}|, ti confermiamo l'iscrizione all'evento {{event_name}}, puoi procedere rivedere l'iscrizione e procedere al pagamento al seguente link {{url}}.
            """,
        }
    )
    EmailTemplate.objects.get_or_create(
        name='registration_accepted_email',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - accettazione {{event.name}}',
            'content': """
                Congratulazioni {{user.first_name}}|, ti confermiamo l'iscrizione all'evento {{event_name}}, puoi procedere rivedere l'iscrizione e procedere al pagamento al seguente link {{url}}.
            """,
            'html_content': """
                Congratulazioni {{user.first_name}}|, ti confermiamo l'iscrizione all'evento {{event_name}}, puoi procedere rivedere l'iscrizione e procedere al pagamento al seguente link {{url}}.
            """,
        }
    )


def delete_email_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')
    EmailTemplate.objects.filter(name__in=[
        'booking_email', 'booking_twin_email', 'booking_single_email',
    ]).delete()


def create_email_templates(apps, schema_editor):
    create_registration_twin_templates(apps, schema_editor)
    create_registration_single_templates(apps, schema_editor)

class Migration(migrations.Migration):

    dependencies = [
        ('booking', '0009_load_booking_registration_email_template'),  # aggiorna con la tua ultima migration
    ]

    operations = [
        migrations.RunPython(create_email_templates,
                             delete_email_templates),
    ]

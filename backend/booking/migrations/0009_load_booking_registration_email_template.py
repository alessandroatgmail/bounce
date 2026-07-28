# users/migrations/0004_load_registration_email_templates.py
from django.db import migrations

def create_registration_original_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='booking_email',
        language='',
        default_template=None,
        defaults={
            'subject': 'Bounce Swing Lovers - Iscrizione a {{event_name}}',
            'content': 'Sei iscritto a {{event_name}} come {{role}} in coppia con {{partner_user}}.',
            'html_content': '<p>Sei iscritto a <strong>{{event_name}}</strong> come {{role}} in coppia con {{partner_user}}.</p>',
        }
    )

    EmailTemplate.objects.get_or_create(
        name='booking_email',
        language='it',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - Iscrizione a {{event_name}}',
            'content': 'Sei iscritto a {{event_name}} come {{role}} in coppia con {{partner_user}}.',
            'html_content': '<p>Sei iscritto a <strong>{{event_name}}</strong> come {{role}} in coppia con {{partner_user}}.</p>',
        }
    )
    EmailTemplate.objects.get_or_create(
        name='booking_email',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - Your registration to {{event_name}}',
            'content': 'You are registered for {{event_name}} as {{role}} paired with {{partner_user}}.',
            'html_content': '<p>You are registered for <strong>{{event_name}}</strong> as {{role}} paired with {{partner_user}}.</p>',
        }
    )

def create_registration_twin_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='booking_twin_email',
        language='',
        default_template=None,
        defaults={
            'subject': 'Bounce Swing Lovers - Iscrizione a {{event_name}}',
            'content': 'Sei iscritto a {{event_name}} come {{role}} in coppia con {{partner_user}}.',
            'html_content': '<p>Sei iscritto a <strong>{{event_name}}</strong> come {{role}} in coppia con {{partner_user}}.</p>',
        }
    )

    EmailTemplate.objects.get_or_create(
        name='booking_twin_email',
        language='it',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - Iscrizione a {{event_name}}',
            'content': 'Sei iscritto a {{event_name}} come {{role}} in coppia con {{partner_user}}.',
            'html_content': '<p>Sei iscritto a <strong>{{event_name}}</strong> come {{role}} in coppia con {{partner_user}}.</p>',
        }
    )
    EmailTemplate.objects.get_or_create(
        name='booking_twin_email',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - Your registration to {{event_name}}',
            'content': 'You are registered for {{event_name}} as {{role}} paired with {{partner_user}}.',
            'html_content': '<p>You are registered for <strong>{{event_name}}</strong> as {{role}} paired with {{partner_user}}.</p>',
        }
    )


def create_registration_single_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')

    base, _ = EmailTemplate.objects.get_or_create(
        name='booking_single_email',
        language='',
        default_template=None,
        defaults={
            'subject': 'Bounce Swing Lovers - Iscrizione a {{event_name}}',
            'content': 'Sei iscritto a {{event_name}}.',
            'html_content': '<p>Sei iscritto a <strong>{{event_name}}</strong>.</p>',
        }
    )

    EmailTemplate.objects.get_or_create(
        name='booking_single_email',
        language='it',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - Iscrizione a {{event_name}}',
            'content': 'Sei iscritto a {{event_name}}.',
            'html_content': '<p>Sei iscritto a <strong>{{event_name}}</strong>.</p>',
        }
    )
    EmailTemplate.objects.get_or_create(
        name='booking_single_email',
        language='en',
        default_template=base,
        defaults={
            'subject': 'Bounce Swing Lovers - Your registration to {{event_name}}',
            'content': 'You are registered for {{event_name}}.',
            'html_content': '<p>You are registered for <strong>{{event_name}}</strong>.</p>',
        }
    )


def delete_email_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('post_office', 'EmailTemplate')
    EmailTemplate.objects.filter(name__in=[
        'booking_email', 'booking_twin_email', 'booking_single_email',
    ]).delete()


def create_email_templates(apps, schema_editor):
    create_registration_original_templates(apps, schema_editor)
    create_registration_twin_templates(apps, schema_editor)
    create_registration_single_templates(apps, schema_editor)

class Migration(migrations.Migration):

    dependencies = [
        ('booking', '0008_contribution_original_contribution'),  # aggiorna con la tua ultima migration
        ('post_office', '0014_alter_email_recipient_delivery_status_and_more'),  # dipendenza da post_office
    ]

    operations = [
        migrations.RunPython(create_email_templates,
                             delete_email_templates),
    ]

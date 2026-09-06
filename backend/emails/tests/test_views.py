import pytest
from post_office.models import Email, EmailTemplate, Log

TEMPLATES_URL = '/api/emails/templates/'
EMAILS_URL = '/api/emails/emails/'
LOGS_URL = '/api/emails/logs/'


# ---------------------------------------------------------------------------
# EmailTemplate CRUD
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestEmailTemplateList:
    def test_admin_can_list(self, admin_client):
        EmailTemplate.objects.create(name='t1', subject='S1', html_content='<p>Hi</p>')
        EmailTemplate.objects.create(name='t2', subject='S2', html_content='<p>Bye</p>')
        res = admin_client.get(TEMPLATES_URL)
        assert res.status_code == 200
        assert res.data['count'] >= 2

    def test_pagination_25(self, admin_client):
        for i in range(30):
            EmailTemplate.objects.create(name=f'tpl-{i}', subject='S', html_content='x')
        res = admin_client.get(TEMPLATES_URL)
        assert res.status_code == 200
        assert len(res.data['results']) == 25

    def test_student_forbidden(self, student_client):
        res = student_client.get(TEMPLATES_URL)
        assert res.status_code == 403

    def test_unauthenticated_forbidden(self, client):
        from rest_framework.test import APIClient
        res = APIClient().get(TEMPLATES_URL)
        assert res.status_code == 401


@pytest.mark.django_db
class TestEmailTemplateCreate:
    def test_admin_can_create(self, admin_client):
        payload = {
            'name': 'new_template',
            'description': 'A test template',
            'subject': 'Hello {{ name }}',
            'content': 'Plain {{ name }}',
            'html_content': '<p>Hello {{ name }}</p>',
            'language': '',
        }
        res = admin_client.post(TEMPLATES_URL, payload, format='json')
        assert res.status_code == 201
        assert res.data['name'] == 'new_template'
        assert EmailTemplate.objects.filter(name='new_template').exists()

    def test_student_cannot_create(self, student_client):
        res = student_client.post(TEMPLATES_URL, {'name': 'x', 'subject': 'y'}, format='json')
        assert res.status_code == 403


@pytest.mark.django_db
class TestEmailTemplateRetrieve:
    def test_admin_can_retrieve(self, admin_client):
        tpl = EmailTemplate.objects.create(name='r1', subject='S', html_content='<p>x</p>')
        res = admin_client.get(f'{TEMPLATES_URL}{tpl.id}/')
        assert res.status_code == 200
        assert res.data['name'] == 'r1'


@pytest.mark.django_db
class TestEmailTemplateUpdate:
    def test_admin_can_patch(self, admin_client):
        tpl = EmailTemplate.objects.create(name='u1', subject='Old', html_content='<p>x</p>')
        res = admin_client.patch(f'{TEMPLATES_URL}{tpl.id}/', {'subject': 'New Subject'}, format='json')
        assert res.status_code == 200
        tpl.refresh_from_db()
        assert tpl.subject == 'New Subject'

    def test_admin_can_put(self, admin_client):
        tpl = EmailTemplate.objects.create(name='u2', subject='Old', html_content='<p>x</p>')
        payload = {
            'name': 'u2',
            'description': '',
            'subject': 'Updated',
            'content': '',
            'html_content': '<p>updated</p>',
            'language': '',
        }
        res = admin_client.put(f'{TEMPLATES_URL}{tpl.id}/', payload, format='json')
        assert res.status_code == 200
        tpl.refresh_from_db()
        assert tpl.subject == 'Updated'


@pytest.mark.django_db
class TestEmailTemplateDelete:
    def test_admin_can_delete(self, admin_client):
        tpl = EmailTemplate.objects.create(name='del1', subject='S', html_content='x')
        res = admin_client.delete(f'{TEMPLATES_URL}{tpl.id}/')
        assert res.status_code == 204
        assert not EmailTemplate.objects.filter(id=tpl.id).exists()

    def test_student_cannot_delete(self, student_client, admin_client):
        tpl = EmailTemplate.objects.create(name='del2', subject='S', html_content='x')
        res = student_client.delete(f'{TEMPLATES_URL}{tpl.id}/')
        assert res.status_code == 403


# ---------------------------------------------------------------------------
# Email (read-only)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestEmailList:
    def test_admin_can_list(self, admin_client):
        Email.objects.create(from_email='noreply@bounce.com', to=['a@b.com'], subject='Hi')
        res = admin_client.get(EMAILS_URL)
        assert res.status_code == 200
        assert res.data['count'] >= 1

    def test_pagination_25(self, admin_client):
        for i in range(30):
            Email.objects.create(from_email='noreply@bounce.com', to=[f'user{i}@b.com'], subject=f'S{i}')
        res = admin_client.get(EMAILS_URL)
        assert res.status_code == 200
        assert len(res.data['results']) == 25

    def test_filter_by_to(self, admin_client):
        Email.objects.create(from_email='noreply@bounce.com', to=['alice@b.com'], subject='A')
        Email.objects.create(from_email='noreply@bounce.com', to=['bob@b.com'], subject='B')
        res = admin_client.get(f'{EMAILS_URL}?to=alice')
        assert res.status_code == 200
        assert res.data['count'] == 1
        assert res.data['results'][0]['subject'] == 'A'

    def test_filter_by_to_no_match(self, admin_client):
        Email.objects.create(from_email='noreply@bounce.com', to=['alice@b.com'], subject='A')
        res = admin_client.get(f'{EMAILS_URL}?to=nobody')
        assert res.status_code == 200
        assert res.data['count'] == 0

    def test_filter_by_template(self, admin_client):
        tpl1 = EmailTemplate.objects.create(name='welcome', subject='S', html_content='x')
        tpl2 = EmailTemplate.objects.create(name='reminder', subject='S', html_content='x')
        Email.objects.create(from_email='noreply@bounce.com', to=['a@b.com'], subject='A', template=tpl1)
        Email.objects.create(from_email='noreply@bounce.com', to=['b@b.com'], subject='B', template=tpl2)
        res = admin_client.get(f'{EMAILS_URL}?template=welcome')
        assert res.status_code == 200
        assert res.data['count'] == 1
        assert res.data['results'][0]['subject'] == 'A'

    def test_filter_by_to_and_template(self, admin_client):
        tpl1 = EmailTemplate.objects.create(name='welcome', subject='S', html_content='x')
        tpl2 = EmailTemplate.objects.create(name='reminder', subject='S', html_content='x')
        Email.objects.create(from_email='noreply@bounce.com', to=['alice@b.com'], subject='A', template=tpl1)
        Email.objects.create(from_email='noreply@bounce.com', to=['alice@b.com'], subject='B', template=tpl2)
        res = admin_client.get(f'{EMAILS_URL}?to=alice&template=welcome')
        assert res.status_code == 200
        assert res.data['count'] == 1
        assert res.data['results'][0]['subject'] == 'A'

    def test_admin_cannot_create(self, admin_client):
        res = admin_client.post(EMAILS_URL, {'to': ['x@x.com'], 'subject': 'X'}, format='json')
        assert res.status_code == 405

    def test_admin_cannot_delete(self, admin_client):
        email = Email.objects.create(from_email='noreply@bounce.com', to=['x@x.com'], subject='X')
        res = admin_client.delete(f'{EMAILS_URL}{email.id}/')
        assert res.status_code == 405

    def test_student_forbidden(self, student_client):
        res = student_client.get(EMAILS_URL)
        assert res.status_code == 403


@pytest.mark.django_db
class TestEmailRetrieve:
    def test_admin_can_retrieve(self, admin_client):
        email = Email.objects.create(from_email='noreply@bounce.com', to=['x@x.com'], subject='Hello')
        res = admin_client.get(f'{EMAILS_URL}{email.id}/')
        assert res.status_code == 200
        assert res.data['subject'] == 'Hello'


# ---------------------------------------------------------------------------
# Log (read-only)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestLogList:
    def test_admin_can_list(self, admin_client):
        email = Email.objects.create(from_email='noreply@bounce.com', to=['x@x.com'], subject='X')
        Log.objects.create(email=email, status=1, message='OK')
        res = admin_client.get(LOGS_URL)
        assert res.status_code == 200
        assert res.data['count'] >= 1
        assert 'email_to' in res.data['results'][0]

    def test_pagination_25(self, admin_client):
        email = Email.objects.create(from_email='noreply@bounce.com', to=['x@x.com'], subject='X')
        for i in range(30):
            Log.objects.create(email=email, status=1, message=f'msg{i}')
        res = admin_client.get(LOGS_URL)
        assert res.status_code == 200
        assert len(res.data['results']) == 25

    def test_filter_by_email(self, admin_client):
        e1 = Email.objects.create(from_email='noreply@bounce.com', to=['a@b.com'], subject='A')
        e2 = Email.objects.create(from_email='noreply@bounce.com', to=['c@d.com'], subject='B')
        Log.objects.create(email=e1, status=1, message='for e1')
        Log.objects.create(email=e2, status=1, message='for e2')
        res = admin_client.get(f'{LOGS_URL}?email={e1.id}')
        assert res.status_code == 200
        assert res.data['count'] == 1
        assert res.data['results'][0]['message'] == 'for e1'

    def test_admin_cannot_create(self, admin_client):
        res = admin_client.post(LOGS_URL, {'message': 'x'}, format='json')
        assert res.status_code == 405

    def test_student_forbidden(self, student_client):
        res = student_client.get(LOGS_URL)
        assert res.status_code == 403

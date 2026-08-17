from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone


class Document(models.Model):
    file = models.FileField(upload_to='documents/%Y/%m/%d')
    user = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    date = models.DateTimeField(default=timezone.now)

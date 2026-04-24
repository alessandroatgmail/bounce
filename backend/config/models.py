from django.db import models


class SiteSettings(models.Model):
    season_start = models.DateField(null=True, blank=True, verbose_name="Season start")
    season_end = models.DateField(null=True, blank=True, verbose_name="Season end")

    class Meta:
        verbose_name = "Site settings"
        verbose_name_plural = "Site settings"

    def __str__(self):
        return "Site Settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

from django.db import models
from event.models import Event, Room


class FestivalDay(models.Model):
    date = models.DateField()
    event = models.ForeignKey(Event, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.event.name} {str(self.date)}"

class FesivalRoom(models.Model):
    festival_day = models.ForeignKey(FestivalDay, on_delete=models.CASCADE)
    room = models.ForeignKey(Room, on_delete=models.CASCADE)

    def __str__(self):
        return f"{str(self.festival_day)} {str(self.room)}"


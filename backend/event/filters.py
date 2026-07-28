import django_filters
from django.db.models import Q
from .models import Event


class EventFilter(django_filters.FilterSet):
    event_type = django_filters.CharFilter(field_name='event_type__name', lookup_expr='iexact')
    level = django_filters.CharFilter(field_name='level__name', lookup_expr='iexact')
    level_id = django_filters.NumberFilter(field_name='level__id')
    name = django_filters.CharFilter(field_name='name', lookup_expr='icontains')
    style_id = django_filters.NumberFilter(method='filter_style_id')
    type = django_filters.CharFilter(field_name='type')
    status = django_filters.CharFilter(field_name='status')
    city_id = django_filters.NumberFilter(field_name='room__location__city__id')
    upcoming = django_filters.BooleanFilter(method='filter_upcoming')
    active = django_filters.BooleanFilter(method='filter_active')
    parent_only = django_filters.BooleanFilter(method='filter_parent_only')
    exclude_children = django_filters.BooleanFilter(method='filter_exclude_children')
    multi_events = django_filters.BooleanFilter(field_name='multi_events')
    frequency = django_filters.CharFilter(field_name='event_type__frequency')
    start_date_before = django_filters.DateFilter(field_name='start_date', lookup_expr='date__lte')
    end_date_after = django_filters.DateFilter(field_name='end_date', lookup_expr='date__gte')

    class Meta:
        model = Event
        fields = []

    def filter_style_id(self, qs, name, value):
        return qs.filter(styles__id=value).distinct()

    def filter_upcoming(self, qs, name, value):
        from django.utils import timezone
        if value:
            return qs.filter(start_date__gte=timezone.now())
        return qs

    def filter_active(self, qs, name, value):
        from django.utils import timezone
        if value:
            return qs.filter(end_date__gte=timezone.now())
        return qs

    def filter_parent_only(self, qs, name, value):
        if value:
            return qs.filter(events__isnull=False).distinct()
        return qs

    def filter_exclude_children(self, qs, name, value):
        if value:
            child_ids = Event.objects.filter(events__isnull=False).values_list('events__pk', flat=True).distinct()
            return qs.exclude(pk__in=child_ids)
        return qs

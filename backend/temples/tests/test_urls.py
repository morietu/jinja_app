from django.test import SimpleTestCase
from django.urls import reverse, resolve

app_name = "temples"

class TemplesURLTests(SimpleTestCase):
    def test_reverse_paths(self):
        self.assertEqual(reverse("temples:shrine_list"), "/shrines/")
        self.assertEqual(reverse("temples:shrine_detail", args=[1]), "/shrines/1/")
        self.assertEqual(reverse("temples:shrine_route", args=[1]), "/shrines/1/route/")
        self.assertEqual(reverse("temples:favorite_toggle", args=[1]), "/shrines/1/favorite/")

    def test_resolve_names(self):
        self.assertEqual(resolve("/shrines/").url_name, "shrine_list")
        self.assertEqual(resolve("/shrines/1/").url_name, "shrine_detail")
        self.assertEqual(resolve("/shrines/1/route/").url_name, "shrine_route")
        self.assertEqual(resolve("/shrines/1/favorite/").url_name, "favorite_toggle")
from rest_framework.pagination import PageNumberPagination

class DefaultPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50

    # 互換: ?limit= をサポート（page_size より優先度は低い）
    def get_page_size(self, request):
        # 既定ロジック
        size = super().get_page_size(request)
        if size is not None:
            return size
        # 後方互換: ?limit=
        limit = request.query_params.get("limit")
        if limit:
            try:
                v = int(limit)
                if v > 0:
                    return min(v, self.max_page_size)
            except ValueError:
                pass
        return self.page_size

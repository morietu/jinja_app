# backend/temples/api/views/goshuin.py
from rest_framework import permissions, status, viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from django.db import transaction


from temples.models import Goshuin, Shrine, GoshuinImage
from temples.serializers.routes import GoshuinSerializer
# temples/api/views/goshuin.py
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    SessionAuthentication だけど CSRF チェックをスキップする（開発用）
    """
    def enforce_csrf(self, request):
        return  # 何もしない → CSRF 無効


class PublicGoshuinViewSet(viewsets.ReadOnlyModelViewSet):
    """
    /api/goshuins/ 用
    公開されている御朱印だけ一覧・詳細を返す
    """
    queryset = (
        Goshuin.objects
        .filter(is_public=True)
        .select_related("shrine", "user")
        .order_by("-created_at")
    )
    serializer_class = GoshuinSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None  # 配列で返す


class MyGoshuinViewSet(viewsets.ViewSet):
    """
    /api/my/goshuins/ 用
    ログインユーザー自身の御朱印を CRUD する
    """
    
    authentication_classes = [JWTAuthentication, CsrfExemptSessionAuthentication]

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return (
            Goshuin.objects
            .filter(user=self.request.user)
            .select_related("shrine")
            .order_by("-created_at")
        )
    
    def get_serializer_class(self):
        if self.action == "create":
            return MyGoshuinCreateSerializer
        return GoshuinSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)

    def list(self, request):
        """
        GET /api/my/goshuins/
        """
        qs = self.get_queryset()
        serializer = GoshuinSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """
        GET /api/my/goshuins/{id}/
        （必要なら）
        """
        try:
            obj = self.get_queryset().get(pk=pk)
        except Goshuin.DoesNotExist:
            return Response({"detail": "見つかりません。"}, status=status.HTTP_404_NOT_FOUND)

        serializer = GoshuinSerializer(obj, context={"request": request})
        return Response(serializer.data)

    def create(self, request):
        """
        POST /api/my/goshuins/
        multipart/form-data で
        - shrine: shrine id
        - title: 任意
        - is_public: "true" / "false"
        - image: ファイル
        """

        print("DEBUG request.method =", request.method)
        print("DEBUG request.content_type =", request.content_type)
        print("DEBUG request.data =", request.data)
        print("DEBUG request.FILES =", request.FILES)

        
        shrine_id = request.data.get("shrine")
        image = request.FILES.get("image")
        title = request.data.get("title", "") or ""
        is_public_raw = request.data.get("is_public", "false")

        print("DEBUG request.data =", request.data)
        print("DEBUG shrine_id =", shrine_id)

        errors = {}

        # shrine 必須
        if not shrine_id:
            errors["shrine"] = ["このフィールドは必須です。"]
        else:
            try:
                shrine = Shrine.objects.get(pk=shrine_id)
            except Shrine.DoesNotExist:
                errors["shrine"] = ["指定された神社が存在しません。"]

        # image 必須
        if not image:
            errors["image"] = ["このフィールドは必須です。"]

        # is_public を bool に変換
        is_public = str(is_public_raw).lower() in ("1", "true", "t", "yes", "y", "on")

        if errors:
            print("ERRORS:", errors)
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        # Goshuin 本体作成
        goshuin = Goshuin.objects.create(
            user=request.user,
            shrine=shrine,  # type: ignore[name-defined]
            title=title,
            is_public=is_public,
        )

        # 画像レコード
        GoshuinImage.objects.create(
            goshuin=goshuin,
            image=image,
            order=0,
        )

        serializer = GoshuinSerializer(goshuin, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        """
        PATCH /api/my/goshuins/{id}/
        今回は is_public だけ想定
        """
        try:
            goshuin = self.get_queryset().get(pk=pk)
        except Goshuin.DoesNotExist:
            return Response({"detail": "見つかりません。"}, status=status.HTTP_404_NOT_FOUND)

        is_public_raw = request.data.get("is_public")
        if is_public_raw is not None:
            is_public = str(is_public_raw).lower() in ("1", "true", "t", "yes", "y", "on")
            goshuin.is_public = is_public
            goshuin.save(update_fields=["is_public", "updated_at"])

        serializer = GoshuinSerializer(goshuin, context={"request": request})
        return Response(serializer.data)

    def destroy(self, request, pk=None):
        """
        DELETE /api/my/goshuins/{id}/
        """
        try:
            goshuin = self.get_queryset().get(pk=pk)
        except Goshuin.DoesNotExist:
            return Response({"detail": "見つかりません。"}, status=status.HTTP_404_NOT_FOUND)

        # 子画像を先に削除してから本体を消す
        with transaction.atomic():
            GoshuinImage.objects.filter(goshuin=goshuin).delete()
            goshuin.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

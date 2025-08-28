from openai import OpenAI
import os
import re, json

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import generics, permissions


from temples.models import Shrine, ConciergeHistory
from temples.api.serializers.concierge import ConciergeRequestSerializer, ConciergeHistorySerializer



client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class ConciergeHistoryListView(generics.ListAPIView):
    serializer_class = ConciergeHistorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ConciergeHistory.objects.filter(user=self.request.user).order_by("-created_at")

class ConciergeAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ConciergeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        birth_year = serializer.validated_data["birth_year"]
        birth_month = serializer.validated_data.get("birth_month")
        birth_day = serializer.validated_data.get("birth_day")
        theme = serializer.validated_data.get("theme", "総合運")

        zodiac_animals = ["申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰", "巳", "午", "未"]
        zodiac = zodiac_animals[birth_year % 12]

        prompt = f"""
        あなたは日本の神社コンシェルジュです。
        ユーザーの生年月日は {birth_year}年{birth_month or ''}月{birth_day or ''}日 です。
        干支は {zodiac} です。
        相談テーマは「{theme}」です。

        以下を考慮して、ユーザーに最適な神社を1つ提案してください：
        - 干支や年齢に基づいた縁起
        - テーマ（恋愛・仕事・健康など）に関連するご利益
        - 日本で実際に参拝できる有名な神社

        出力は必ず次のJSON形式で返してください：
        {{
          "recommendation": "神社名",
          "reason": "提案理由（2〜3文）",
          "tags": ["縁結び", "仕事運"]
        }}
        """

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful Shinto shrine concierge."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
            )
            print("DEBUG: OpenAI response =", response)

            content = response.choices[0].message.content.strip()
            print("DEBUG: content =", content)

            # JSON抽出
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if match:
                try:
                    result = json.loads(match.group(0))
                except Exception as e:
                    print("DEBUG: json.loads failed:", e)
                    result = None
            else:
                print("DEBUG: regex search failed")
                result = None

            if not result:
                # 不正文字を排除して安全化
                safe_content = content.encode("utf-8", "ignore").decode("utf-8")
                result = {
                    "recommendation": "不明",
                    "reason": safe_content,
                    "tags": []
                }

            # DB照合して shrine_id を追加
            shrine_obj = Shrine.objects.filter(name_jp__icontains=result["recommendation"]).first()
            result["shrine_id"] = shrine_obj.id if shrine_obj else None


            # 履歴を保存（ログインユーザーのみ）
            if request.user.is_authenticated:
                ConciergeHistory.objects.create(
                    user=request.user,
                    shrine=shrine_obj,
                    reason=result.get("reason", ""),
                    tags=result.get("tags", []),
                )

            return Response(result)

        except Exception as e:
            print("DEBUG: exception caught:", e)
            return Response({"error": str(e)}, status=500)
    
# … result 作成のあと … がどこかわからない
    
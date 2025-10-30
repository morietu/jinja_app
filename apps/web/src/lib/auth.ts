// 送信元（フォームのsubmit）例
import { login } from "@/lib/api/auth"; // = loginUser の別名

const onSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const u = form.username?.trim();
  const p = form.password ?? "";
  if (!u || !p) { setErr("ユーザー名とパスワードを入力してね"); return; }

  try {
    const { access, refresh } = await login({ username: u, password: p });
    // 成功したら遷移
    router.push("/mypage?tab=goshuin");
  } catch (e:any) {
    console.error("login failed:", e?.response?.data ?? e);
    setErr("ログインに失敗しました");
  }
};

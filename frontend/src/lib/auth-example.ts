export async function loginAndFetchMe(username: string, password: string) {
  const tokenRes = await fetch("http://localhost:8000/api/token/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!tokenRes.ok) throw new Error("Login failed");
  const { access, refresh } = await tokenRes.json();
  localStorage.setItem("access", access);
  localStorage.setItem("refresh", refresh);

  const meRes = await fetch("http://localhost:8000/api/me/", {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!meRes.ok) throw new Error("GET /api/me failed");
  return meRes.json();
}

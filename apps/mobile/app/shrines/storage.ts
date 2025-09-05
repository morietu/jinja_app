export async function getFavorites() {
  return await getJSON<string[]>(keys.favorites, []);
}

export async function isFavorite(id: string) {
  const favs = await getFavorites();
  return favs.includes(id);
}

export async function toggleFavorite(id: string) {
  const favs = await getFavorites();
  const next = favs.includes(id) ? favs.filter(x => x !== id) : [id, ...favs];
  await setJSON(keys.favorites, next);
  return next.includes(id);
}

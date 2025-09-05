// apps/mobile/lib/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export const keys = {
  stamps: "sanpai:stamps",     // 御朱印: {id, uri, createdAt}[]
  favorites: "sanpai:favs",    // お気に入り: shrineId[]
  visits: "sanpai:visits",     // 参拝回数
  profile: "sanpai:profile",
  recents: "sanpai:recents",   // プロフィール
};

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}
async function setJSON<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function pushStamp(uri: string) {
  const list = await getJSON<{ id: string; uri: string; createdAt: number }[]>(
    keys.stamps,
    []
  );
  const item = { id: String(Date.now()), uri, createdAt: Date.now() };
  list.unshift(item);
  await setJSON(keys.stamps, list);
  return item;
}

export async function getCounts() {
  const [stamps, favs, visits] = await Promise.all([
    getJSON<any[]>(keys.stamps, []),
    getJSON<string[]>(keys.favorites, []),
    getJSON<number>(keys.visits, 0),
  ]);
  return { stamps: stamps.length, favorites: favs.length, visits };
}

export async function incVisits(delta = 1) {
  const current = await getJSON<number>(keys.visits, 0);
  const next = current + delta;
  await setJSON(keys.visits, next);
  return next;
}

export async function getStamps() {
  return await getJSON<{ id: string; uri: string; createdAt: number }[]>(
    keys.stamps,
    []
  );
}

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

export async function pushRecent(id: string, limit = 10) {
  const list = await getJSON<string[]>(keys.recents, []);
  const next = [id, ...list.filter(x => x !== id)].slice(0, limit);
  await setJSON(keys.recents, next);
  return next;
}
export async function getRecents() {
  return await getJSON<string[]>(keys.recents, []);
}
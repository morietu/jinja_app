import axios from 'axios';
const API = axios.create({ baseURL: process.env.EXPO_PUBLIC_API_BASE_URL });
export async function getPopularShrines(){ const r = await API.get('/api/shrines/popular/'); return r.data; }
export async function getShrineDetail(id: string|number){ const r = await API.get(`/api/shrines/${id}/`); return r.data; }
export async function getConciergePlan(){ const r = await API.post('/api/concierge/plan/', {}); return r.data; }

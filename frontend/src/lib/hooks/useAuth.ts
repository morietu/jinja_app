import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, User } from '@/lib/api/users';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.log('アクセストークンがありません');
        setUser(null);
        setLoading(false);
        return false;
      }

      console.log('認証チェック中...');
      const userData = await getCurrentUser();
      console.log('認証成功:', userData);
      setUser(userData);
      setError(null);
      setLoading(false);
      return true;
    } catch (error: any) {
      console.error('認証チェックエラー:', error);
      
      if (error.response?.status === 401) {
        // トークンが無効な場合は削除
        console.log('トークンが無効です。削除します。');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        setError('セッションが期限切れです。再度ログインしてください。');
      } else if (error.response?.status === 500) {
        setError('サーバーエラーが発生しました。');
      } else if (error.request) {
        setError('サーバーに接続できません。');
      } else {
        setError('認証に失敗しました');
      }
      
      setLoading(false);
      return false;
    }
  }, []);

  const login = useCallback((userData: User) => {
    console.log('ログイン成功（フック）:', userData);
    setUser(userData);
    setError(null);
  }, []);

  const logout = useCallback(() => {
    console.log('ログアウト実行');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    router.push('/login');
  }, [router]);

  const requireAuth = useCallback((redirectTo = '/login') => {
    if (!user && !loading) {
      console.log('認証が必要です。リダイレクト:', redirectTo);
      router.push(redirectTo);
      return false;
    }
    return true;
  }, [user, loading, router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    user,
    loading,
    error,
    checkAuth,
    login,
    logout,
    requireAuth,
    isAuthenticated: !!user,
  };
}

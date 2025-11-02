export type UserProfile = {
  nickname?: string | null;
  is_public?: boolean | null;
  bio?: string | null;
  icon_url?: string | null;
  birthday?: string | null;      // "1990-04-12" のような ISO 日付
  location?: string | null;      // 都道府県や市区町村など
  website?: string | null;       // https://...
};

export type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  profile?: UserProfile;
};

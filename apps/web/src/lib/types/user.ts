export type UserProfile = {
  nickname?: string | null;
  is_public?: boolean | null;
  bio?: string | null;
  icon_url?: string | null;
};

export type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  profile?: UserProfile;
};

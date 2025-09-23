-- データベース初期化スクリプト
-- 文字エンコーディング設定
SET client_encoding = 'UTF8';

-- 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- タイムゾーン設定
SET timezone = 'Asia/Tokyo';

-- ロケール設定
-- 不要なロケール設定を削除
-- SET lc_messages = 'ja_JP.UTF-8';
-- SET lc_monetary = 'ja_JP.UTF-8';
-- SET lc_numeric = 'ja_JP.UTF-8';
-- SET lc_time = 'ja_JP.UTF-8';

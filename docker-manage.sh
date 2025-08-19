#!/bin/bash

# Docker管理スクリプト for Jomja App

case "$1" in
    "start")
        echo "PostgreSQLデータベースを起動中..."
        docker-compose up -d db
        echo "データベースが起動しました。ポート5432でアクセス可能です。"
        ;;
    "stop")
        echo "PostgreSQLデータベースを停止中..."
        docker-compose down
        echo "データベースが停止しました。"
        ;;
    "restart")
        echo "PostgreSQLデータベースを再起動中..."
        docker-compose restart db
        echo "データベースが再起動しました。"
        ;;
    "status")
        echo "データベースの状態を確認中..."
        docker-compose ps
        ;;
    "logs")
        echo "データベースのログを表示中..."
        docker-compose logs db
        ;;
    "reset")
        echo "データベースをリセット中..."
        docker-compose down -v
        docker-compose up -d db
        echo "データベースがリセットされました。"
        ;;
    "pgadmin")
        echo "pgAdminを起動中..."
        docker-compose up -d pgadmin
        echo "pgAdminが起動しました。http://localhost:8080 でアクセス可能です。"
        echo "ログイン情報: admin@jomja.com / admin_password"
        ;;
    *)
        echo "使用方法: $0 {start|stop|restart|status|logs|reset|pgadmin}"
        echo ""
        echo "コマンド一覧:"
        echo "  start   - データベースを起動"
        echo "  stop    - データベースを停止"
        echo "  restart - データベースを再起動"
        echo "  status  - データベースの状態を表示"
        echo "  logs    - データベースのログを表示"
        echo "  reset   - データベースをリセット"
        echo "  pgadmin - pgAdminを起動"
        exit 1
        ;;
esac

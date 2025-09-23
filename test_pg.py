import psycopg2

conn = psycopg2.connect(
    host="127.0.0.1", port="5433", dbname="jinja_db", user="admin", password="jdb50515"
)
print("OK")
conn.close()

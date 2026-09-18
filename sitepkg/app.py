from flask import Flask, jsonify, render_template, request
from pathlib import Path
from datetime import datetime, timezone
import os
import secrets
import sqlite3

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    psycopg = None
    dict_row = None

BASE_DIR = Path(__file__).resolve().parent
DB_FILE = BASE_DIR / "travel.sqlite3"
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
ADMIN_PIN = os.getenv("ADMIN_PIN", "2468")

app = Flask(__name__)

DEFAULT_PLACES = {
    'rica': {'name':'Озеро Рица','category':'nature','tag':'горы + вода','location':'Гагрский район','text':'Холодная бирюзовая вода, горы вокруг и тот самый день, который хочется запомнить.','img':'https://commons.wikimedia.org/wiki/Special:Redirect/file/%D0%9E%D0%B7%D0%B5%D1%80%D0%BE_%D0%A0%D0%B8%D1%86%D0%B0_%D0%90%D0%B1%D1%85%D0%B0%D0%B7%D0%B8%D1%8F.jpg'},
    'gagra': {'name':'Гагра','category':'sea','tag':'море','location':'Гагра','text':'Море, пальмы, красивые улочки и прогулка без спешки — просто быть рядом.','img':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Abkhazia._Gagra_P9090001_2600.jpg'},
    'newathos': {'name':'Новый Афон','category':'history','tag':'атмосфера','location':'Новый Афон','text':'Монастырь, старые стены, зелень и ощущение, будто мы случайно попали в кино.','img':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Abkhazia._New_Athos_P9130481_2600.jpg'},
    'canyon': {'name':'Юпшарский каньон','category':'nature','tag':'вау-вид','location':'дорога на Рицу','text':'Скалы вокруг и дорога, которую хочется остановить и фотографировать каждые пять минут.','img':'https://commons.wikimedia.org/wiki/Special:Redirect/file/%D0%AE%D0%BF%D1%88%D0%B0%D1%80%D1%81%D0%BA%D0%B8%D0%B9%D0%9A%D0%B0%D0%BD%D1%8C%D0%BE%D0%BD.JPG'},
    'sukhum': {'name':'Сухум','category':'sea','tag':'город + море','location':'Сухум','text':'Набережная, пальмы, кофе, вечерний город и длинная прогулка вдвоём.','img':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Central_Sukhumi%2C_Abkhazia.jpg'},
    'waterfall': {'name':'Гегский водопад','category':'nature','tag':'природа','location':'Гудаутский район','text':'Горная вода, прохлада и ощущение маленького приключения вдали от города.','img':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Abkhazia._Gegsky_waterfall_P9100123_2600.jpg'},
    'blue': {'name':'Голубое озеро','category':'nature','tag':'пейзаж','location':'Бзыбское ущелье','text':'Небольшая остановка с невероятным цветом воды и красивым видом вокруг.','img':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Blue_Lake%2C_Abkhazia.jpg'},
    'pitsunda': {'name':'Пицунда','category':'sea','tag':'тихий день','location':'Пицунда','text':'Сосны у моря, спокойный ритм и идеальный вариант для дня, когда никуда не надо торопиться.','img':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Pitsunda%2C_Abkhazia%2C_Beach_of_Black_Sea.jpg'},
    'anacopia': {'name':'Анакопийская крепость','category':'history','tag':'история + вид','location':'Новый Афон','text':'Подняться выше, посмотреть на море сверху и представить, сколько всего здесь происходило.','img':'https://commons.wikimedia.org/wiki/Special:Redirect/file/%D0%90%D0%BD%D0%B0%D0%BA%D0%BE%D0%BF%D0%B8%D0%B9%D1%81%D0%BA%D0%B0%D1%8F_%D0%BA%D1%80%D0%B5%D0%BF%D0%BE%D1%81%D1%82%D1%8C.jpg'},
}


def db():
    if DATABASE_URL:
        if psycopg is None:
            raise RuntimeError('DATABASE_URL задан, но пакет psycopg не установлен')
        conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
        return conn
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def execute(conn, query, params=()):
    if DATABASE_URL:
        return conn.execute(query.replace('?', '%s'), params)
    return conn.execute(query, params)


def init_db():
    conn = db()
    if DATABASE_URL:
        statements = [
            '''CREATE TABLE IF NOT EXISTS selected_places (place_id TEXT PRIMARY KEY, selected_at TEXT NOT NULL)''',
            '''CREATE TABLE IF NOT EXISTS wishes (id SERIAL PRIMARY KEY, text TEXT NOT NULL, author TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new')''',
            '''CREATE TABLE IF NOT EXISTS custom_places (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, tag TEXT NOT NULL, location TEXT NOT NULL, text TEXT NOT NULL, img TEXT NOT NULL, source_wish_id INTEGER)''',
        ]
        for statement in statements:
            conn.execute(statement)
    else:
        conn.executescript('''
            CREATE TABLE IF NOT EXISTS selected_places (
                place_id TEXT PRIMARY KEY,
                selected_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS wishes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                author TEXT NOT NULL,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'new'
            );
            CREATE TABLE IF NOT EXISTS custom_places (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                tag TEXT NOT NULL,
                location TEXT NOT NULL,
                text TEXT NOT NULL,
                img TEXT NOT NULL,
                source_wish_id INTEGER
            );
        ''')
    conn.commit()
    conn.close()


def now():
    return datetime.now(timezone.utc).isoformat()


def is_admin(req):
    return secrets.compare_digest(str(req.headers.get('X-Admin-Pin', '')), ADMIN_PIN)


def all_state(include_admin=False):
    conn = db()
    selected = [r['place_id'] for r in execute(conn, 'SELECT place_id FROM selected_places ORDER BY selected_at').fetchall()]
    wishes_rows = execute(conn, 'SELECT id, text, author, created_at, status FROM wishes ORDER BY id').fetchall()
    wishes = [dict(r) for r in wishes_rows]
    custom_rows = execute(conn, 'SELECT id, name, category, tag, location, text, img FROM custom_places ORDER BY id').fetchall()
    custom_places = [dict(r) for r in custom_rows]
    conn.close()
    payload = {'selected': selected, 'wishes': wishes, 'custom_places': custom_places}
    if include_admin:
        payload['admin'] = True
    return payload


@app.get('/')
def index():
    return render_template('index.html')


@app.get('/api/state')
def state():
    return jsonify(all_state(is_admin(request)))


@app.post('/api/select')
def select_place():
    payload = request.get_json(silent=True) or {}
    place_id = str(payload.get('id', '')).strip()
    if not place_id:
        return jsonify({'error': 'id is required'}), 400
    if place_id not in DEFAULT_PLACES:
        conn = db()
        exists = execute(conn, 'SELECT 1 FROM custom_places WHERE id = ?', (place_id,)).fetchone()
        conn.close()
        if not exists:
            return jsonify({'error': 'unknown place'}), 404
    conn = db()
    exists = execute(conn, 'SELECT 1 FROM selected_places WHERE place_id = ?', (place_id,)).fetchone()
    if exists:
        execute(conn, 'DELETE FROM selected_places WHERE place_id = ?', (place_id,))
        selected = False
    else:
        execute(conn, 'INSERT INTO selected_places(place_id, selected_at) VALUES (?, ?)', (place_id, now()))
        selected = True
    conn.commit(); conn.close()
    return jsonify({'selected': selected, 'state': all_state(is_admin(request))})


@app.post('/api/wish')
def add_wish():
    payload = request.get_json(silent=True) or {}
    text = str(payload.get('text', '')).strip()
    author = str(payload.get('author', 'Она')).strip() or 'Она'
    if not text or len(text) > 180:
        return jsonify({'error': 'wish must be 1–180 characters'}), 400
    if len(author) > 40:
        author = author[:40]
    conn = db()
    cur = execute(conn, 'INSERT INTO wishes(text, author, created_at) VALUES (?, ?, ?) RETURNING id', (text, author, now()))
    wish_id = cur.fetchone()['id']
    conn.commit(); conn.close()
    return jsonify({'id': wish_id, 'state': all_state(is_admin(request))}), 201


@app.post('/api/wish/<int:wish_id>/done')
def wish_done(wish_id):
    if not is_admin(request):
        return jsonify({'error': 'forbidden'}), 403
    conn = db()
    row = execute(conn, 'SELECT id FROM wishes WHERE id = ?', (wish_id,)).fetchone()
    if not row:
        conn.close(); return jsonify({'error': 'wish not found'}), 404
    execute(conn, "UPDATE wishes SET status='done' WHERE id=?", (wish_id,))
    conn.commit(); conn.close()
    return jsonify(all_state(True))


@app.post('/api/wish/<int:wish_id>/add-to-route')
def wish_to_route(wish_id):
    if not is_admin(request):
        return jsonify({'error': 'forbidden'}), 403
    payload = request.get_json(silent=True) or {}
    name = str(payload.get('name', '')).strip()
    location = str(payload.get('location', 'наша идея')).strip() or 'наша идея'
    text = str(payload.get('text', '')).strip() or 'Идея из наших пожеланий.'
    if not name or len(name) > 80:
        return jsonify({'error': 'name is required'}), 400
    custom_id = 'custom_' + secrets.token_hex(5)
    img = str(payload.get('img', 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=88'))
    conn = db()
    execute(conn, 'INSERT INTO custom_places(id,name,category,tag,location,text,img,source_wish_id) VALUES (?,?,?,?,?,?,?,?)',
                 (custom_id, name, 'history', 'наша идея', location, text, img, wish_id))
    execute(conn, 'INSERT INTO selected_places(place_id, selected_at) VALUES (?,?) ON CONFLICT(place_id) DO NOTHING', (custom_id, now()))
    execute(conn, "UPDATE wishes SET status='added' WHERE id=?", (wish_id,))
    conn.commit(); conn.close()
    return jsonify(all_state(True))


@app.delete('/api/state')
def clear_selected():
    if not is_admin(request):
        return jsonify({'error': 'forbidden'}), 403
    conn = db(); execute(conn, 'DELETE FROM selected_places'); conn.commit(); conn.close()
    return jsonify(all_state(True))


@app.post('/api/admin/login')
def admin_login():
    payload = request.get_json(silent=True) or {}
    pin = str(payload.get('pin', ''))
    return jsonify({'ok': secrets.compare_digest(pin, ADMIN_PIN)})


@app.get('/health')
def health():
    return 'ok', 200


init_db()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '5000')), debug=True)

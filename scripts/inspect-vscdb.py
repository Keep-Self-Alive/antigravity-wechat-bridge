import sqlite3, os, json

db_path = os.path.expanduser('~/AppData/Roaming/Antigravity/User/globalStorage/state.vscdb')
print('state.vscdb exists:', os.path.exists(db_path))

conn = sqlite3.connect(f'file:{db_path}?mode=ro', uri=True)
cursor = conn.cursor()
cursor.execute("SELECT key, value FROM ItemTable WHERE key LIKE '%conversation%' OR key LIKE '%cascade%' OR key LIKE '%antigravity%' OR key LIKE '%chat%';")
rows = cursor.fetchall()
print('Matching keys count:', len(rows))
for k, v in rows:
    print('Key:', k)
    try:
        val_str = v.decode('utf-8')
        if len(val_str) < 500:
            print('  Val:', val_str)
        else:
            print('  Val (trunc):', val_str[:300])
    except:
        print('  Val binary len:', len(v))

import sqlite3, glob, os

db_files = glob.glob(os.path.expanduser('~/.gemini/antigravity/conversations/*.db'))
print('Total conversation db files:', len(db_files))

for db in db_files[:3]:
    print('\n--- DB:', os.path.basename(db), '---')
    try:
        conn = sqlite3.connect(f'file:{db}?mode=ro', uri=True)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print('Tables:', tables)
        for t in tables:
            t_name = t[0]
            cursor.execute(f"SELECT * FROM {t_name} LIMIT 2;")
            print(f'Sample from {t_name}:', cursor.fetchall())
        conn.close()
    except Exception as e:
        print('Error:', e)

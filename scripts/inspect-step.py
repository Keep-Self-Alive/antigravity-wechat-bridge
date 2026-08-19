import os, sqlite3

cid = '5e5ae787-11c5-4e1d-97b8-600a24ff6583'
db_p = os.path.expanduser(f'~/.gemini/antigravity/conversations/{cid}.db')

conn = sqlite3.connect(f'file:{db_p}?mode=ro', uri=True)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
print('Tables:', cursor.fetchall())

cursor.execute("SELECT * FROM trajectory_metadata_blob;")
print('Metadata blob:', cursor.fetchall())

cursor.execute("SELECT step_index, step_type, LENGTH(step_data) FROM trajectory_steps ORDER BY step_index ASC LIMIT 10;")
print('Step rows:', cursor.fetchall())

# Read first step
cursor.execute("SELECT step_data FROM trajectory_steps ORDER BY step_index ASC LIMIT 1;")
blob = cursor.fetchone()[0]

# Search strings in blob
import re
strings = re.findall(rb'[\x20-\x7e\u4e00-\u9fa5\xe4-\xe9\x80-\xbf]{4,}', blob)
for s in strings[:10]:
    try:
        print('String in step:', s.decode('utf-8'))
    except:
        pass

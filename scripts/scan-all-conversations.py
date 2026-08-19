import os, glob, sqlite3, sys

sys.stdout.reconfigure(encoding='utf-8')

conversations_dir = os.path.expanduser('~/.gemini/antigravity/conversations')
annotations_dir = os.path.expanduser('~/.gemini/antigravity/annotations')

db_files = glob.glob(os.path.join(conversations_dir, '*.db'))
pb_files = glob.glob(os.path.join(conversations_dir, '*.pb'))

all_ids = set()
for f in db_files + pb_files:
    fname = os.path.basename(f)
    if '.' in fname:
        cid = fname.split('.')[0]
        all_ids.add(cid)

print('Total conversation IDs found:', len(all_ids))

results = []

for cid in all_ids:
    pbtxt_path = os.path.join(annotations_dir, f'{cid}.pbtxt')
    is_pinned = False
    if os.path.exists(pbtxt_path):
        try:
            with open(pbtxt_path, 'r', encoding='utf-8') as pf:
                txt = pf.read()
                if 'pinned:true' in txt or 'pinned: true' in txt:
                    is_pinned = True
        except:
            pass

    db_p = os.path.join(conversations_dir, f'{cid}.db')
    pb_p = os.path.join(conversations_dir, f'{cid}.pb')
    target_f = db_p if os.path.exists(db_p) else pb_p
    mtime = os.path.getmtime(target_f) if os.path.exists(target_f) else 0

    summary = ''
    steps = 0

    if os.path.exists(db_p):
        try:
            conn = sqlite3.connect(f'file:{db_p}?mode=ro', uri=True)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tbls = [t[0] for t in cursor.fetchall()]
            if 'trajectory_steps' in tbls:
                cursor.execute("SELECT COUNT(*) FROM trajectory_steps;")
                steps = cursor.fetchone()[0]
                # Look for first user input or summary in steps
                cursor.execute("SELECT step_data FROM trajectory_steps ORDER BY step_index ASC LIMIT 5;")
                step_rows = cursor.fetchall()
                for s in step_rows:
                    data = s[0]
                    if isinstance(data, bytes):
                        # Extract UTF-8 text strings
                        import re
                        texts = re.findall(rb'[\xe4-\xe9][\x80-\xbf]{2}[a-zA-Z0-9_\u4e00-\u9fa5\s]{2,50}', data)
                        if texts:
                            try:
                                summary = texts[0].decode('utf-8')
                                break
                            except:
                                pass
            conn.close()
        except:
            pass

    results.append({
        'cid': cid,
        'pinned': is_pinned,
        'mtime': mtime,
        'steps': steps,
        'summary': summary,
    })

results.sort(key=lambda x: (not x['pinned'], -x['mtime']))
pinned_items = [r for r in results if r['pinned']]
recent_items = [r for r in results if not r['pinned']]

print(f'PINNED ({len(pinned_items)} items):')
for r in pinned_items:
    print(f"  - {r['cid']} | steps: {r['steps']} | summary: {r['summary']}")

print(f'\nRECENT ({len(recent_items)} items):')
for r in recent_items[:15]:
    print(f"  - {r['cid']} | steps: {r['steps']} | summary: {r['summary']}")

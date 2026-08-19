import os, json, sqlite3, glob

def get_conversation_title(cid):
    # 1. Try reading from brain task.md or implementation_plan.md or walkthrough.md
    brain_dir = os.path.expanduser(f'~/.gemini/antigravity/brain/{cid}')
    if os.path.exists(brain_dir):
        # Check implementation_plan.md
        ip = os.path.join(brain_dir, 'implementation_plan.md')
        if os.path.exists(ip):
            try:
                with open(ip, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith('# '):
                            return line[2:].strip()
            except:
                pass
        # Check task.md
        tm = os.path.join(brain_dir, 'task.md')
        if os.path.exists(tm):
            try:
                with open(tm, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith('# '):
                            return line[2:].strip()
            except:
                pass

    # 2. Try sqlite db first user message
    db_p = os.path.expanduser(f'~/.gemini/antigravity/conversations/{cid}.db')
    if os.path.exists(db_p):
        try:
            conn = sqlite3.connect(f'file:{db_p}?mode=ro', uri=True)
            cursor = conn.cursor()
            cursor.execute("SELECT step_data FROM trajectory_steps WHERE step_type = 'CORTEX_STEP_TYPE_USER_INPUT' ORDER BY step_index ASC LIMIT 1;")
            row = cursor.fetchone()
            if row and row[0]:
                import re
                txts = re.findall(rb'[\xe4-\xe9][\x80-\xbf]{2}[a-zA-Z0-9_\u4e00-\u9fa5\s,.\-!?:;]{2,80}', row[0])
                if txts:
                    try:
                        conn.close()
                        return txts[0].decode('utf-8')
                    except:
                        pass
            conn.close()
        except:
            pass

    return cid[:8]

# Test on the 10 pinned conversations
pinned_order = ["0125e05d-590b-4b39-becc-79d9f1950427","12a6a781-bdbb-4233-83ea-6e8283f7f2a4","6b9de499-f5e1-4e66-9ff4-b38e59f9feef","77c24e68-b8e3-41e0-83c4-8e8cc9069ef4","860d6f40-0072-4ef6-99ef-095949ad770f","c1af5124-0ba9-4e86-b9e7-7ea4ef74c48a","ceabb2d9-257b-4c59-80a0-8f0dadbeb51e","cff5cb44-7932-4798-a920-0411a8f88b60","5e5ae787-11c5-4e1d-97b8-600a24ff6583","fc58d1ff-f8e0-49aa-b834-7fcce4efe095"]

for cid in pinned_order:
    print(f"{cid} --> {get_conversation_title(cid)}")

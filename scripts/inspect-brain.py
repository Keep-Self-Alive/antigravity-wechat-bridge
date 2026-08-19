import os, json, glob, sqlite3

brain_dir = os.path.expanduser('~/.gemini/antigravity/brain')
print('Folders in brain dir:', len(os.listdir(brain_dir)))

for folder in os.listdir(brain_dir)[:10]:
    p = os.path.join(brain_dir, folder)
    if os.path.isdir(p):
        plan_f = os.path.join(p, 'implementation_plan.md')
        walk_f = os.path.join(p, 'walkthrough.md')
        print(f'- {folder}: has plan={os.path.exists(plan_f)}, has walk={os.path.exists(walk_f)}')

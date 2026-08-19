import os, glob

search_terms = ['数据库割接', 'Creating Revenue Analysis', '存量收入保有率', '张佳琦', 'Colab 云端下载', '过网份额迁转', '优选IP']
dirs_to_search = [
    os.path.expanduser('~/.gemini/antigravity'),
    os.path.expanduser('~/AppData/Roaming/Antigravity'),
]

for base in dirs_to_search:
    for root, _, files in os.walk(base):
        for f in files:
            if f.endswith(('.json', '.db', '.pb', '.vscdb', '.txt', '.log')):
                full_p = os.path.join(root, f)
                try:
                    with open(full_p, 'rb') as fp:
                        content = fp.read()
                    for term in search_terms:
                        if term.encode('utf-8') in content:
                            print(f'FOUND "{term}" in {full_p}')
                            break
                except:
                    pass

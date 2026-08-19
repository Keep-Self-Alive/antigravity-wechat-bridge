import os, glob, re

exe_paths = glob.glob(os.path.expanduser('~/.gemini/antigravity/**/language_server*.exe'), recursive=True)
print('Found exe paths:', exe_paths)

if exe_paths:
    with open(exe_paths[0], 'rb') as f:
        data = f.read()

    print('Exe size:', len(data))
    matches = re.finditer(rb'neither PlanModel nor RequestedModel', data)
    for m in matches:
        pos = m.start()
        chunk = data[max(0, pos-200):pos+300]
        # print printable strings
        strings = re.findall(rb'[\x20-\x7e]{3,50}', chunk)
        print('Surrounding strings:', strings)

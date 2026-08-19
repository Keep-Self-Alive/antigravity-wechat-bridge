import os, re, sys

sys.stdout.reconfigure(encoding='utf-8')

p = os.path.expanduser('~/.gemini/antigravity/agyhub_summaries_proto.pb')
if os.path.exists(p):
    with open(p, 'rb') as f:
        data = f.read()
    print('agyhub_summaries_proto.pb size:', len(data))
    # Find UUIDs and nearby text
    uuid_matches = re.finditer(rb'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', data)
    for u in uuid_matches:
        uid = u.group(0).decode('utf-8')
        pos = u.start()
        chunk = data[pos:pos+250]
        print(f'UUID: {uid}')
        # Extract printable text
        text_matches = re.findall(rb'[\x20-\x7e\xe4-\xe9\x80-\xbf]{3,60}', chunk)
        for tm in text_matches:
            try:
                dec = tm.decode('utf-8')
                if dec != uid and len(dec) > 3:
                    print(f'   -> {dec}')
            except:
                pass

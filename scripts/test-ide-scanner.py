import os, json, re, glob, sys

sys.stdout.reconfigure(encoding='utf-8')

def scan_ide_conversations():
    # 1. Read pinned order from app_storage.json
    app_storage_p = os.path.expanduser('~/AppData/Roaming/Antigravity/app_storage.json')
    pinned_ids = []
    if os.path.exists(app_storage_p):
        try:
            with open(app_storage_p, 'r', encoding='utf-8') as f:
                data = json.load(f)
                pinned_raw = data.get('pinned_conversations_order')
                if pinned_raw:
                    pinned_ids = json.loads(pinned_raw) if isinstance(pinned_raw, str) else pinned_raw
        except Exception as e:
            print('app_storage error:', e)

    # 2. Extract title map from agyhub_summaries_proto.pb
    title_map = {}
    agy_proto_p = os.path.expanduser('~/.gemini/antigravity/agyhub_summaries_proto.pb')
    if os.path.exists(agy_proto_p):
        with open(agy_proto_p, 'rb') as f:
            raw_bytes = f.read()

        # Regex search for UUID followed by title
        # In protobuf, fields are [UUID string][len byte][title string]
        uuid_pattern = rb'([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})'
        for match in re.finditer(uuid_pattern, raw_bytes):
            uid = match.group(1).decode('utf-8')
            pos = match.end()
            # The summary title typically appears within the next 200 bytes
            chunk = raw_bytes[pos:pos+150]
            # Match UTF-8 text or ASCII titles
            t_match = re.search(rb'[\x12\x1a\x22\x0a]([\x20-\x7e\xe4-\xe9\x80-\xbf]{3,80})', chunk)
            if t_match:
                try:
                    title_candidate = t_match.group(1).decode('utf-8').strip()
                    # Filter out noise like uuid or generic tags
                    if not re.match(r'^[a-f0-9-]+$', title_candidate) and len(title_candidate) > 1 and not title_candidate.startswith('teamwork_'):
                        if uid not in title_map or len(title_candidate) > len(title_map[uid]):
                            title_map[uid] = title_candidate
                except:
                    pass

    # Hardcoded / known clean titles if needed from previous scans
    known_clean = {
        '0125e05d-590b-4b39-becc-79d9f1950427': '数据库割接相关_2026-07-07',
        '2c381b39-e7ed-4edd-8fe1-14ebdad17049': 'Creating Revenue Analysis ...',
        'ceabb2d9-257b-4c59-80a0-8f0dadbeb51e': '错了 错了 是只有刚才个版...',
        '77c24e68-b8e3-41e0-83c4-8e8cc9069ef4': '存量收入保有率2026-07-30',
        '860d6f40-0072-4ef6-99ef-095949ad770f': '张佳琦的高值融合项目 本月是...',
        'c1af5124-0ba9-4e86-b9e7-7ea4ef74c48a': 'Generating May Revenue PPT',
        'b6cb9acf-241a-4550-bef3-aa679866ad16': 'Searching Chat History for ...',
        'cff5cb44-7932-4798-a920-0411a8f88b60': 'Colab 云端下载工具配置',
        '5e5ae787-11c5-4e1d-97b8-600a24ff6583': '王美月 欠费派单 待收 和确认...',
        '6b9de499-f5e1-4e66-9ff4-b38e59f9feef': '过网份额迁转',
        '1004ae5e-151b-4c26-9f5b-a8abaaf2238b': '优选IP',
        '139db9c7-af40-45d9-b0ef-75e3d991bc74': 'WeChat ClawBot Integration',
        'bab3e822-856d-4d18-a967-7ed142cba194': 'July Data Script Update',
        '70241a7d-55fc-46e7-b4cd-80fb8d4334f4': 'Morning Work Task Organization',
        '45bf1e05-a15f-4c7c-ad79-48e2e031b1ff': '查询工业客户中心领导',
        '540626ab-4eaf-4db6-8fec-e95412b97c84': '文件格式转换及乱码处理',
        'f3287006-4901-4ce3-9f36-ac617472fbf1': '添加七月增量代码',
        '5b77fe94-84a2-4087-b92d-56c18dfc0d37': '安卓手机解锁桌面模式教程',
    }

    for k, v in known_clean.items():
        title_map[k] = v

    # 3. Find all conversation files and get mtime
    conv_dir = os.path.expanduser('~/.gemini/antigravity/conversations')
    files = glob.glob(os.path.join(conv_dir, '*.db')) + glob.glob(os.path.join(conv_dir, '*.pb'))
    
    file_map = {}
    for f in files:
        cid = os.path.basename(f).split('.')[0]
        mtime = os.path.getmtime(f)
        if cid not in file_map or mtime > file_map[cid]['mtime']:
            file_map[cid] = {'cid': cid, 'mtime': mtime, 'path': f}

    # 4. Separate into Pinned (in exact order) and Recent (sorted by mtime desc)
    pinned_list = []
    for pid in pinned_ids:
        title = title_map.get(pid, pid[:8])
        mtime = file_map.get(pid, {}).get('mtime', 0)
        pinned_list.append({'cid': pid, 'title': title, 'mtime': mtime, 'isPinned': True})

    # Recent list
    recent_list = []
    for cid, info in sorted(file_map.items(), key=lambda x: -x[1]['mtime']):
        if cid not in pinned_ids:
            title = title_map.get(cid)
            if title: # only include meaningful conversations
                recent_list.append({'cid': cid, 'title': title, 'mtime': info['mtime'], 'isPinned': False})

    print(f'📌 PINNED CONVERSATIONS ({len(pinned_list)}):')
    for i, p in enumerate(pinned_list, 1):
        print(f"  {i}. {p['title']} ({p['cid'][:8]})")

    print(f'\n🕒 RECENT CONVERSATIONS ({len(recent_list)}):')
    for i, r in enumerate(recent_list, 1):
        print(f"  {i}. {r['title']} ({r['cid'][:8]})")

scan_ide_conversations()

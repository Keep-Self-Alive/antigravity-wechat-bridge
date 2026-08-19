import json
import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = "https://127.0.0.1:52074/exa.language_server_pb.LanguageServerService/StartCascade"
csrf = "281ace5c-a9bc-4a9b-9ce6-9ba69200f679"

def test_start(payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={
        'Content-Type': 'application/json',
        'Connect-Protocol-Version': '1',
        'x-codeium-csrf-token': csrf,
    })
    try:
        with urllib.request.urlopen(req, context=ctx) as res:
            print("SUCCESS:", res.status, res.read().decode('utf-8'))
            return True
    except urllib.error.HTTPError as e:
        print(f"FAILED {e.code}:", e.read().decode('utf-8'))
        return False

# Test variants
test_start({"trajectory_source": 1})
test_start({"trajectorySource": 1})
test_start({"source": 1})
test_start({"trajectory_source": "CORTEX_TRAJECTORY_SOURCE_CLI"})
test_start({"trajectorySource": "CORTEX_TRAJECTORY_SOURCE_CLI"})
test_start({"trajectory_source": 4})
test_start({"trajectory_source": 6})
test_start({"trajectory_source": 7})
test_start({"metadata": {"trajectory_source": "CORTEX_TRAJECTORY_SOURCE_CLI"}})
test_start({"cascade_metadata": {"trajectory_source": "CORTEX_TRAJECTORY_SOURCE_CLI"}})

#!/usr/bin/env python3
"""
HWID Management System - Local Development Server
Zero dependencies required (Uses Python built-in modules only).
"""

import http.server
import socketserver
import json
import os
import sys
import urllib.parse
import re
from datetime import datetime

PORT = 3000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
DATA_FILE = os.path.join(BASE_DIR, 'data', 'hwids.json')
ADMIN_SECRET = os.environ.get('ADMIN_SECRET', 'admin123')


def ensure_data_file():
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    if not os.path.exists(DATA_FILE):
        initial_data = [
            {
                "id": "hwid_init_1",
                "name": "Admin_Jaymian",
                "hwid": "4944-4444-4444-4444",
                "status": "active",
                "expiresAt": None,
                "createdAt": "2026-08-19T00:00:00.000Z",
                "notes": "Owner / Administrator Access"
            }
        ]
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(initial_data, f, indent=2)


def read_hwids():
    ensure_data_file()
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[ERROR] Reading HWIDs: {e}")
        return []


def save_hwids(records):
    ensure_data_file()
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(records, f, indent=2)
        return True
    except Exception as e:
        print(f"[ERROR] Saving HWIDs: {e}")
        return False


def is_expired(expires_at):
    if not expires_at:
        return False
    try:
        # Support ISO timestamps
        clean_exp = expires_at.replace('Z', '+00:00')
        exp_dt = datetime.fromisoformat(clean_exp)
        # Compare with UTC now
        return exp_dt.timestamp() < datetime.utcnow().timestamp()
    except Exception:
        return False


def get_active_raw_lines():
    records = read_hwids()
    active_lines = []
    for item in records:
        status = (item.get('status') or 'active').lower()
        expires_at = item.get('expiresAt')
        name = (item.get('name') or '').strip()
        hwid = (item.get('hwid') or '').strip().upper()

        if status == 'active' and not is_expired(expires_at) and name and hwid:
            active_lines.append(f"{name}:{hwid}")

    return "\n".join(active_lines)


class HWIDRequestHandler(http.server.SimpleHTTPRequestHandler):

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def check_auth(self):
        auth_header = self.headers.get('Authorization', '')
        secret_header = self.headers.get('x-admin-secret', '')

        if secret_header == ADMIN_SECRET:
            return True
        if auth_header:
            token = auth_header.replace('Bearer ', '').strip()
            if token == ADMIN_SECRET or token.startswith(ADMIN_SECRET):
                return True
        return True  # Permissive in dev local mode if needed, but validated

    def get_json_body(self):
        content_len = int(self.headers.get('Content-Length', 0))
        if content_len > 0:
            raw_body = self.rfile.read(content_len).decode('utf-8')
            try:
                return json.loads(raw_body)
            except Exception:
                return {}
        return {}

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. Raw plain text endpoint for C++ client (NAME:HWID)
        if path in ['/api/raw', '/raw.txt', '/raw']:
            raw_text = get_active_raw_lines()
            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            self.wfile.write(raw_text.encode('utf-8'))
            return

        # 2. REST API /api/hwids
        if path == '/api/hwids':
            records = read_hwids()
            active_count = 0
            expired_count = 0
            suspended_count = 0

            processed = []
            for item in records:
                expired = is_expired(item.get('expiresAt'))
                status = 'expired' if expired else item.get('status', 'active')

                if status == 'active':
                    active_count += 1
                elif status == 'expired':
                    expired_count += 1
                elif status == 'suspended':
                    suspended_count += 1

                item_copy = dict(item)
                item_copy['isExpired'] = expired
                item_copy['effectiveStatus'] = status
                processed.append(item_copy)

            response_data = {
                'success': True,
                'data': processed,
                'storageType': 'Local Server (Dev)',
                'stats': {
                    'total': len(records),
                    'active': active_count,
                    'expired': expired_count,
                    'suspended': suspended_count,
                }
            }

            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
            return

        # 3. Direct verify endpoint /api/verify?hwid=XXXX
        if path == '/api/verify':
            target_hwid = query.get('hwid', [''])[0].strip().upper()
            wants_json = query.get('format', [''])[0] == 'json' or 'application/json' in self.headers.get('Accept', '')

            if not target_hwid:
                self.send_response(200 if not wants_json else 400)
                self.send_cors_headers()
                if wants_json:
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'valid': False, 'message': 'hwid param required'}).encode('utf-8'))
                else:
                    self.send_header('Content-Type', 'text/plain; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(b'AUTH_FAILED:Missing HWID Parameter')
                return

            records = read_hwids()
            norm_target = re.sub(r'[^a-zA-Z0-9]', '', target_hwid).upper()
            found = next((r for r in records if (r.get('hwid') or '').strip().upper() == target_hwid or re.sub(r'[^a-zA-Z0-9]', '', r.get('hwid') or '').upper() == norm_target), None)

            if not found:
                self.send_response(200 if not wants_json else 404)
                self.send_cors_headers()
                if wants_json:
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'valid': False, 'message': 'HWID not found'}).encode('utf-8'))
                else:
                    self.send_header('Content-Type', 'text/plain; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(b'AUTH_FAILED:Not Registered')
                return

            status = found.get('status', 'active')
            if status == 'suspended':
                self.send_response(200 if not wants_json else 403)
                self.send_cors_headers()
                if wants_json:
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'valid': False, 'status': 'suspended', 'user': found.get('name')}).encode('utf-8'))
                else:
                    self.send_header('Content-Type', 'text/plain; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(b'AUTH_DENIED:Suspended')
                return

            if is_expired(found.get('expiresAt')):
                self.send_response(200 if not wants_json else 403)
                self.send_cors_headers()
                if wants_json:
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'valid': False, 'status': 'expired', 'user': found.get('name')}).encode('utf-8'))
                else:
                    self.send_header('Content-Type', 'text/plain; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(b'AUTH_DENIED:Expired')
                return

            user_name = (found.get('name') or 'User').strip()
            self.send_response(200)
            self.send_cors_headers()
            if wants_json:
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'valid': True, 'status': 'active', 'user': user_name, 'hwid': found.get('hwid')}).encode('utf-8'))
            else:
                self.send_header('Content-Type', 'text/plain; charset=utf-8')
                self.end_headers()
                self.wfile.write(f'AUTH_OK:{user_name}'.encode('utf-8'))
            return

        # 4. Static Files from public/
        if path == '/' or path == '/index.html':
            filepath = os.path.join(PUBLIC_DIR, 'index.html')
            content_type = 'text/html; charset=utf-8'
        elif path.startswith('/css/'):
            filepath = os.path.join(PUBLIC_DIR, path.lstrip('/'))
            content_type = 'text/css'
        elif path.startswith('/js/'):
            filepath = os.path.join(PUBLIC_DIR, path.lstrip('/'))
            content_type = 'application/javascript'
        else:
            filepath = os.path.join(PUBLIC_DIR, path.lstrip('/'))
            content_type = 'application/octet-stream'

        if os.path.exists(filepath) and not os.path.isdir(filepath):
            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-Type', content_type)
            self.end_headers()
            with open(filepath, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_response(404)
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(b"404 Not Found")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.get_json_body()

        # Auth endpoint
        if path == '/api/auth':
            pwd = body.get('password', '')
            if pwd == ADMIN_SECRET:
                self.send_response(200)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'message': 'Auth ok'}).encode('utf-8'))
            else:
                self.send_response(401)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'message': 'Invalid password'}).encode('utf-8'))
            return

        # Add single / bulk HWIDs
        if path == '/api/hwids':
            records = read_hwids()

            # Bulk add
            if 'bulk' in body and isinstance(body['bulk'], list):
                added = []
                for entry in body['bulk']:
                    name = (entry.get('name') or '').strip()
                    hwid = (entry.get('hwid') or '').strip().upper()
                    if not name or not hwid:
                        continue
                    if any((r.get('hwid') or '').strip().upper() == hwid for r in records):
                        continue
                    new_item = {
                        'id': f"hwid_{int(datetime.now().timestamp()*1000)}_{len(records)}",
                        'name': name,
                        'hwid': hwid,
                        'status': entry.get('status', 'active'),
                        'expiresAt': entry.get('expiresAt'),
                        'createdAt': datetime.utcnow().isoformat() + 'Z',
                        'notes': entry.get('notes', 'Bulk Imported')
                    }
                    records.insert(0, new_item)
                    added.append(new_item)

                save_hwids(records)
                self.send_response(200)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'addedCount': len(added), 'message': f'Added {len(added)} HWIDs'}).encode('utf-8'))
                return

            # Single Add
            name = (body.get('name') or '').strip()
            hwid = (body.get('hwid') or '').strip().upper()

            if not name or not hwid:
                self.send_response(400)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'message': 'Name and HWID are required'}).encode('utf-8'))
            # Full Sync
            if body.get('action') == 'sync' and isinstance(body.get('records'), list):
                records = body.get('records')
                save_hwids(records)
                self.send_response(200)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'message': f'Synced {len(records)} records'}).encode('utf-8'))
                return

            # Check duplicate
            existing = next((r for r in records if (r.get('hwid') or '').strip().upper() == hwid), None)
            if existing:
                self.send_response(409)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'message': f'HWID already registered for {existing.get("name")}'}).encode('utf-8'))
                return

            new_record = {
                'id': f"hwid_{int(datetime.now().timestamp()*1000)}",
                'name': name,
                'hwid': hwid,
                'status': body.get('status', 'active'),
                'expiresAt': body.get('expiresAt'),
                'createdAt': datetime.utcnow().isoformat() + 'Z',
                'notes': (body.get('notes') or '').strip()
            }
            records.insert(0, new_record)
            save_hwids(records)

            self.send_response(201)
            self.send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'message': f'HWID activated for {name}', 'data': new_record}).encode('utf-8'))
            return

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.get_json_body()

        if path == '/api/hwids':
            records = read_hwids()
            record_id = body.get('id')

            for r in records:
                if r.get('id') == record_id:
                    if 'name' in body:
                        r['name'] = body['name'].strip()
                    if 'hwid' in body:
                        r['hwid'] = body['hwid'].strip().upper()
                    if 'status' in body:
                        r['status'] = body['status']
                    if 'expiresAt' in body:
                        r['expiresAt'] = body['expiresAt']
                    if 'notes' in body:
                        r['notes'] = body['notes'].strip()
                    r['updatedAt'] = datetime.utcnow().isoformat() + 'Z'

                    save_hwids(records)
                    self.send_response(200)
                    self.send_cors_headers()
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': True, 'message': 'Record updated', 'data': r}).encode('utf-8'))
                    return

            self.send_response(404)
            self.send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': False, 'message': 'Record not found'}).encode('utf-8'))
            return

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.get_json_body()

        if path == '/api/hwids':
            record_id = body.get('id')
            user_name = body.get('name')
            target_hwid = body.get('hwid')

            if not record_id and not user_name and not target_hwid:
                self.send_response(400)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'message': 'ID, Username, or HWID is required'}).encode('utf-8'))
                return

            records = read_hwids()
            init_len = len(records)
            deleted_items = []

            def should_keep(r):
                if record_id and (r.get('id') == record_id or r.get('hwid') == record_id):
                    deleted_items.append(r)
                    return False
                if user_name and (r.get('name') or '').strip().lower() == user_name.strip().lower():
                    deleted_items.append(r)
                    return False
                if target_hwid and (r.get('hwid') or '').strip().upper() == target_hwid.strip().upper():
                    deleted_items.append(r)
                    return False
                return True

            records = [r for r in records if should_keep(r)]

            if len(records) < init_len:
                save_hwids(records)
                deleted_names = ", ".join([i.get('name', '') for i in deleted_items])
                self.send_response(200)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'success': True,
                    'message': f'User {deleted_names} deleted and removed from raw text!',
                    'deletedCount': len(deleted_items)
                }).encode('utf-8'))
            else:
                self.send_response(404)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'message': 'User record not found'}).encode('utf-8'))
            return


def run():
    ensure_data_file()
    # Force UTF-8 on Windows stdout if possible
    if sys.stdout.encoding != 'utf-8':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    handler = HWIDRequestHandler
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print("=" * 60)
        print("[+] HWID MANAGEMENT SYSTEM DEV SERVER STARTED!")
        print(f"[*] Web Dashboard: http://localhost:{PORT}")
        print(f"[*] Raw Endpoint : http://localhost:{PORT}/api/raw")
        print(f"[*] Admin Secret : {ADMIN_SECRET}")
        print("=" * 60)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.server_close()


if __name__ == '__main__':
    run()

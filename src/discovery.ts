/**
 * Highly Optimized Discovery Service with In-Memory Static Cache, Mutex Protection,
 * and Auto-Rediscovery on Port Drift / IDE Restart.
 */

import { execSync } from 'child_process';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface DiscoveredServer {
  pid: number;
  port: number;
  csrfToken: string;
  commandLine?: string;
  isAlive: boolean;
}

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export class DiscoveryService {
  private static cachedServer: DiscoveredServer | null = null;
  private static discoveryPromise: Promise<DiscoveredServer | null> | null = null;
  private static serverInfoFile = path.join(os.homedir(), '.antigravity-wechat', 'server_info.json');

  public static invalidateCache() {
    this.cachedServer = null;
    this.discoveryPromise = null;
    try { fs.unlinkSync(this.serverInfoFile); } catch {}
  }

  public static async discover(forceRefresh = false): Promise<DiscoveredServer | null> {
    if (!forceRefresh && this.cachedServer && this.cachedServer.isAlive) {
      return this.cachedServer;
    }

    if (!this.cachedServer && fs.existsSync(this.serverInfoFile) && !forceRefresh) {
      try {
        const raw = fs.readFileSync(this.serverInfoFile, 'utf-8');
        const srv = JSON.parse(raw) as DiscoveredServer;
        const alive = await this.ping(srv.port, srv.csrfToken);
        if (alive) {
          srv.isAlive = true;
          this.cachedServer = srv;
          return srv;
        }
      } catch {}
    }

    if (this.discoveryPromise) {
      return this.discoveryPromise;
    }

    this.discoveryPromise = (async () => {
      try {
        if (process.env.AG_PORT && process.env.AG_CSRF) {
          const customPort = parseInt(process.env.AG_PORT, 10);
          const customCsrf = process.env.AG_CSRF;
          const srv: DiscoveredServer = { pid: 0, port: customPort, csrfToken: customCsrf, isAlive: true };
          this.cachedServer = srv;
          return srv;
        }

        const isWin = os.platform() === 'win32';
        let server: DiscoveredServer | null = null;

        if (isWin) {
          server = await this.discoverWindows();
        } else {
          server = await this.discoverUnix();
        }

        if (server) {
          this.cachedServer = server;
          this.saveServerInfo(server);
          return server;
        }
        return null;
      } finally {
        this.discoveryPromise = null;
      }
    })();

    return this.discoveryPromise;
  }

  private static saveServerInfo(srv: DiscoveredServer) {
    try {
      const dir = path.dirname(this.serverInfoFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.serverInfoFile, JSON.stringify(srv, null, 2), 'utf-8');
    } catch {}
  }

  private static async discoverWindows(): Promise<DiscoveredServer | null> {
    try {
      const psScript = `
        $procs = Get-CimInstance Win32_Process | Where-Object { $_.Name -like "*language_server*" }
        $results = @()
        foreach ($p in $procs) {
          $conns = Get-NetTCPConnection -OwningProcess $p.ProcessId -State Listen -ErrorAction SilentlyContinue
          $ports = @($conns | Select-Object -ExpandProperty LocalPort)
          $results += @{
            ProcessId = $p.ProcessId
            CommandLine = $p.CommandLine
            ListeningPorts = $ports
          }
        }
        $results | ConvertTo-Json
      `;

      const b64 = Buffer.from(psScript, 'utf16le').toString('base64');
      const output = execSync(`powershell.exe -NoProfile -EncodedCommand ${b64}`, {
        encoding: 'utf-8',
        timeout: 8000,
        windowsHide: true,
      });

      if (!output || output.trim() === '') return null;
      let parsed = JSON.parse(output);
      if (!Array.isArray(parsed)) parsed = [parsed];

      for (const proc of parsed) {
        const cmd = proc.CommandLine || '';
        const pid = proc.ProcessId;
        const csrfMatch = cmd.match(/--csrf_token\s+([0-9a-fA-F-]+)/);
        if (!csrfMatch) continue;
        const csrfToken = csrfMatch[1];

        // 2. Fetch listening TCP ports for this specific PID
        let listeningPorts: number[] = [];
        try {
          const portQuery = `Get-NetTCPConnection -OwningProcess ${pid} -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort | ConvertTo-Json`;
          const portOut = execSync(`powershell -NoProfile -Command "${portQuery}"`, {
            encoding: 'utf-8',
            timeout: 5000,
            windowsHide: true,
          });
          if (portOut && portOut.trim() !== '') {
            let pParsed = JSON.parse(portOut);
            if (!Array.isArray(pParsed)) pParsed = [pParsed];
            for (const item of pParsed) {
              if (item?.LocalPort) listeningPorts.push(item.LocalPort);
            }
          }
        } catch {}

        // Fallback default ports range probe if NetTCPConnection fails
        if (listeningPorts.length === 0) {
          for (let p = 52000; p <= 53500; p++) listeningPorts.push(p);
        }

        // Test listening ports to identify active RPC endpoint
        for (const p of listeningPorts) {
          const alive = await this.ping(p, csrfToken);
          if (alive) {
            return {
              pid,
              port: p,
              csrfToken,
              commandLine: cmd,
              isAlive: true,
            };
          }
        }
      }
    } catch (err: any) {
      console.error('Discovery error:', err.message);
    }
    return null;
  }

  private static async discoverUnix(): Promise<DiscoveredServer | null> {
    try {
      const output = execSync('ps aux | grep language_server', { encoding: 'utf-8', timeout: 5000 });
      const lines = output.split('\n');
      for (const line of lines) {
        const portMatch = line.match(/--server_port\s+([0-9]+)/);
        const csrfMatch = line.match(/--csrf_token\s+([0-9a-fA-F-]+)/);
        if (portMatch && csrfMatch) {
          return {
            pid: 0,
            port: parseInt(portMatch[1], 10),
            csrfToken: csrfMatch[1],
            commandLine: line,
            isAlive: true,
          };
        }
      }
    } catch {}
    return null;
  }

  public static async ping(port: number, csrfToken: string): Promise<boolean> {
    return new Promise((resolve) => {
      const req = https.request({
        hostname: '127.0.0.1',
        port,
        path: '/exa.language_server_pb.LanguageServerService/GetAvailableModels',
        method: 'POST',
        agent: httpsAgent,
        timeout: 2000,
        headers: {
          'Content-Type': 'application/json',
          'Connect-Protocol-Version': '1',
          'x-codeium-csrf-token': csrfToken,
        },
      }, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.write(JSON.stringify({}));
      req.end();
    });
  }
}

const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false });

const llmService = require('./llm');
const musicService = require('./music');
const weatherService = require('./weather');

// ============================================================
// CORS
// ============================================================
function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
}

// ============================================================
// 静态文件服务
// ============================================================
const STATIC_DIR = path.join(__dirname, '..', '..', 'frontend', 'dist');

function serveStatic(req, res) {
    // 只处理 GET 请求，POST 等其他请求返回 405
    if (req.method !== 'GET') {
        res.writeHead(405);
        res.end('Method Not Allowed');
        return;
    }
    let filePath = req.url === '/' ? '/index.html' : req.url;
    // 去掉 query string
    const qIdx = filePath.indexOf('?');
    if (qIdx !== -1) filePath = filePath.slice(0, qIdx);
    // 安全过滤：防止目录遍历
    filePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(STATIC_DIR, filePath);

    // 如果文件不存在，返回 index.html（SPA 路由）
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
        const indexPath = path.join(STATIC_DIR, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(fs.readFileSync(indexPath));
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
        return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
        '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/truetype',
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(fs.readFileSync(fullPath));
}

// ============================================================
// RadioServer
// ============================================================
class RadioServer {
    constructor() {
        this.port = parseInt(process.env.PORT) || 8834;
        this.clients = new Set();
        this.currentTrack = null;
        this.isProcessing = false;
        this.isPreloading = false;
        this.preloadedTrack = null;
        this.preloadedQueue = [];
        this.preloadedSay = '';
        this.lastSay = '';
    }

    start() {
        const server = http.createServer(async (req, res) => {
            setCORS(res);
            if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

            // ===== API 路由 =====
            // 去掉 query string 用于路由匹配
            const reqPath = req.url.includes('?') ? req.url.slice(0, req.url.indexOf('?')) : req.url;

            // 健康检查
            if (reqPath === '/health') {
                const status = { status: 'ok', clients: this.clients.size, llm: null, music: null };
                try {
                    const llmRes = await axios.post(
                        process.env.LONGCAT_API_URL || '',
                        { model: process.env.LONGCAT_MODEL || '', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 },
                        { headers: { 'Authorization': `Bearer ${process.env.LONGCAT_API_KEY || ''}`, 'Content-Type': 'application/json' }, timeout: 20000 }
                    );
                    status.llm = (llmRes.status >= 200 && llmRes.status < 500);
                } catch (e) { status.llm = false; }
                try {
                    const apiUrl = process.env.MUSIC_API_URL || '';
                    const musicRes = await axios.post(`${apiUrl}/search`, `keywords=test&limit=1`, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 });
                    status.music = (musicRes.status >= 200 && musicRes.status < 500);
                } catch (e) { status.music = false; }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(status));
                return;
            }

            // 修改密码（需要旧密码）
            if (reqPath === '/api/change-password' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const data = JSON.parse(body);
                        const { oldPassword, newPassword } = data;
                        if (!oldPassword || !newPassword) {
                            res.writeHead(400);
                            res.end(JSON.stringify({ success: false, error: '缺少参数' }));
                            return;
                        }
                        if (oldPassword !== (process.env.ADMIN_PASSWORD || 'versior123')) {
                            res.writeHead(401);
                            res.end(JSON.stringify({ success: false, error: '旧密码错误' }));
                            return;
                        }
                        if (newPassword.length < 4) {
                            res.writeHead(400);
                            res.end(JSON.stringify({ success: false, error: '新密码至少4位' }));
                            return;
                        }
                        // 更新 .env 文件
                        const envPath = path.join(__dirname, '..', '.env');
                        let envContent = '';
                        if (fs.existsSync(envPath)) {
                            envContent = fs.readFileSync(envPath, 'utf8');
                        }
                        const regex = /^ADMIN_PASSWORD=.*$/m;
                        if (regex.test(envContent)) {
                            envContent = envContent.replace(regex, `ADMIN_PASSWORD=${newPassword}`);
                        } else {
                            envContent += `\nADMIN_PASSWORD=${newPassword}`;
                        }
                        fs.writeFileSync(envPath, envContent.trim() + '\n');
                        process.env.ADMIN_PASSWORD = newPassword;
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    } catch (e) {
                        res.writeHead(500);
                        res.end(JSON.stringify({ success: false, error: e.message }));
                    }
                });
                return;
            }

            // 配置读取（无需密码）
            if (reqPath === '/api/config' && req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    config: {
                        LONGCAT_API_URL: process.env.LONGCAT_API_URL || '',
                        LONGCAT_MODEL: process.env.LONGCAT_MODEL || '',
                        MUSIC_API_URL: process.env.MUSIC_API_URL || '',
                        MUSIC_SOURCE: process.env.MUSIC_SOURCE || 'netease'
                    }
                }));
                return;
            }

            // 配置保存（需要密码）
            if (reqPath === '/api/config' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const data = JSON.parse(body);
                        const { password, config } = data;
                        if (!password || password !== (process.env.ADMIN_PASSWORD || 'versior123')) {
                            res.writeHead(401);
                            res.end(JSON.stringify({ success: false, error: '密码错误' }));
                            return;
                        }
                        if (config) {
                            // 更新 .env 文件
                            const envPath = path.join(__dirname, '..', '.env');
                            let envContent = '';
                            if (fs.existsSync(envPath)) {
                                envContent = fs.readFileSync(envPath, 'utf8');
                            } else {
                                // 首次创建 .env，写入默认模板
                                envContent = [
                                    'NODE_ENV=production',
                                    'PORT=8834',
                                    'ADMIN_PASSWORD=' + (process.env.ADMIN_PASSWORD || 'change_me'),
                                    'LONGCAT_API_KEY=',
                                    'LONGCAT_API_URL=',
                                    'LONGCAT_MODEL=',
                                    'MUSIC_API_URL=',
                                    'MUSIC_SOURCE=netease'
                                ].join('\n') + '\n';
                            }
                            for (const [key, value] of Object.entries(config)) {
                                const regex = new RegExp(`^${key}=.*$`, 'm');
                                if (regex.test(envContent)) {
                                    envContent = envContent.replace(regex, `${key}=${value}`);
                                } else {
                                    envContent += `\n${key}=${value}`;
                                }
                            }
                            fs.writeFileSync(envPath, envContent.trim() + '\n');
                            // 更新 process.env
                            for (const [key, value] of Object.entries(config)) {
                                process.env[key] = value;
                            }
                            // 重新加载 llmService 配置
                            llmService.reloadConfig();
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    } catch (e) {
                        res.writeHead(500);
                        res.end(JSON.stringify({ success: false, error: e.message }));
                    }
                });
                return;
            }

            // 音乐平台登录
            if (reqPath === '/api/music/login' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const data = JSON.parse(body);
                        const { platform, username, password, cookie } = data;
                        if (!platform) { res.writeHead(400); res.end(JSON.stringify({ success: false, error: '缺少参数' })); return; }
                        let result;
                        if (cookie) {
                            result = await musicService.login(platform, username, password, cookie);
                        } else if (platform === 'qqmusic' || platform === 'kugou') {
                            res.writeHead(400); res.end(JSON.stringify({ success: false, error: 'QQ音乐/酷狗需要使用 Cookie 登录' })); return;
                        } else {
                            if (!username || !password) { res.writeHead(400); res.end(JSON.stringify({ success: false, error: '缺少账号或密码' })); return; }
                            result = await musicService.login(platform, username, password);
                        }
                        if (result.success) {
                            result.loggedIn = true;
                            console.log(`✅ ${platform} 登录成功: ${result.nickname}, cookie: ${result.cookie ? result.cookie.substring(0,50) + '...' : 'EMPTY'}`);
                            // 持久化 Cookie 到 .env
                            if (result.cookie) {
                                try {
                                    const envPath = path.join(__dirname, '..', '.env');
                                    let envContent = '';
                                    if (fs.existsSync(envPath)) envContent = fs.readFileSync(envPath, 'utf8');
                                    const key = platform === 'netease' ? 'NETEASE_COOKIE' : platform === 'kuwo' ? 'KUWO_COOKIE' : platform === 'qqmusic' ? 'QQMUSIC_COOKIE' : 'KUGOU_COOKIE';
                                    const regex = new RegExp(`^${key}=.*$`, 'm');
                                    if (regex.test(envContent)) {
                                        envContent = envContent.replace(regex, `${key}=${result.cookie}`);
                                    } else {
                                        envContent += `\n${key}=${result.cookie}`;
                                    }
                                    fs.writeFileSync(envPath, envContent.trim() + '\n');
                                    console.log(`  ✅ Cookie 已保存到 .env (${result.cookie.substring(0, 30)}...)`);
                                } catch (e) { console.warn('⚠️ 保存 Cookie 失败:', e.message); }
                            }
                            try {
                                const uniqueTracks = await musicService.fetchUserData(platform, result.uid);
                                const prefsPath = path.join(__dirname, 'user-music-prefs.json');
                                fs.writeFileSync(prefsPath, JSON.stringify(uniqueTracks, null, 2));
                                console.log(`  ✅ 已保存 ${uniqueTracks.length} 首歌曲`);
                                result.trackCount = uniqueTracks.length;
                            } catch (fetchErr) { console.warn('⚠️ 获取用户数据失败:', fetchErr.message); }
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(result));
                    } catch (e) {
                        console.error('❌ /api/music/login 错误:', e.message);
                        res.writeHead(500); res.end(JSON.stringify({ success: false, error: e.message }));
                    }
                });
                return;
            }

            // 音乐状态
            if (reqPath === '/api/music/status' && req.method === 'GET') {
                try {
                    const platforms = ['netease', 'kuwo', 'qqmusic', 'kugou'];
                    const status = {};
                    for (const p of platforms) {
                        try {
                            const info = await musicService.getPlatformInfo(p);
                            status[p] = info;
                        } catch (e) { status[p] = { loggedIn: false, error: e.message }; }
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ platforms: status }));
                } catch (e) {
                    res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
                }
                return;
            }

            // 刷新用户数据
            if (reqPath === '/api/music/refresh-data' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const data = JSON.parse(body);
                        const { platform, cookie } = data;
                        const result = await musicService.refreshUserData(platform, cookie);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(result));
                    } catch (e) {
                        res.writeHead(500); res.end(JSON.stringify({ success: false, error: e.message }));
                    }
                });
                return;
            }

            // HTTP 方式获取下一首（WS 断开时的降级方案）
            if (reqPath === '/api/next' && req.method === 'POST') {
                if (!this.isProcessing) {
                    this.isProcessing = true;
                    this.processNextTrack(req.socket.remoteAddress || '127.0.0.1').finally(() => {
                        this.isProcessing = false;
                    });
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: '正在获取下一首...' }));
                return;
            }

            // 刷新播放链接（URL 过期时调用）
            if (reqPath === '/api/refresh-url' && req.method === 'GET') {
                try {
                    const queryStart = req.url.indexOf('?');
                    const params = new URLSearchParams(queryStart >= 0 ? req.url.substring(queryStart) : '');
                    const songId = params.get('id');
                    if (!songId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: '缺少 id 参数' }));
                        return;
                    }
                    const url = await musicService.getSongUrl(songId);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, url: url }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
                return;
            }

            // 搜索歌曲
            if (req.url.startsWith('/api/search') && req.method === 'GET') {
                try {
                    const queryStart = req.url.indexOf('?');
                    let title = '', artist = '';
                    if (queryStart > 0) {
                        const qs = req.url.substring(queryStart + 1);
                        for (const pair of qs.split('&')) {
                            const eqIdx = pair.indexOf('=');
                            if (eqIdx < 0) continue;
                            const key = decodeURIComponent(pair.substring(0, eqIdx));
                            const val = decodeURIComponent(pair.substring(eqIdx + 1));
                            if (key === 'title') title = val;
                            if (key === 'artist') artist = val;
                        }
                    }
                    if (!title) { res.writeHead(400); res.end(JSON.stringify({ success: false, error: '缺少 title' })); return; }
                    const query = artist ? `${title} ${artist}` : title;
                    const track = await musicService.searchSong(query);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, track }));
                } catch (e) {
                    console.error('❌ /api/search 错误:', e.message);
                    res.writeHead(500); res.end(JSON.stringify({ success: false, error: e.message }));
                }
                return;
            }

            // 小爱音箱 LLM 接口
            if (req.url === '/api/chat' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const data = JSON.parse(body);
                        const weather = await weatherService.getWeather('127.0.0.1');
                        const weatherDesc = weatherService.getWeatherDesc(weather);
                        const llmResponse = await llmService.generateResponse(data.text || '', weatherDesc);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(llmResponse));
                    } catch (e) {
                        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
                    }
                });
                return;
            }

            // 获取网站标题
            if (req.url.startsWith('/api/fetch-title')) {
                const url = new URL(req.url, `http://localhost:${this.port}`);
                const targetUrl = url.searchParams.get('url');
                if (!targetUrl) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing url' })); return; }
                try {
                    const pageRes = await axios.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VersiorBot/1.0)' }, timeout: 10000 });
                    const html = pageRes.data;
                    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                    const title = titleMatch ? titleMatch[1].trim() : targetUrl;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ title }));
                } catch (e) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ title: targetUrl }));
                }
                return;
            }

            // ===== 静态文件服务（SPA 回退）=====
            serveStatic(req, res);
        });

        // ============================================================
        // WebSocket
        // ============================================================
        this.wss = new WebSocket.Server({ server });

        this.wss.on('connection', (ws, req) => {
            const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            console.log(`🔌 新连接: ${clientIP}`);
            this.clients.add(ws);

            // 发送当前状态给新客户端
            if (this.lastSay) {
                ws.send(JSON.stringify({ type: 'dj_response', say: this.lastSay, track: this.currentTrack }));
            }

            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    await this.handleWSMessage(ws, data, clientIP);
                } catch (e) { console.error('❌ WS 消息解析错误:', e.message); }
            });

            ws.on('close', () => { this.clients.delete(ws); console.log(`🔌 断开: ${clientIP}`); });
            ws.on('error', (e) => { console.error('❌ WS 错误:', e.message); this.clients.delete(ws); });
        });

        // ============================================================
        // 启动
        // ============================================================
        server.listen(this.port, '0.0.0.0', () => {
            console.log(`\n🎵 Versior AI 电台已启动`);
            console.log(`   HTTP + WS: http://0.0.0.0:${this.port}`);
            console.log(`   静态文件:  ${STATIC_DIR}`);
            console.log(`   环境:      ${process.env.NODE_ENV || 'development'}\n`);
        });
    }

    // ============================================================
    // WebSocket 消息处理
    // ============================================================
    async handleWSMessage(ws, data, clientIP) {
        switch (data.type) {
            case 'user_input':
                await this.processUserInput(data.text, clientIP);
                break;
            case 'command':
                if (data.action === 'next_track') {
                    await this.processNextTrack(clientIP);
                } else if (data.action === 'preload_next') {
                    await this.preloadNextTrack(clientIP);
                }
                break;
            default:
                console.log('未知消息类型:', data.type);
        }
    }

    // ============================================================
    // 广播
    // ============================================================
    broadcast(msg) {
        const data = JSON.stringify(msg);
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        }
    }

    // ============================================================
    // 处理用户输入（AI 对话点歌）
    // ============================================================
    async processUserInput(text, clientIP) {
        console.log('💬 用户输入:', text);
        try {
            const weather = await weatherService.getWeather(clientIP || '127.0.0.1');
            const weatherDesc = weatherService.getWeatherDesc(weather);
            const llmResponse = await llmService.generateResponse(text, weatherDesc);
            const trackInfo = llmResponse.track;
            let musicData;
            try {
                musicData = await musicService.searchSong(trackInfo.title);
            } catch (searchErr) {
                console.log(`⚠️ 搜索失败: ${searchErr.message}，从歌单随机选一首`);
                // 从用户歌单中随机选一首能播放的
                musicData = await musicService.pickRandomFromLibrary();
                if (!musicData) {
                    throw new Error('搜索失败且歌单中无可用歌曲');
                }
            }

            const track = {
                id: musicData.id || trackInfo.id || 0,
                title: musicData.title || trackInfo.title,
                artist: musicData.artist || trackInfo.artist,
                url: musicData.url,
                cover: musicData.cover,
                hotComment: musicData.hotComment
            };

            this.currentTrack = track;
            this.lastSay = llmResponse.say;

            this.broadcast({
                type: 'dj_response',
                say: llmResponse.say,
                track: track,
                queue: llmResponse.queue || [],
                weather: weather
            });
        } catch (error) {
            console.error('处理用户输入失败:', error);
            this.broadcast({ type: 'system_message', text: '处理失败，请重试' });
        }
    }

    // ============================================================
    // 处理下一首
    // ============================================================
    async processNextTrack(clientIP) {
        if (this.isProcessing) { console.log('正在处理中，跳过...'); return; }
        this.isProcessing = true;
        console.log('🎵 处理下一首曲目...');

        try {
            const weather = await weatherService.getWeather(clientIP || '127.0.0.1');
            const weatherDesc = weatherService.getWeatherDesc(weather);
            const llmResponse = await llmService.generateResponse('', weatherDesc);
            const trackInfo = llmResponse.track;
            let musicData;
            try {
                musicData = await musicService.searchSong(trackInfo.title);
            } catch (searchErr) {
                console.log(`⚠️ 搜索失败: ${searchErr.message}，从歌单随机选一首`);
                // 从用户歌单中随机选一首能播放的
                musicData = await musicService.pickRandomFromLibrary();
                if (!musicData) {
                    throw new Error('搜索失败且歌单中无可用歌曲');
                }
            }

            const track = {
                id: musicData.id || trackInfo.id || 0,
                title: musicData.title || trackInfo.title,
                artist: musicData.artist || trackInfo.artist,
                url: musicData.url,
                cover: musicData.cover,
                hotComment: musicData.hotComment
            };

            this.currentTrack = track;
            this.lastSay = llmResponse.say;

            console.log('📡 广播天气:', weather ? `${weather.city} ${weather.condition} ${weather.temp}` : '无天气');
            console.log('📡 广播天气对象:', JSON.stringify(weather));
            this.broadcast({
                type: 'dj_broadcast',
                say: llmResponse.say,
                track: track,
                queue: llmResponse.queue || [],
                weather: weather
            });
        } catch (error) {
            console.error('处理下一首失败:', error);
            this.broadcast({ type: 'system_message', text: '获取下一首失败' });
        } finally {
            this.isProcessing = false;
        }
    }

    // ============================================================
    // 预加载下一首
    // ============================================================
    async preloadNextTrack(clientIP) {
        if (this.isPreloading) return;
        this.isPreloading = true;
        console.log('⏳ 预加载下一首...');

        try {
            // 快速路径：如果用户有偏好歌曲，先直接从偏好里随机选一首
            // 这样预加载不需要等 LLM，秒级完成
            const prefsPath = path.join(__dirname, 'user-music-prefs.json');
            let fastTrack = null;
            if (fs.existsSync(prefsPath)) {
                const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
                if (prefs.length > 0) {
                    const randomTrack = prefs[Math.floor(Math.random() * prefs.length)];
                    // 搜索这首歌获取 URL
                    try {
                        const musicData = await musicService.searchSong(randomTrack.name + ' ' + randomTrack.artist);
                        if (musicData && musicData.url) {
                            fastTrack = {
                                id: musicData.id || 0,
                                title: musicData.title || randomTrack.name,
                                artist: musicData.artist || randomTrack.artist,
                                url: musicData.url,
                                cover: musicData.cover,
                                hotComment: musicData.hotComment
                            };
                        }
                    } catch (e) {
                        console.warn('快速预加载搜索失败，回退到 LLM');
                    }
                }
            }

            if (fastTrack) {
                // 快速路径成功
                this.preloadedTrack = fastTrack;
                this.preloadedSay = `为你推荐 ${fastTrack.title}，来自你的歌单`;
                this.preloadedQueue = [];
                console.log('✅ 快速预加载完成:', fastTrack.title);
            } else {
                // 回退到 LLM 路径
                const weather = await weatherService.getWeather(clientIP || '127.0.0.1');
                const weatherDesc = weatherService.getWeatherDesc(weather);
                const llmResponse = await llmService.generateResponse('', weatherDesc);
                const trackInfo = llmResponse.track;
                const musicData = await musicService.searchSong(trackInfo.title);

                this.preloadedTrack = {
                    id: musicData.id || trackInfo.id || 0,
                    title: musicData.title || trackInfo.title,
                    artist: musicData.artist || trackInfo.artist,
                    url: musicData.url,
                    cover: musicData.cover,
                    hotComment: musicData.hotComment
                };
                this.preloadedSay = llmResponse.say;
                this.preloadedQueue = llmResponse.queue || [];
                console.log('✅ LLM 预加载完成:', this.preloadedTrack.title);
            }

            this.broadcast({
                type: 'preload_ready',
                track: this.preloadedTrack,
                say: this.preloadedSay,
                queue: this.preloadedQueue
            });
            console.log('✅ 预加载完成:', this.preloadedTrack.title);
        } catch (e) {
            console.error('预加载失败:', e.message);
            setTimeout(() => { this.isPreloading = false; }, 5000);
        } finally {
            this.isPreloading = false;
        }
    }
}

// ============================================================
// 启动服务器
// ============================================================
const radio = new RadioServer();
radio.start();

module.exports = RadioServer;

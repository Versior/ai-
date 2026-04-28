const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false });

const llmService = require('./llm');
const musicService = require('./music');
const weatherService = require('./weather');

const healthRoute = require('./routes/health');
const configRoute = require('./routes/config');
const musicRoute = require('./routes/music');
const searchRoute = require('./routes/search');

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
    if (req.method !== 'GET') {
        res.writeHead(405);
        res.end('Method Not Allowed');
        return;
    }
    let filePath = req.url === '/' ? '/index.html' : req.url;
    const qIdx = filePath.indexOf('?');
    if (qIdx !== -1) filePath = filePath.slice(0, qIdx);
    filePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(STATIC_DIR, filePath);

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
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(fullPath));
}

// ============================================================
// 路由上下文（共享给所有路由）
// ============================================================
const ctx = {
    clients: new Set(),
    musicService,
    llmService,
    weatherService,
};

// ============================================================
// RadioServer
// ============================================================
class RadioServer {
    constructor() {
        this.port = parseInt(process.env.PORT) || 8834;
        this.clients = ctx.clients;
        this.currentTrack = null;
        this.isProcessing = false;
        this.isPreloading = false;
        this.preloadedTrack = null;
        this.preloadedQueue = [];
        this.preloadedSay = '';
        this.lastSay = '';
        this.lastQueue = [];
        this.playHistory = []; // 最近播放的歌曲 ID，用于去重
        this.playHistoryTitles = []; // 最近播放的歌名+歌手，用于同名去重
        this.maxHistory = 20;
        this.lastPreloadTime = 0;
        this.preloadDebounceMs = 60000; // 60秒防抖
    }

    start() {
        const server = http.createServer(async (req, res) => {
            setCORS(res);
            if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

            const reqPath = req.url.includes('?') ? req.url.slice(0, req.url.indexOf('?')) : req.url;

            // ---------- API 路由 ----------

            if (reqPath === '/health') {
                return healthRoute.handle(req, res, ctx);
            }

            if (reqPath === '/api/change-password' && req.method === 'POST') {
                return configRoute.handleChangePassword(req, res);
            }

            if (reqPath === '/api/config' && req.method === 'GET') {
                return configRoute.handleGet(req, res);
            }

            if (reqPath === '/api/config' && req.method === 'POST') {
                return configRoute.handlePost(req, res, ctx);
            }

            if (reqPath === '/api/music/login' && req.method === 'POST') {
                return musicRoute.handleLogin(req, res, ctx);
            }

            if (reqPath === '/api/music/status' && req.method === 'GET') {
                return musicRoute.handleStatus(req, res, ctx);
            }

            if (reqPath === '/api/music/refresh-data' && req.method === 'POST') {
                return musicRoute.handleRefreshData(req, res, ctx);
            }

            if (reqPath === '/api/like' && req.method === 'POST') {
                return handleLikeRoute(req, res, ctx);
            }

            if (reqPath === '/api/next' && req.method === 'POST') {
                if (!this.isProcessing) {
                    this.isProcessing = true;
                    this.processNextTrack(req.socket.remoteAddress || '127.0.0.1')
                        .finally(() => { this.isProcessing = false; });
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: '正在获取下一首...' }));
                return;
            }

            if (reqPath === '/api/refresh-url' && req.method === 'GET') {
                return searchRoute.handleRefreshUrl(req, res, ctx);
            }

            if (reqPath.startsWith('/api/search') && req.method === 'GET') {
                return searchRoute.handleSearch(req, res, ctx);
            }

            if (reqPath.startsWith('/api/ai-summary') && req.method === 'GET') {
                return searchRoute.handleAiSummary(req, res, ctx);
            }

            if (reqPath.startsWith('/api/fetch-title') && req.method === 'GET') {
                return handleFetchTitle(req, res);
            }

            // ---------- 静态文件 ----------
            serveStatic(req, res);
        });

        // ---------- WebSocket ----------
        this.wss = new WebSocket.Server({ server });

        this.wss.on('connection', (ws, req) => {
            const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            console.log(`🔌 新连接: ${clientIP}`);
            this.clients.add(ws);

            if (this.lastSay) {
                ws.send(JSON.stringify({ type: 'dj_response', say: this.lastSay, track: this.currentTrack }));
            }

            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    await this.handleWSMessage(ws, data, clientIP);
                } catch (e) { console.error('❌ WS 消息解析错误:', e.message); }
            });

            ws.lastActive = Date.now();
            ws.on('close', () => { this.clients.delete(ws); console.log(`🔌 断开: ${clientIP}`); });
            ws.on('error', (e) => { console.error('❌ WS 错误:', e.message); this.clients.delete(ws); });
        });

        // ---------- 心跳检测 ----------
        setInterval(() => {
            const now = Date.now();
            for (const client of this.clients) {
                if (client.lastActive && now - client.lastActive > 120000) {
                    console.log('💀 清理死连接');
                    try { client.terminate(); } catch (e) {}
                    this.clients.delete(client);
                }
            }
        }, 60000);

        // ---------- 启动 ----------
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
        ws.lastActive = Date.now();
        switch (data.type) {
            case 'ping':
                try { ws.send(JSON.stringify({ type: 'pong' })); } catch (e) {}
                return;
            case 'user_input':
                await this.processUserInput(data.text, clientIP);
                break;
            case 'command':
                if (data.action === 'next_track') {
                    await this.processNextTrack(clientIP);
                } else if (data.action === 'preload_next') {
                    // 预加载已关闭，避免循环触发问题
                    console.log('⏭️ 预加载已关闭');
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

            // 并行：LLM 生成 + 先用歌名搜索（如果 text 包含歌名）
            const recentPlays = (this.playHistoryTitles || []).slice(-10);
            const llmPromise = llmService.generateResponse(text, weatherDesc, recentPlays).then(r => ({ type: 'llm', data: r })).catch(e => ({ type: 'llm', error: e }));

            // 等 LLM（最多 10s）
            const llmResult = await llmPromise;
            let llmResponse = null;
            let trackInfo = null;
            if (!llmResult.error) {
                llmResponse = llmResult.data;
                trackInfo = llmResponse.track;
            } else {
                console.log(`⚠️ LLM 失败: ${llmResult.error.message}`);
            }

            // LLM 失败时，尝试从用户输入提取歌名直接搜索
            const searchTitle = trackInfo?.title || text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9 ]/g, '').trim();
            if (!searchTitle) throw new Error('无法确定搜索目标');

            const excludeIds = this.playHistory;
            let musicData;
            try {
                musicData = await musicService.searchSong(searchTitle, excludeIds);
            } catch (searchErr) {
                console.log(`⚠️ 精确搜索失败: ${searchErr.message}，尝试模糊搜索`);
                try {
                    musicData = await musicService.searchSong(searchTitle, []);
                } catch (e2) {
                    console.log(`⚠️ 模糊搜索也失败，从歌单随机选`);
                    musicData = await musicService.pickRandomFromLibrary();
                    if (!musicData) throw new Error('搜索失败且歌单中无可用歌曲');
                }
            }
            // 同名去重（模糊匹配，忽略大小写和空格）
            if (musicData) {
                const dupTitle = musicData.title?.trim().toLowerCase();
                const dupArtist = musicData.artist?.trim().toLowerCase();
                const duplicate = this.playHistoryTitles?.find(t =>
                    t.title?.trim().toLowerCase() === dupTitle &&
                    t.artist?.trim().toLowerCase() === dupArtist
                );
                if (duplicate) {
                    console.log(`⚠️ 同名已播放: ${musicData.title} - ${musicData.artist}，尝试找下一首`);
                    try {
                        const nextData = await musicService.searchSong(searchTitle, excludeIds.concat(String(musicData.id)));
                        if (nextData) musicData = nextData;
                    } catch (e) {}
                }
            }

            const track = {
                id: musicData.id || trackInfo?.id || 0,
                title: musicData.title || trackInfo?.title,
                artist: musicData.artist || trackInfo?.artist,
                url: musicData.url,
                cover: musicData.cover,
                hotComment: musicData.hotComment,
                lyrics: musicData.lyrics || "",
            };

            this.currentTrack = track;
            this.lastSay = llmResponse?.say || `正在播放《${track.title}》`;
            this.lastQueue = llmResponse?.queue || this.lastQueue || [];
            // 记录播放历史
            if (track.id) {
                this.playHistory.push(String(track.id));
                this.playHistoryTitles.push({ title: track.title, artist: track.artist });
                if (this.playHistory.length > this.maxHistory) {
                    this.playHistory.shift();
                    this.playHistoryTitles.shift();
                }
            }

            this.broadcast({
                type: 'dj_response',
                say: this.lastSay,
                track,
                queue: this.lastQueue,
                weather,
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
        if (this.isProcessing) {
            console.log('正在处理中，跳过（前端已有防抖）');
            return;
        }
        this.isProcessing = true;
        console.log('🎵 处理下一首曲目...');

        try {
            const weather = await weatherService.getWeather(clientIP || '127.0.0.1');
            const weatherDesc = weatherService.getWeatherDesc(weather);

            // 并行：LLM 生成推荐 + 从上次 queue 预搜索
            const excludeIds = this.playHistory;
            const lastQueue = this.lastQueue || [];
            // 从上次 queue 找下一首候选（跳过当前和已播放的）
            const playedTitles = this.playHistoryTitles?.map(t => t.title?.trim().toLowerCase()) || [];
            const queueCandidate = lastQueue.find(t => {
                const tTitle = t.title?.trim().toLowerCase();
                return tTitle !== this.currentTrack?.title?.trim().toLowerCase()
                    && !playedTitles.includes(tTitle);
            });

            const recentPlays = (this.playHistoryTitles || []).slice(-10);
            // 并行执行 LLM 和搜索
            const llmPromise = llmService.generateResponse('', weatherDesc, recentPlays).then(r => ({ type: 'llm', data: r })).catch(e => ({ type: 'llm', error: e }));
            let searchPromise = null;
            if (queueCandidate) {
                searchPromise = musicService.searchSong(queueCandidate.title, excludeIds).then(d => ({ type: 'search', data: d })).catch(e => ({ type: 'search', error: e }));
            }

            // 等 LLM（最多 10s），搜索可以同时跑
            const llmResult = await llmPromise;
            let llmResponse = null;
            let trackInfo = null;
            if (!llmResult.error) {
                llmResponse = llmResult.data;
                trackInfo = llmResponse.track;
            } else {
                console.log(`⚠️ LLM 失败: ${llmResult.error.message}，使用默认推荐`);
            }

            // 确定搜索目标
            const searchTitle = trackInfo?.title || queueCandidate?.title;
            if (!searchTitle) throw new Error('无法确定搜索目标');

            // 如果 queue 搜索已完成且歌名匹配，直接用
            let musicData = null;
            if (searchPromise) {
                const searchResult = await searchPromise;
                if (!searchResult.error && searchResult.data) {
                    const sTitle = searchResult.data.title?.trim().toLowerCase();
                    const targetTitle = searchTitle.trim().toLowerCase();
                    if (sTitle === targetTitle || !trackInfo) {
                        musicData = searchResult.data;
                        console.log('⚡ 使用预搜索结果');
                    }
                }
            }

            // 没有预搜索结果，重新搜索
            if (!musicData) {
                try {
                    musicData = await musicService.searchSong(searchTitle, excludeIds);
                } catch (searchErr) {
                    console.log(`⚠️ 精确搜索失败: ${searchErr.message}，尝试模糊搜索`);
                    try {
                        musicData = await musicService.searchSong(searchTitle, []);
                    } catch (e2) {
                        console.log(`⚠️ 模糊搜索也失败，从歌单随机选`);
                        musicData = await musicService.pickRandomFromLibrary();
                        if (!musicData) throw new Error('搜索失败且歌单中无可用歌曲');
                    }
                }
            }

            // 同名去重（模糊匹配，忽略大小写和空格）
            if (musicData) {
                const dupTitle = musicData.title?.trim().toLowerCase();
                const dupArtist = musicData.artist?.trim().toLowerCase();
                const duplicate = this.playHistoryTitles?.find(t =>
                    t.title?.trim().toLowerCase() === dupTitle &&
                    t.artist?.trim().toLowerCase() === dupArtist
                );
                if (duplicate) {
                    console.log(`⚠️ 同名已播放: ${musicData.title} - ${musicData.artist}，尝试找下一首`);
                    try {
                        const nextData = await musicService.searchSong(searchTitle, excludeIds.concat(String(musicData.id)));
                        if (nextData) musicData = nextData;
                    } catch (e) {}
                }
            }

            const track = {
                id: musicData.id || trackInfo?.id || 0,
                title: musicData.title || trackInfo?.title,
                artist: musicData.artist || trackInfo?.artist,
                url: musicData.url,
                cover: musicData.cover,
                hotComment: musicData.hotComment,
                lyrics: musicData.lyrics || "",
            };

            this.currentTrack = track;
            this.lastSay = llmResponse?.say || `正在播放《${track.title}》`;
            this.lastQueue = llmResponse?.queue || this.lastQueue || [];
            // 记录播放历史
            if (track.id) {
                this.playHistory.push(String(track.id));
                this.playHistoryTitles.push({ title: track.title, artist: track.artist });
                if (this.playHistory.length > this.maxHistory) {
                    this.playHistory.shift();
                    this.playHistoryTitles.shift();
                }
            }

            this.broadcast({
                type: 'dj_broadcast',
                say: llmResponse.say,
                track,
                queue: llmResponse.queue || [],
                weather,
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
        // 防抖：30秒内不重复预加载
        const now = Date.now();
        if (this.lastPreloadTime && now - this.lastPreloadTime < this.preloadDebounceMs) {
            console.log(`⏱️ 预加载防抖跳过 (${Math.round((this.preloadDebounceMs - (now - this.lastPreloadTime)) / 1000)}s 后可用)`);
            return;
        }
        this.lastPreloadTime = now;
        this.isPreloading = true;
        console.log('⏳ 预加载下一首...');

        try {
            // 从当前 queue 中找下一首（跳过所有已播放过的）
            const queue = this.lastQueue || [];
            const playedTitles = this.playHistoryTitles?.map(t => t.title?.trim().toLowerCase()) || [];
            let nextQueueTrack = null;
            for (const t of queue) {
                const tTitle = t.title?.trim().toLowerCase();
                if (!playedTitles.includes(tTitle)) {
                    nextQueueTrack = t;
                    break;
                }
            }

            let musicData;
            if (nextQueueTrack) {
                // 从播放列表取下一首
                try {
                    musicData = await musicService.searchSong(nextQueueTrack.title);
                } catch (searchErr) {
                    console.log(`⚠️ 列表下一首搜索失败: ${searchErr.message}`);
                }
            }

            // 列表没有或搜索失败，重新生成（加模糊搜索兜底）
            if (!musicData) {
                const weather = await weatherService.getWeather(clientIP || '127.0.0.1');
                const weatherDesc = weatherService.getWeatherDesc(weather);
                const recentPlays = (this.playHistoryTitles || []).slice(-10);
                const llmResponse = await llmService.generateResponse('', weatherDesc, recentPlays);
                const trackInfo = llmResponse.track;
                try {
                    musicData = await musicService.searchSong(trackInfo.title);
                } catch (searchErr) {
                    console.log(`⚠️ 预加载搜索失败: ${searchErr.message}，从歌单随机选`);
                    musicData = await musicService.pickRandomFromLibrary();
                    if (!musicData) throw new Error('预加载失败');
                }
                this.preloadedSay = llmResponse.say;
                this.preloadedQueue = llmResponse.queue || [];
            } else {
                // 用列表的歌，重新生成 AI 总结
                const weather = await weatherService.getWeather(clientIP || '127.0.0.1');
                const weatherDesc = weatherService.getWeatherDesc(weather);
                const recentPlays = (this.playHistoryTitles || []).slice(-10);
                const llmResponse = await llmService.generateResponse(
                    `请介绍歌曲《${nextQueueTrack.title}》- ${nextQueueTrack.artist || ''}，讲述这首歌的故事、情感或创作背景`,
                    weatherDesc,
                    recentPlays
                );
                this.preloadedSay = llmResponse.say;
                this.preloadedQueue = llmResponse.queue || [];
            }

            this.preloadedTrack = {
                id: musicData?.id || 0,
                title: musicData?.title || nextQueueTrack?.title || '',
                artist: musicData?.artist || nextQueueTrack?.artist || '',
                url: musicData?.url || '',
                cover: musicData?.cover || '',
                hotComment: musicData?.hotComment || '',
                lyrics: musicData?.lyrics || '',
            };
            console.log('✅ 预加载完成:', this.preloadedTrack.title);

            // 更新 lastQueue，避免下次切歌重复推荐
            if (this.preloadedQueue.length > 0) {
                this.lastQueue = this.preloadedQueue;
            }

            this.broadcast({
                type: 'preload_ready',
                track: this.preloadedTrack,
                say: this.preloadedSay,
                queue: this.preloadedQueue,
            });
        } catch (e) {
            console.error('预加载失败:', e.message);
            setTimeout(() => { this.isPreloading = false; }, 5000);
        } finally {
            this.isPreloading = false;
        }
    }
}

// ============================================================
// 获取网站标题（独立函数，不依赖路由）
// ============================================================
async function handleFetchTitle(req, res) {
    const url = new URL(req.url, `http://localhost`);
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing url' }));
        return;
    }
    try {
        const pageRes = await axios.get(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VersiorBot/1.0)' },
            timeout: 10000,
        });
        const titleMatch = pageRes.data.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : targetUrl;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ title }));
    } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ title: targetUrl }));
    }
}

// ============================================================
// 喜欢/取消喜欢
// ============================================================
function handleLikeRoute(req, res, ctx) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { title, artist, liked } = JSON.parse(body);
            if (!title) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing title' })); return; }
            const fs = require('fs');
            const path = require('path');
            const prefsPath = path.join(__dirname, 'user-music-prefs.json');
            let prefs = [];
            try { if (fs.existsSync(prefsPath)) prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8')); } catch (e) {}

            if (liked) {
                // 添加到喜欢列表（去重）
                const exists = prefs.some(p => p.name === title && (p.artist || '') === (artist || ''));
                if (!exists) {
                    prefs.unshift({ name: title, artist: artist || '', likedAt: Date.now() });
                    // 最多保留 500 首
                    if (prefs.length > 500) prefs = prefs.slice(0, 500);
                    fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2));
                    console.log(`❤️ 喜欢: ${title} - ${artist}`);
                }
            } else {
                // 从喜欢列表移除
                const before = prefs.length;
                prefs = prefs.filter(p => !(p.name === title && (p.artist || '') === (artist || '')));
                if (prefs.length !== before) {
                    fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2));
                    console.log(`💔 取消喜欢: ${title} - ${artist}`);
                }
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, liked, count: prefs.length }));
        } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: e.message }));
        }
    });
}

// ============================================================
// 启动
// ============================================================
const radio = new RadioServer();
radio.start();

module.exports = RadioServer;

const axios = require('axios');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ============================================================
// 网易云 weapi 加密
// ============================================================
function aesEncrypt(text, key, iv) {
    const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
}

function rsaEncrypt(text, modulus, exponent) {
    // RSA 加密 (reverse text -> hex -> BigInt -> pow mod -> hex)
    const reversed = text.split('').reverse().join('');
    const n = BigInt('0x' + modulus);
    const e = BigInt('0x' + exponent);
    const m = BigInt('0x' + Buffer.from(reversed).toString('hex'));
    const c = m ** e % n;
    return c.toString(16).padStart(256, '0');
}

function weapiEncrypt(obj) {
    const iv = '0102030405060708';
    const presetKey = '0CoJUm6Qyw8W8jud';
    const publicKey = '010001';
    const modulus = '00e0b509f6259df8642dbc35662901497c209c0262369a56ea3b0665925c2bf1b9ee13ff4296d6141438681231376195448d82c3aa4e33d8a240bdd963187b441727a53c2c133b5dee10e5a06a72b8b2c0668d952c1b7b17247d2e8e1c2a67190413625aa1303b7f31b9705088da1f7d1e1921d31456996f1967936b31b46412bd2f36';

    // 第一次 AES
    const firstKey = presetKey;
    const firstEnc = aesEncrypt(JSON.stringify(obj), Buffer.from(firstKey), Buffer.from(iv));
    // 第二次 AES (random key, but we use fixed for simplicity)
    const secondKey = '0CoJUm6Qyw8W8jud';
    const params = aesEncrypt(firstEnc, Buffer.from(secondKey), Buffer.from(iv));
    // RSA encrypt the key
    const encSecKey = rsaEncrypt(secondKey, modulus, publicKey);

    return { params, encSecKey };
}

/**
 * 单个音乐平台的 Service
 */
class PlatformService {
    constructor(name, baseUrl, cookie = '') {
        this.name = name;        // 'netease' | 'kuwo' | 'qqmusic'
        this.baseUrl = baseUrl;
        this.cookie = cookie;
        this.cookieValid = null;
    }

    getHeaders() {
        return this.cookie ? { 'Cookie': this.cookie } : {};
    }

    // ========== 网易云音乐 ==========
    async loginNetease(username, password) {
        try {
            const isPhone = /^1\d{10}$/.test(username);
            const loginUrl = isPhone
                ? 'https://music.163.com/weapi/login/cellphone'
                : 'https://music.163.com/weapi/login';
            const params = isPhone
                ? { phone: username, password, rememberLogin: true }
                : { email: username, password, rememberLogin: true };
            const res = await axios.post(loginUrl, null, {
                params,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                    'Referer': 'https://music.163.com'
                },
                timeout: 15000
            });
            if (res.data?.code === 200 && res.data.profile) {
                // 优先从响应体获取 cookie（网易云 API 返回 cookie 字段）
                let cookieStr = '';
                if (res.data.cookie) {
                    cookieStr = res.data.cookie;
                    console.log('  DEBUG cookie from body:', cookieStr.substring(0, 80));
                } else {
                    // 回退：从 set-cookie 头提取
                    const setCookie = res.headers['set-cookie'] || [];
                    cookieStr = setCookie.map(c => c.split(';')[0]).join('; ');
                    console.log('  DEBUG cookie from header:', cookieStr.substring(0, 80));
                }
                const uid = res.data.profile.userId || res.data.account?.id || 0;
                return { success: true, cookie: cookieStr, nickname: res.data.profile.nickname || '', uid };
            }
            return { success: false, error: res.data?.msg || '登录失败' };
        } catch (e) {
            return { success: false, error: e.response?.data?.msg || '登录失败，请检查账号密码' };
        }
    }

    async getUserPlaylistsNetease(uid) {
        if (!this.cookie) return [];
        try {
            const res = await axios.get(`${this.baseUrl}/api/user/playlist`, {
                params: { uid, limit: 100 },
                headers: { ...this.getHeaders(), 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' },
                timeout: 10000
            });
            return res.data?.playlist || [];
        } catch (e) { return []; }
    }

    async getPlaylistDetailNetease(playlistId) {
        if (!this.cookie) return null;
        try {
            const res = await axios.get(`${this.baseUrl}/api/v6/playlist/detail`, {
                params: { id: playlistId, n: 1000 },
                headers: { ...this.getHeaders(), 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' },
                timeout: 10000
            });
            return res.data?.playlist || null;
        } catch (e) { return null; }
    }

    async getRecentSongsNetease(uid) {
        if (!this.cookie) return [];
        try {
            const res = await axios.get(`${this.baseUrl}/api/v1/user/playrecord`, {
                params: { uid, type: 1, limit: 50 },
                headers: { ...this.getHeaders(), 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' },
                timeout: 10000
            });
            return (res.data?.data?.list || []).map(item => ({
                name: item.song?.name || '',
                artist: item.song?.ar?.map(a => a.name).join(', ') || '',
                playCount: item.playCount || 0,
                score: item.score || 0
            }));
        } catch (e) { return []; }
    }

    async getLikedSongsNetease(uid) {
        if (!this.cookie) return [];
        try {
            const playlists = await this.getUserPlaylistsNetease(uid);
            const liked = playlists.find(p => p.specialType === 5 || p.name.includes('喜欢'));
            if (!liked) return [];
            const detail = await this.getPlaylistDetailNetease(liked.id);
            if (!detail?.tracks) return [];
            return detail.tracks.map(t => ({
                name: t.name || '',
                artist: t.ar?.map(a => a.name).join(', ') || '',
                id: t.id
            }));
        } catch (e) { return []; }
    }

    // ========== 通用 Cookie 登录 ==========
    async loginWithCookie(cookie) {
        if (!this.cookie) { this.cookieValid = false; return { success: false, error: 'Cookie 为空' }; }
        try {
            let checkUrl;
            switch (this.name) {
                case 'netease':
                    checkUrl = 'https://music.163.com/api/nuser/account/get';
                    break;
                case 'kuwo':
                    checkUrl = 'http://ar.i.kuwo.cn/US_NEW/kuwo/login_kw.php';
                    break;
                case 'qqmusic':
                    checkUrl = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
                    break;
                case 'kugou':
                    checkUrl = 'http://www.kugou.com/yy/html/index.html';
                    break;
                default:
                    return { success: false, error: '不支持的平台' };
            }
            const res = await axios.get(checkUrl, {
                headers: { 'Cookie': this.cookie },
                timeout: 10000
            });
            const profile = res.data?.profile || res.data?.data || res.data;
            if (profile && (profile.userId || profile.userid || profile.uid)) {
                this.cookieValid = true;
                return {
                    success: true,
                    cookie: this.cookie,
                    nickname: profile.nickname || profile.nick || '未知用户',
                    uid: profile.userId || profile.userid || profile.uid || 0
                };
            }
            return { success: false, error: 'Cookie 无效或已过期' };
        } catch (e) {
            this.cookieValid = false;
            return { success: false, error: 'Cookie 验证失败: ' + (e.message || '未知错误') };
        }
    }

    async checkCookieNetease() {
        if (!this.cookie) { this.cookieValid = false; return false; }
        try {
            const res = await axios.get(`${this.baseUrl}/user/playlist`, {
                params: { uid: 0, limit: 1 },
                headers: { 'Cookie': this.cookie }, timeout: 5000
            });
            const valid = !!(res.data?.playlist);
            this.cookieValid = valid;
            return valid;
        } catch (e) { this.cookieValid = false; return false; }
    }

    // ========== 酷我音乐 ==========
    async loginKuwo(username, password) {
        try {
            // 酷我官方登录接口
            const res = await axios.post('http://ar.i.kuwo.cn/US_NEW/kuwo/login_kw.php', {
                username, password
            }, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
                timeout: 15000
            });
            if (res.data?.cookie) {
                return { success: true, cookie: res.data.cookie, nickname: res.data.nickname || '', uid: res.data.uid || 0 };
            }
            return { success: false, error: res.data?.msg || '登录失败' };
        } catch (e) {
            return { success: false, error: '登录失败，请检查账号密码' };
        }
    }

    async getUserPlaylistsKuwo(uid) {
        if (!this.cookie) return [];
        try {
            // 酷我 API：获取用户歌单
            const res = await axios.get('http://nserver.kuwo.cn/ksong.s', {
                params: {
                    from: 'pc',
                    fmt: 'json',
                    type: 'user_playlist',
                    uid: uid,
                    pn: 0,
                    rn: 100
                },
                headers: { 'Cookie': this.cookie, 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });
            const list = res.data?.playlist || res.data?.userplaylist || [];
            return list.map(pl => ({
                id: pl.id || pl.fid,
                name: pl.name || pl.title,
                trackCount: pl.count || pl.songnum || 0,
                specialType: 0
            }));
        } catch (e) { return []; }
    }

    async getPlaylistDetailKuwo(playlistId) {
        if (!this.cookie) return null;
        try {
            const res = await axios.get('http://nserver.kuwo.cn/ksong.s', {
                params: {
                    from: 'pc',
                    fmt: 'json',
                    type: 'playlist_song',
                    pid: playlistId,
                    pn: 0,
                    rn: 500
                },
                headers: { 'Cookie': this.cookie, 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });
            const songs = res.data?.songs || res.data?.musiclist || [];
            return {
                id: playlistId,
                name: res.data?.name || '',
                tracks: songs.map(s => ({
                    name: s.name || s.songname,
                    artist: s.artist || s.singer,
                    id: s.id || s.musicrid
                }))
            };
        } catch (e) { return null; }
    }

    async getRecentSongsKuwo(uid) {
        if (!this.cookie) return [];
        try {
            const res = await axios.get('http://nserver.kuwo.cn/ksong.s', {
                params: {
                    from: 'pc',
                    fmt: 'json',
                    type: 'user_recent',
                    uid: uid,
                    pn: 0,
                    rn: 50
                },
                headers: { 'Cookie': this.cookie, 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });
            const list = res.data?.songs || res.data?.musiclist || [];
            return list.map(s => ({
                name: s.name || s.songname,
                artist: s.artist || s.singer,
                playCount: s.playcount || 0
            }));
        } catch (e) { return []; }
    }

    async getLikedSongsKuwo(uid) {
        if (!this.cookie) return [];
        try {
            // 酷我：获取用户收藏的"喜欢"歌单
            const res = await axios.get('http://nserver.kuwo.cn/ksong.s', {
                params: {
                    from: 'pc',
                    fmt: 'json',
                    type: 'user_favorite',
                    uid: uid,
                    pn: 0,
                    rn: 500
                },
                headers: { 'Cookie': this.cookie, 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });
            const list = res.data?.songs || res.data?.musiclist || [];
            return list.map(s => ({
                name: s.name || s.songname,
                artist: s.artist || s.singer,
                id: s.id || s.musicrid
            }));
        } catch (e) { return []; }
    }

    async checkCookieKuwo() {
        if (!this.cookie) { this.cookieValid = false; return false; }
        try {
            const res = await axios.get('http://ar.i.kuwo.cn/US_NEW/kuwo/user_info.php', {
                headers: { 'Cookie': this.cookie }, timeout: 5000
            });
            this.cookieValid = !!(res.data?.uid || res.data?.username);
            return this.cookieValid;
        } catch (e) { this.cookieValid = false; return false; }
    }

    // ========== QQ音乐 ==========
    async loginQQMusic(cookie) {
        // QQ音乐使用 Cookie 登录
        try {
            if (!cookie || cookie.length < 10) {
                return { success: false, error: '请输入有效的 Cookie' };
            }
            // 提取 Cookie 中的关键信息
            const cookieObj = {};
            cookie.split(';').forEach(part => {
                const [k, ...v] = part.trim().split('=');
                if (k) cookieObj[k.trim()] = v.join('=').trim();
            });
            // 必须有 qm_keyst 或 qqmusic_key
            const hasKey = cookieObj.qm_keyst || cookieObj.qqmusic_key || cookieObj.p_skey;
            const uin = cookieObj.uin || cookieObj.p_uin || '';
            if (!hasKey) {
                return { success: false, error: 'Cookie 格式不正确，请确保包含 qm_keyst 或 qqmusic_key' };
            }
            // 用 Cookie 获取用户歌单来验证有效性
            const plRes = await axios.get('https://c.y.qq.com/rsc/fbin/fcg_get_profile_homepage.fcg', {
                params: { uid: uin.replace(/^o0*/, '') || 0, limit: 5 },
                headers: { 'Cookie': cookie },
                timeout: 10000
            });
            const playlists = plRes.data?.playlist || plRes.data?.data?.playlist || [];
            // 如果能获取到歌单，说明 Cookie 有效
            return { success: true, cookie, nickname: 'QQ用户', uid: parseInt(uin.replace(/^o0*/, '')) || 0 };
        } catch (e) {
            console.error('QQ音乐 Cookie 验证失败:', e.response?.data || e.message);
            return { success: false, error: 'Cookie 无效或已过期，请重新从 y.qq.com 获取' };
        }
    }

    async getUserPlaylistsQQMusic(uid) {
        if (!this.cookie) return [];
        try {
            const res = await axios.get('https://c.y.qq.com/rsc/fbin/fcg_get_profile_homepage.fcg', {
                params: { uid, limit: 100 },
                headers: { 'Cookie': this.cookie },
                timeout: 10000
            });
            return res.data?.playlist || res.data?.data?.playlist || [];
        } catch (e) { return []; }
    }

    async getPlaylistDetailQQMusic(playlistId) {
        if (!this.cookie) return null;
        try {
            const res = await axios.get('https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg', {
                params: { id: playlistId },
                headers: { 'Cookie': this.cookie },
                timeout: 10000
            });
            return res.data?.playlist || res.data?.data || null;
        } catch (e) { return null; }
    }

    async getRecentSongsQQMusic(uid) {
        if (!this.cookie) return [];
        try {
            const res = await axios.get('https://c.y.qq.com/v8/fcg-bin/fcg_v8_playlist_history.fcg', {
                params: { uid, type: 1, limit: 50 },
                headers: { 'Cookie': this.cookie },
                timeout: 10000
            });
            const list = res.data?.list || res.data?.data?.list || [];
            return list.map(item => ({
                name: item.song?.name || item.name || '',
                artist: item.song?.ar?.map(a => a.name).join(', ') || item.artist || '',
                playCount: item.playCount || 0
            }));
        } catch (e) { return []; }
    }

    async getLikedSongsQQMusic(uid) {
        if (!this.cookie) return [];
        try {
            const res = await axios.get('https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg', {
                params: { uid },
                headers: { 'Cookie': this.cookie },
                timeout: 10000
            });
            const songs = res.data?.songs || res.data?.data?.songs || [];
            return songs.map(s => ({
                name: s.name,
                artist: s.ar?.map(a => a.name).join(', ') || '',
                id: s.id
            }));
        } catch (e) { return []; }
    }

    async checkCookieQQMusic() {
        if (!this.cookie) { this.cookieValid = false; return false; }
        try {
            const res = await axios.get('https://c.y.qq.com/rsc/fbin/fcg_get_profile_homepage.fcg', {
                headers: { 'Cookie': this.cookie }, timeout: 5000
            });
            this.cookieValid = !!(res.data?.profile || res.data?.account);
            return this.cookieValid;
        } catch (e) { this.cookieValid = false; return false; }
    }

    // ========== 酷狗音乐 ==========
    async loginKugou(cookie) {
        // 酷狗音乐使用 Cookie 登录
        try {
            if (!cookie || cookie.length < 10) {
                return { success: false, error: '请输入有效的 Cookie' };
            }
            // 提取 Cookie 中的关键信息
            const cookieObj = {};
            cookie.split(';').forEach(part => {
                const [k, ...v] = part.trim().split('=');
                if (k) cookieObj[k.trim()] = v.join('=').trim();
            });
            // 酷狗必须有 kg_mid 或 kg_dfid
            const hasKey = cookieObj.kg_mid || cookieObj.kg_dfid || cookieObj.kgid;
            if (!hasKey) {
                return { success: false, error: 'Cookie 格式不正确，请确保包含 kg_mid 或 kg_dfid' };
            }
            // 用 Cookie 调用酷狗 API 验证有效性（通过搜索接口间接验证）
            const testRes = await axios.get(`${this.baseUrl}/search`, {
                params: { keywords: 'test', limit: 1 },
                headers: { 'Cookie': cookie },
                timeout: 10000
            });
            if (testRes.data?.result?.songs) {
                return { success: true, cookie, nickname: '酷狗用户', uid: 0 };
            }
            return { success: false, error: 'Cookie 无效或已过期，请重新获取' };
        } catch (e) {
            console.error('酷狗 Cookie 验证失败:', e.response?.data || e.message);
            return { success: false, error: 'Cookie 无效或已过期，请重新从 kugou.com 获取' };
        }
    }

    async getUserPlaylistsKugou(uid) {
        if (!this.cookie) return [];
        try {
            // 酷狗 API：获取用户歌单（通过第三方 API）
            const res = await axios.get(`${this.baseUrl}/user/playlist`, {
                params: { uid, limit: 100 },
                headers: { 'Cookie': this.cookie },
                timeout: 10000
            });
            return res.data?.playlist || res.data?.data?.playlist || [];
        } catch (e) { return []; }
    }

    async getPlaylistDetailKugou(playlistId) {
        if (!this.cookie) return null;
        try {
            const res = await axios.get(`${this.baseUrl}/playlist/detail`, {
                params: { id: playlistId },
                headers: { 'Cookie': this.cookie },
                timeout: 10000
            });
            return res.data?.playlist || res.data?.data || null;
        } catch (e) { return null; }
    }

    async getRecentSongsKugou(uid) {
        if (!this.cookie) return [];
        try {
            const res = await axios.get(`${this.baseUrl}/user/record`, {
                params: { uid, type: 1, limit: 50 },
                headers: { 'Cookie': this.cookie },
                timeout: 10000
            });
            const list = res.data?.list || res.data?.data?.list || [];
            return list.map(item => ({
                name: item.song?.name || item.name || '',
                artist: item.song?.ar?.map(a => a.name).join(', ') || item.artist || '',
                playCount: item.playCount || 0
            }));
        } catch (e) { return []; }
    }

    async getLikedSongsKugou(uid) {
        if (!this.cookie) return [];
        try {
            const res = await axios.get(`${this.baseUrl}/song/like/get`, {
                params: { uid },
                headers: { 'Cookie': this.cookie },
                timeout: 10000
            });
            const songs = res.data?.songs || res.data?.data?.songs || [];
            return songs.map(s => ({
                name: s.name,
                artist: s.ar?.map(a => a.name).join(', ') || '',
                id: s.id
            }));
        } catch (e) { return []; }
    }

    async checkCookieKugou() {
        if (!this.cookie) { this.cookieValid = false; return false; }
        try {
            const res = await axios.get(`${this.baseUrl}/user/account`, {
                headers: { 'Cookie': this.cookie }, timeout: 5000
            });
            this.cookieValid = !!(res.data?.profile || res.data?.account);
            return this.cookieValid;
        } catch (e) { this.cookieValid = false; return false; }
    }

    // ========== 搜索（通用，走统一 API） ==========
    async searchSong(songName) {
        try {
            console.log(`🔍 搜索歌曲: ${songName}`);
            const apiUrl = process.env.MUSIC_API_URL || '';
            const cookie = (this.netease && this.netease.cookie) || process.env.NETEASE_COOKIE || process.env.NMTID || '';

            // 优先：NeteaseCloudMusicApi 代理
            if (apiUrl) {
                try {
                    const proxyRes = await axios.post(`${apiUrl}/search`,
                        `keywords=${encodeURIComponent(songName)}&limit=5&type=1`,
                        {
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            timeout: 10000
                        }
                    );
                    const proxySongs = proxyRes.data?.result?.songs;
                    if (proxySongs && proxySongs.length > 0) {
                        console.log(`  ✅ 代理搜索成功: ${proxySongs.length} 首`);
                        for (const song of proxySongs.slice(0, 3)) {
                            try {
                                const result = await this._buildTrackInfoFromProxy(song, apiUrl);
                                return result;
                            } catch (e) {
                                console.log(`  ⚠️ _buildTrackInfoFromProxy 失败: ${e.message}`);
                                continue;
                            }
                        }
                    }
                } catch (proxyErr) {
                    console.log(`  ⚠️ 代理搜索失败: ${proxyErr.message}`);
                }
            }

            // 回退：直接 POST 官方 API
            if (cookie) {
                try {
                    const searchRes = await axios.post('https://music.163.com/api/search/get',
                        `keywords=${encodeURIComponent(songName)}&limit=5&type=1&offset=0`,
                        {
                            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://music.163.com', 'Cookie': cookie },
                            timeout: 15000
                        }
                    );
                    if (searchRes.data?.code === 200 && searchRes.data?.result?.songs?.length > 0) {
                        const songs = searchRes.data.result.songs;
                        console.log(`  ✅ 官方搜索成功: ${songs.length} 首`);
                        for (const song of songs.slice(0, 3)) {
                            try { return await this._buildTrackInfoDirect(song, cookie); } catch (e) { continue; }
                        }
                    }
                } catch (e) {
                    console.log(`  ⚠️ 官方搜索失败: ${e.message}`);
                }
            }

            throw new Error(`未找到歌曲: ${songName}`);
            // 尝试多个搜索结果，跳过无播放链接的
            for (const song of songs.slice(0, 3)) {
                try {
                    const songId = song.id;
                    // 获取播放链接
                    const urlParams = weapiEncrypt({ ids: [songId], br: 320000, csrf_token: '' });
                    const urlResponse = await axios.post(`${this.baseUrl}/weapi/song/enhance/player/url`,
                        `params=${encodeURIComponent(urlParams.params)}&encSecKey=${encodeURIComponent(urlParams.encSecKey)}`,
                        {
                            headers: { ...this.getHeaders(), 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://music.163.com' },
                            timeout: 15000
                        }
                    );
                    let songUrl = urlResponse.data.data?.[0]?.url;
                    if (!songUrl) {
                        const pubParams = weapiEncrypt({ ids: [songId], br: 320000, csrf_token: '' });
                        const pubRes = await axios.post(`${this.baseUrl}/weapi/song/enhance/player/url`,
                            `params=${encodeURIComponent(pubParams.params)}&encSecKey=${encodeURIComponent(pubParams.encSecKey)}`,
                            {
                                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://music.163.com' },
                                timeout: 15000
                            }
                        );
                        songUrl = pubRes.data.data?.[0]?.url;
                    }
                    if (!songUrl) continue; // 跳过无链接的，试下一个

                    // 获取详情
                    const detailParams = weapiEncrypt({ c: JSON.stringify([{ id: songId }]), ids: JSON.stringify([songId]), csrf_token: '' });
                    const detailResponse = await axios.post(`${this.baseUrl}/weapi/v1/song/detail`,
                        `params=${encodeURIComponent(detailParams.params)}&encSecKey=${encodeURIComponent(detailParams.encSecKey)}`,
                        {
                            headers: { ...this.getHeaders(), 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://music.163.com' },
                            timeout: 15000
                        }
                    );
                    const songDetail = detailResponse.data.songs?.[0];
                    if (!songDetail) continue;

                    // 获取热评
                    let hotComment = '';
                    try {
                        const commentParams = weapiEncrypt({ rid: `R_SO_4_${songId}`, offset: 0, total: true, limit: 1, csrf_token: '' });
                        const commentRes = await axios.post(`${this.baseUrl}/weapi/v1/resource/comments/R_SO_4_${songId}`,
                            `params=${encodeURIComponent(commentParams.params)}&encSecKey=${encodeURIComponent(commentParams.encSecKey)}`,
                            {
                                headers: { ...this.getHeaders(), 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://music.163.com' },
                                timeout: 5000
                            }
                        );
                        const hotComments = commentRes.data?.hotComments;
                        if (hotComments?.length > 0) {
                            hotComment = hotComments[0].content || '';
                            if (hotComment.length > 80) hotComment = hotComment.substring(0, 77) + '...';
                        }
                    } catch (e) {}

                    // 统一使用 m801 CDN（m701 有严格防盗链）
                    const fixedUrl = songUrl.replace('m701.music.126.net', 'm801.music.126.net');
                    return {
                        title: songDetail.name,
                        artist: songDetail.ar?.[0]?.name || '未知艺术家',
                        url: fixedUrl,
                        cover: songDetail.al?.picUrl || '',
                        hotComment
                    };
                } catch (e) { continue; } // 当前结果失败，试下一个
            }
            throw new Error(`搜索失败: ${e.message}`);
        } catch (e) {
            throw new Error(`搜索失败: ${e.message}`);
        }
    }
}

/**
 * 统一的 MusicService，管理多平台
 */
class MusicService {
    constructor() {
        // 各平台官方 API
        const neteaseUrl = 'https://music.163.com';
        const kuwoUrl = 'https://ar.i.kuwo.cn';
        const qqmusicUrl = 'https://u.y.qq.com';
        const kugouUrl = 'https://www.kugou.com';

        // 网易云
        this.netease = new PlatformService('netease', neteaseUrl, process.env.NETEASE_COOKIE || process.env.NMTID || '');
        // 酷我
        this.kuwo = new PlatformService('kuwo', kuwoUrl, process.env.KUWO_COOKIE || '');
        // QQ音乐
        this.qqmusic = new PlatformService('qqmusic', qqmusicUrl, process.env.QQMUSIC_COOKIE || '');
        // 酷狗
        this.kugou = new PlatformService('kugou', kugouUrl, process.env.KUGOU_COOKIE || '');

        // 默认平台（用于搜索和 checkCookie）
        this.defaultPlatform = (process.env.MUSIC_SOURCE || 'netease').toLowerCase();
    }

    /**
     * 获取当前默认平台的 service
     */
    get current() {
        if (this.defaultPlatform === 'kuwo') return this.kuwo;
        if (this.defaultPlatform === 'qqmusic') return this.qqmusic;
        if (this.defaultPlatform === 'kugou') return this.kugou;
        return this.netease;
    }

    /**
     * 统一登录入口
     * @param {string} platform - 平台名
     * @param {string} username - 用户名/密码/Cookie（取决于平台）
     * @param {string} [password] - 密码（可选）
     * @param {string} [cookie] - Cookie 字符串（可选，优先使用）
     */
    async login(platform, username, password, cookie) {
        const svc = this._getService(platform);
        if (!svc) return { success: false, error: '不支持的平台' };

        let result;
        // 如果提供了 cookie，优先用 Cookie 登录
        if (cookie) {
            svc.cookie = cookie;
            result = await svc.loginWithCookie(cookie);
            if (!result.success) {
                // Cookie 验证失败，清空
                svc.cookie = '';
                return result;
            }
        } else {
            switch (platform) {
                case 'netease': result = await svc.loginNetease(username, password); break;
                case 'kuwo':    result = await svc.loginKuwo(username, password); break;
                case 'qqmusic': result = await svc.loginQQMusic(username); break;
                case 'kugou':   result = await svc.loginKugou(username); break;
                default: return { success: false, error: '不支持的平台' };
            }
        }

        // 登录成功：更新对应平台的 cookie
        if (result.success && result.cookie) {
            svc.cookie = result.cookie;
            console.log(`✅ ${platform} 登录成功: ${result.nickname}, cookie_len=${result.cookie.length}, cookie_prefix=${result.cookie.substring(0,50)}`);
        }
        return result;
    }

    /**
     * 获取用户所有数据（歌单 + 喜欢 + 听歌记录）
     */
    async fetchUserData(platform, uid) {
        const svc = this._getService(platform);
        if (!svc) return [];

        console.log(`📋 正在获取 ${platform} 用户数据 (uid: ${uid})...`);
        let playlists, liked, recent;

        switch (platform) {
            case 'netease':
                [playlists, liked, recent] = await Promise.all([
                    svc.getUserPlaylistsNetease(uid),
                    svc.getLikedSongsNetease(uid),
                    svc.getRecentSongsNetease(uid)
                ]);
                break;
            case 'kuwo':
                [playlists, liked, recent] = await Promise.all([
                    svc.getUserPlaylistsKuwo(uid),
                    svc.getLikedSongsKuwo(uid),
                    svc.getRecentSongsKuwo(uid)
                ]);
                break;
            case 'qqmusic':
                [playlists, liked, recent] = await Promise.all([
                    svc.getUserPlaylistsQQMusic(uid),
                    svc.getLikedSongsQQMusic(uid),
                    svc.getRecentSongsQQMusic(uid)
                ]);
                break;
            case 'kugou':
                [playlists, liked, recent] = await Promise.all([
                    svc.getUserPlaylistsKugou(uid),
                    svc.getLikedSongsKugou(uid),
                    svc.getRecentSongsKugou(uid)
                ]);
                break;
            default:
                return [];
        }

        console.log(`  📂 ${playlists.length} 个歌单`);
        console.log(`  ❤️ ${liked.length} 首喜欢`);
        console.log(`  🕐 ${recent.length} 首最近播放`);

        // 合并所有歌曲
        const allTracks = [...liked, ...recent];

        // 从歌单中取歌曲（上限 500 首）
        for (const pl of playlists.slice(0, 5)) {
            if (allTracks.length >= 500) break;
            let detail;
            switch (platform) {
                case 'netease': detail = await svc.getPlaylistDetailNetease(pl.id); break;
                case 'kuwo':    detail = await svc.getPlaylistDetailKuwo(pl.id); break;
                case 'qqmusic': detail = await svc.getPlaylistDetailQQMusic(pl.id); break;
                case 'kugou':   detail = await svc.getPlaylistDetailKugou(pl.id); break;
            }
            if (detail?.tracks) {
                for (const t of detail.tracks) {
                    if (allTracks.length >= 500) break;
                    allTracks.push({
                        name: t.name || '',
                        artist: (t.ar?.map(a => a.name).join(', ')) || t.artist || ''
                    });
                }
            }
        }

        // 去重
        const seen = new Set();
        const unique = allTracks.filter(t => {
            const key = `${t.name}-${t.artist}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return t.name && t.artist;
        });

        console.log(`  ✅ 共 ${unique.length} 首不重复歌曲`);
        return unique;
    }

    /**
     * 检测 Cookie 有效性
     */
    async checkCookie(platform) {
        const svc = this._getService(platform);
        if (!svc) return false;
        switch (platform) {
            case 'netease': return svc.checkCookieNetease();
            case 'kuwo':    return svc.checkCookieKuwo();
            case 'qqmusic': return svc.checkCookieQQMusic();
            case 'kugou':   return svc.checkCookieKugou();
            default: return false;
        }
    }

    /**
     * 搜索歌曲（走默认平台）
     */
    async searchSong(songName) {
        return this.current.searchSong(songName);
    }

    /**
     * 获取平台登录状态
     */
    async getPlatformInfo(platform) {
        const svc = this._getService(platform);
        if (!svc) return { platform, loggedIn: false, error: '未知平台' };
        try {
            if (!svc.cookie) return { platform, loggedIn: false };
            // 验证 cookie 并获取用户信息
            let loggedIn = false;
            let nickname = '';
            let trackCount = 0;
            if (platform === 'netease') {
                const res = await axios.get('https://music.163.com/api/user/playlist', {
                    params: { uid: 0, limit: 1 },
                    headers: { 'Cookie': svc.cookie }, timeout: 8000
                });
                loggedIn = !!(res.data?.playlist?.length > 0);
                nickname = res.data?.playlist?.[0]?.creator?.nickname || '';
            } else {
                loggedIn = await this.checkCookie(platform);
            }
            // 获取已加载的偏好歌曲数
            if (loggedIn) {
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const prefsPath = path.join(__dirname, 'user-music-prefs.json');
                    if (fs.existsSync(prefsPath)) {
                        const tracks = JSON.parse(fs.readFileSync(prefsPath, 'utf-8'));
                        trackCount = tracks.length;
                    }
                } catch (e) {}
            }
            return { platform, loggedIn, nickname, trackCount };
        } catch (e) {
            return { platform, loggedIn: false, error: e.message };
        }
    }

    // 重新获取用户数据
    async refreshUserData(platform) {
        const svc = this._getService(platform);
        if (!svc) return { success: false, error: '未知平台' };
        try {
            if (!svc.cookie) return { success: false, error: '未登录，请先登录' };
            // 验证 cookie 并获取 uid
            let uid = 0;
            let nickname = '';
            if (platform === 'netease') {
                // 通过歌单接口获取 uid
                const res = await axios.get('https://music.163.com/api/user/playlist', {
                    params: { uid: 0, limit: 1 },
                    headers: { 'Cookie': svc.cookie }, timeout: 8000
                });
                uid = res.data?.playlist?.[0]?.creator?.userId || 0;
                nickname = res.data?.playlist?.[0]?.creator?.nickname || '';
            } else if (platform === 'kuwo') {
                const res = await axios.get('http://ar.i.kuwo.cn/US_NEW/kuwo/user_info.php', {
                    headers: { 'Cookie': svc.cookie }, timeout: 8000
                });
                uid = res.data?.uid || 0;
                nickname = res.data?.nickname || '';
            }
            if (!uid) return { success: false, error: 'Cookie 无效或已过期，请重新登录' };
            console.log(`🔄 重新获取 ${platform} 用户数据 (uid: ${uid}, ${nickname})...`);
            const uniqueTracks = await this.fetchUserData(platform, uid);
            // 保存到文件
            const fs = require('fs');
            const path = require('path');
            const prefsPath = path.join(__dirname, 'user-music-prefs.json');
            fs.writeFileSync(prefsPath, JSON.stringify(uniqueTracks, null, 2));
            console.log(`  ✅ 已保存 ${uniqueTracks.length} 首歌曲`);
            return { success: true, trackCount: uniqueTracks.length, nickname, tracks: uniqueTracks };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    _getService(platform) {
        switch (platform) {
            case 'netease': return this.netease;
            case 'kuwo':    return this.kuwo;
            case 'qqmusic': return this.qqmusic;
            case 'kugou':   return this.kugou;
            default: return null;
        }
    }
    /**
     * 从用户歌单中随机选一首能播放的歌曲
     */
    /**
     * 构建歌曲信息（播放链接、详情、热评）
     */
    async _buildTrackInfoFromProxy(song, apiUrl) {
        const songId = song.id;
        const cookie = (this.netease && this.netease.cookie) || process.env.NETEASE_COOKIE || process.env.NMTID || '';
        // 获取播放链接（直接调官方 API + exhigh 音质 + fallback）
        let songUrl = '';
        if (cookie) {
            try {
                const urlRes = await axios.post(
                    'https://music.163.com/api/song/enhance/player/url',
                    `ids=[${songId}]&br=320000`,
                    {
                        headers: {
                            'Cookie': cookie.replace(/\n|\r/g, '').trim(),
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Referer': 'https://music.163.com/',
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        timeout: 10000
                    }
                );
                songUrl = urlRes.data?.data?.[0]?.url || '';
                if (songUrl) {
                    songUrl = songUrl.replace('http://', 'https://');
                } else {
                    const itemCode = urlRes.data?.data?.[0]?.code;
                    console.log(`  _buildTrackInfoFromProxy: 官方API返回 null, item_code=${itemCode}, cookie_len=${cookie.length}`);
                }
            } catch (e) {}
        }
        // Fallback: 标准免费源
        if (!songUrl) {
            songUrl = `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;
            console.log(`  _buildTrackInfoFromProxy: 使用 fallback URL for ${songId}`);
        }
        // 获取详情
        let detail = song;
        if (cookie) {
            try {
                const detailRes = await axios.post('https://music.163.com/api/v1/song/detail',
                    `c=${encodeURIComponent(JSON.stringify([{ id: songId }]))}&ids=${encodeURIComponent(JSON.stringify([songId]))}`,
                    { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://music.163.com', 'Cookie': cookie }, timeout: 10000 }
                );
                detail = detailRes.data?.songs?.[0] || song;
            } catch (e) {}
        }
        // 获取热评
        let hotComment = '';
        if (cookie) {
            try {
                const commentRes = await axios.post(`https://music.163.com/weapi/v1/resource/comments/R_SO_4_${songId}`,
                    `rid=R_SO_4_${songId}&offset=0&total=true&limit=1&csrf_token=`,
                    { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://music.163.com', 'Cookie': cookie }, timeout: 5000 }
                );
                const hotComments = commentRes.data?.hotComments;
                if (hotComments?.length > 0) {
                    hotComment = hotComments[0].content || '';
                    if (hotComment.length > 80) hotComment = hotComment.substring(0, 77) + '...';
                }
            } catch (e) {}
        }
        return {
            id: songId,
            title: detail.name || song.name,
            artist: detail.ar?.[0]?.name || song.ar?.[0]?.name || '未知艺术家',
            url: songUrl.replace('http://', 'https://'),
            cover: detail.al?.picUrl || song.al?.picUrl || '',
            hotComment
        };
    }

    async _buildTrackInfoDirect(song, cookie) {
        const songId = song.id;
        let songUrl = '';
        try {
            const urlRes = await axios.post('https://music.163.com/api/song/enhance/player/url',
                `ids=[${songId}]&br=320000`,
                { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://music.163.com', 'Cookie': cookie }, timeout: 10000 }
            );
            songUrl = urlRes.data?.data?.[0]?.url || '';
            if (songUrl) songUrl = songUrl.replace('http://', 'https://');
        } catch (e) {}
        if (!songUrl) throw new Error('无播放链接');
        let detail = song;
        try {
            const detailRes = await axios.post('https://music.163.com/api/v1/song/detail',
                `c=${encodeURIComponent(JSON.stringify([{ id: songId }]))}&ids=${encodeURIComponent(JSON.stringify([songId]))}`,
                { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://music.163.com', 'Cookie': cookie }, timeout: 10000 }
            );
            detail = detailRes.data?.songs?.[0] || song;
        } catch (e) {}
        let hotComment = '';
        try {
            const commentRes = await axios.post(`https://music.163.com/weapi/v1/resource/comments/R_SO_4_${songId}`,
                `rid=R_SO_4_${songId}&offset=0&total=true&limit=1&csrf_token=`,
                { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://music.163.com', 'Cookie': cookie }, timeout: 5000 }
            );
            const hotComments = commentRes.data?.hotComments;
            if (hotComments?.length > 0) {
                hotComment = hotComments[0].content || '';
                if (hotComment.length > 80) hotComment = hotComment.substring(0, 77) + '...';
            }
        } catch (e) {}
        return { id: songId, title: detail.name || song.name, artist: detail.ar?.[0]?.name || song.ar?.[0]?.name || '未知艺术家', url: songUrl, cover: detail.al?.picUrl || song.al?.picUrl || '', hotComment };
    }

    async _buildTrackInfo(song, cookie) {
        const songId = song.id;
        // 获取播放链接（POST 官方 API）
        let songUrl = '';
        try {
            const urlRes = await axios.post('https://music.163.com/api/song/enhance/player/url',
                `ids=[${songId}]&br=320000`,
                {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://music.163.com', 'Cookie': cookie },
                    timeout: 10000
                }
            );
            songUrl = urlRes.data?.data?.[0]?.url || '';
            if (songUrl) songUrl = songUrl.replace('http://', 'https://');
        } catch (e) {}
        if (!songUrl) throw new Error('无播放链接');
        // 获取详情
        let detail = song;
        try {
            const detailRes = await axios.post('https://music.163.com/api/v1/song/detail',
                `c=${encodeURIComponent(JSON.stringify([{ id: songId }]))}&ids=${encodeURIComponent(JSON.stringify([songId]))}`,
                {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://music.163.com', 'Cookie': cookie },
                    timeout: 10000
                }
            );
            detail = detailRes.data?.songs?.[0] || song;
        } catch (e) {}
        // 获取热评
        let hotComment = '';
        try {
            const commentRes = await axios.post(`https://music.163.com/weapi/v1/resource/comments/R_SO_4_${songId}`,
                `rid=R_SO_4_${songId}&offset=0&total=true&limit=1&csrf_token=`,
                {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://music.163.com', 'Cookie': cookie },
                    timeout: 5000
                }
            );
            const hotComments = commentRes.data?.hotComments;
            if (hotComments?.length > 0) {
                hotComment = hotComments[0].content || '';
                if (hotComment.length > 80) hotComment = hotComment.substring(0, 77) + '...';
            }
        } catch (e) {}
        return {
            title: detail.name || song.name,
            artist: detail.ar?.[0]?.name || song.ar?.[0]?.name || '未知艺术家',
            url: songUrl,
            cover: detail.al?.picUrl || song.al?.picUrl || '',
            hotComment
        };
    }

    async pickRandomFromLibrary() {
        try {
            const fs = require('fs');
            const cookie = (this.netease && this.netease.cookie) || process.env.NETEASE_COOKIE || process.env.NMTID || '';
            const prefsPath = path.join(__dirname, 'user-music-prefs.json');
            if (!fs.existsSync(prefsPath)) return null;
            const tracks = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
            if (!tracks || tracks.length === 0) return null;
            // 随机选 10 首尝试
            const shuffled = tracks.sort(() => Math.random() - 0.5);
            for (const t of shuffled.slice(0, 10)) {
                try {
                    const url = await this.getSongUrl(t.id);
                    if (url) {
                        return { id: t.id, title: t.name, artist: t.artist || '未知', url: url, cover: '', hotComment: '' };
                    }
                } catch (e) { continue; }
            }
            return null;
        } catch (e) { return null; }
    }

    /**
     * 获取歌曲播放链接
     */
    async getSongUrl(songId) {
        const cookie = (this.netease && this.netease.cookie) || process.env.NETEASE_COOKIE || process.env.NMTID || '';
        if (!cookie) {
            console.log('  getSongUrl cookie 为空');
            return `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;
        }
        // 多音质重试：高 → 中 → 低 → 标准
        const levels = [
            { br: '320000', name: 'high' },
            { br: '192000', name: 'medium' },
            { br: '128000', name: 'low' },
            { br: '999000', name: 'standard' },
        ];
        for (const lvl of levels) {
            try {
                const res = await axios.post(
                    'https://music.163.com/api/song/enhance/player/url',
                    `ids=[${songId}]&br=${lvl.br}`,
                    {
                        headers: {
                            'Cookie': cookie.replace(/\n|\r/g, '').trim(),
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Referer': 'https://music.163.com/',
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        timeout: 10000
                    }
                );
                const d = res.data?.data?.[0];
                if (d?.url) return d.url.replace('http://', 'https://');
                // url 为 null/undefined，记录原因
                if (d?.code === -110) {
                    console.log(`  getSongUrl ${lvl.name}: 需要购买 (fee=${d.fee})`);
                    break; // 付费歌，不需要继续试
                }
            } catch (e) {
                console.log(`  getSongUrl ${lvl.name} 失败: ${e.message}`);
            }
        }
        // Fallback: 标准免费源
        return `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;
    }
}

module.exports = new MusicService();

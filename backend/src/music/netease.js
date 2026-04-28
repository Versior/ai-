const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BASE_URL = 'https://music.163.com';

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Referer': 'https://music.163.com',
};

function buildHeaders(cookie) {
    return cookie ? { ...DEFAULT_HEADERS, 'Cookie': cookie } : DEFAULT_HEADERS;
}

// ============================================================
// Cookie 管理
// ============================================================

async function getCookie() {
    return process.env.NETEASE_COOKIE || '';
}

async function setCookie(cookie) {
    process.env.NETEASE_COOKIE = cookie;
    // 同步写入 .env
    const envPath = path.join(__dirname, '..', '..', '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) envContent = fs.readFileSync(envPath, 'utf8');
    const regex = /^NETEASE_COOKIE=.*$/m;
    if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `NETEASE_COOKIE=${cookie}`);
    } else {
        envContent += `\nNETEASE_COOKIE=${cookie}`;
    }
    fs.writeFileSync(envPath, envContent.trim() + '\n');
}

// ============================================================
// 登录
// ============================================================

async function login(username, password) {
    const isPhone = /^1\d{10}$/.test(username);
    const loginUrl = isPhone
        ? `${BASE_URL}/api/login/cellphone`
        : `${BASE_URL}/api/login`;
    const params = isPhone
        ? { phone: username, password, rememberLogin: true }
        : { email: username, password, rememberLogin: true };

    const res = await axios.post(loginUrl, null, {
        params,
        headers: DEFAULT_HEADERS,
        timeout: 15000,
    });

    if (res.data?.code === 200 && res.data.profile) {
        let cookieStr = '';
        if (res.data.cookie) {
            cookieStr = res.data.cookie;
        } else {
            const setCookie = res.headers['set-cookie'] || [];
            cookieStr = setCookie.map(c => c.split(';')[0]).join('; ');
        }
        const uid = res.data.profile.userId || res.data.account?.id || 0;
        return {
            success: true,
            cookie: cookieStr,
            nickname: res.data.profile.nickname || '',
            uid,
        };
    }
    return { success: false, error: res.data?.msg || '登录失败' };
}

async function loginWithCookie(cookie) {
    if (!cookie) return { success: false, error: 'Cookie 为空' };
    try {
        const res = await axios.get(`${BASE_URL}/api/nuser/account/get`, {
            headers: buildHeaders(cookie),
            timeout: 10000,
        });
        const profile = res.data?.profile;
        if (profile && profile.userId) {
            return {
                success: true,
                cookie,
                nickname: profile.nickname || '未知用户',
                uid: profile.userId,
            };
        }
        return { success: false, error: 'Cookie 无效或已过期' };
    } catch (e) {
        return { success: false, error: 'Cookie 验证失败: ' + (e.message || '未知错误') };
    }
}

async function checkCookie() {
    const cookie = await getCookie();
    if (!cookie) return false;
    try {
        const res = await axios.get(`${BASE_URL}/api/user/playlist`, {
            params: { uid: 0, limit: 1 },
            headers: buildHeaders(cookie),
            timeout: 5000,
        });
        return !!(res.data?.playlist);
    } catch (e) {
        return false;
    }
}

// ============================================================
// 用户数据
// ============================================================

async function getUserPlaylists(uid) {
    const cookie = await getCookie();
    if (!cookie) return [];
    try {
        const res = await axios.get(`${BASE_URL}/api/user/playlist`, {
            params: { uid, limit: 100 },
            headers: { ...buildHeaders(cookie), 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' },
            timeout: 10000,
        });
        return res.data?.playlist || [];
    } catch (e) { return []; }
}

async function getPlaylistDetail(playlistId) {
    const cookie = await getCookie();
    if (!cookie) return null;
    try {
        const res = await axios.get(`${BASE_URL}/api/v6/playlist/detail`, {
            params: { id: playlistId, n: 1000 },
            headers: { ...buildHeaders(cookie), 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' },
            timeout: 10000,
        });
        return res.data?.playlist || null;
    } catch (e) { return null; }
}

async function getRecentSongs(uid) {
    const cookie = await getCookie();
    if (!cookie) return [];
    try {
        const res = await axios.get(`${BASE_URL}/api/v1/user/playrecord`, {
            params: { uid, type: 1, limit: 50 },
            headers: { ...buildHeaders(cookie), 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' },
            timeout: 10000,
        });
        return (res.data?.data?.list || []).map(item => ({
            name: item.song?.name || '',
            artist: item.song?.ar?.map(a => a.name).join(', ') || '',
            playCount: item.playCount || 0,
            score: item.score || 0,
        }));
    } catch (e) { return []; }
}

async function getLikedSongs(uid) {
    const cookie = await getCookie();
    if (!cookie) return [];
    try {
        const playlists = await getUserPlaylists(uid);
        const liked = playlists.find(p => p.specialType === 5 || p.name.includes('喜欢'));
        if (!liked) return [];
        const detail = await getPlaylistDetail(liked.id);
        if (!detail?.tracks) return [];
        return detail.tracks.map(t => ({
            name: t.name || '',
            artist: t.ar?.map(a => a.name).join(', ') || '',
            id: t.id,
        }));
    } catch (e) { return []; }
}

async function fetchAllUserTracks(uid) {
    const cookie = await getCookie();
    const allTracks = [];

    // 1. 获取用户所有歌单
    const playlists = await getUserPlaylists(uid);
    console.log(`  📋 找到 ${playlists.length} 个歌单`);

    for (const pl of playlists) {
        if (allTracks.length >= 500) break;
        try {
            const detail = await getPlaylistDetail(pl.id);
            if (detail?.tracks) {
                for (const t of detail.tracks) {
                    if (allTracks.length >= 500) break;
                    allTracks.push({
                        name: t.name || '',
                        artist: (t.ar?.map(a => a.name).join(', ')) || t.artist || '',
                    });
                }
            }
        } catch (e) { continue; }
    }

    // 2. 最近播放
    const recent = await getRecentSongs(uid);
    for (const t of recent) {
        if (allTracks.length >= 500) break;
        allTracks.push({ name: t.name, artist: t.artist });
    }

    // 3. 喜欢的音乐
    const liked = await getLikedSongs(uid);
    for (const t of liked) {
        if (allTracks.length >= 500) break;
        allTracks.push({ name: t.name, artist: t.artist, id: t.id });
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

// ============================================================
// 搜索
// ============================================================

async function searchSong(songName, excludeIds = []) {
    const cookie = await getCookie();
    console.log(`🔍 搜索歌曲: ${songName}${excludeIds.length ? ` (排除 ${excludeIds.length} 首)` : ''}`);

    if (!cookie) {
        throw new Error('未配置网易云 Cookie，无法搜索');
    }

    try {
        const searchRes = await axios.post(
            `${BASE_URL}/api/cloudsearch/pc`,
            `s=${encodeURIComponent(songName)}&type=1&limit=10&offset=0`,
            {
                headers: {
                    ...buildHeaders(cookie),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: 15000,
            }
        );

        if (searchRes.data?.code === 200 && searchRes.data?.result?.songs?.length > 0) {
            const songs = searchRes.data.result.songs;
            console.log(`  ✅ 搜索成功: ${songs.length} 首`);
            // 过滤掉已播放的歌曲
            const filtered = excludeIds.length > 0
                ? songs.filter(s => !excludeIds.includes(String(s.id)))
                : songs;
            if (filtered.length === 0) {
                console.log('  ⚠️ 所有结果都已播放过，返回原列表');
            }
            const candidates = filtered.length > 0 ? filtered : songs;
            for (const song of candidates.slice(0, 5)) {
                try {
                    return await buildTrackInfo(song, cookie);
                } catch (e) { continue; }
            }
        }
    } catch (e) {
        console.log(`  ⚠️ 搜索失败: ${e.message}`);
    }

    throw new Error(`未找到歌曲: ${songName}`);
}

async function buildTrackInfo(song, cookie) {
    const songId = song.id;

    // 获取播放链接
    let songUrl = '';
    try {
        const urlRes = await axios.post(
            `${BASE_URL}/api/song/enhance/player/url`,
            `ids=[${songId}]&br=320000`,
            {
                headers: {
                    ...buildHeaders(cookie),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: 10000,
            }
        );
        songUrl = urlRes.data?.data?.[0]?.url || '';
        if (songUrl) songUrl = songUrl.replace('http://', 'https://');
    } catch (e) {}

    if (!songUrl) throw new Error('无播放链接');

    // 获取详情
    let detail = song;
    try {
        const detailRes = await axios.post(
            `${BASE_URL}/api/v1/song/detail`,
            `c=${encodeURIComponent(JSON.stringify([{ id: songId }]))}&ids=${encodeURIComponent(JSON.stringify([songId]))}`,
            {
                headers: {
                    ...buildHeaders(cookie),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: 10000,
            }
        );
        detail = detailRes.data?.songs?.[0] || song;
    } catch (e) {}

    // 获取热评
    let hotComment = '';
    try {
        const commentRes = await axios.get(
            `${BASE_URL}/api/v1/resource/comments/R_SO_4_${songId}`,
            {
                params: { rid: `R_SO_4_${songId}`, offset: 0, total: true, limit: 1 },
                headers: buildHeaders(cookie),
                timeout: 5000,
            }
        );
        const hotComments = commentRes.data?.hotComments;
        if (hotComments?.length > 0) {
            hotComment = hotComments[0].content || '';
            if (hotComment.length > 80) hotComment = hotComment.substring(0, 77) + '...';
        }
    } catch (e) {}

    return {
        id: songId,
        title: detail.name || song.name,
        artist: detail.ar?.[0]?.name || song.ar?.[0]?.name || '未知艺术家',
        url: songUrl,
        cover: detail.al?.picUrl || song.al?.picUrl || '',
        hotComment,
    };
}

// ============================================================
// 播放链接
// ============================================================

async function getSongUrl(songId) {
    const cookie = await getCookie();
    if (!cookie) {
        return `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;
    }

    const levels = [
        { br: '320000', name: 'high' },
        { br: '192000', name: 'medium' },
        { br: '128000', name: 'low' },
        { br: '999000', name: 'standard' },
    ];

    for (const lvl of levels) {
        try {
            const res = await axios.post(
                `${BASE_URL}/api/song/enhance/player/url`,
                `ids=[${songId}]&br=${lvl.br}`,
                {
                    headers: {
                        'Cookie': cookie.replace(/\n|\r/g, '').trim(),
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://music.163.com/',
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    timeout: 10000,
                }
            );
            const d = res.data?.data?.[0];
            if (d?.url) return d.url.replace('http://', 'https://');
            if (d?.code === -110) break; // 付费歌
        } catch (e) {}
    }

    return `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;
}

// ============================================================
// 歌单随机选歌
// ============================================================

async function pickRandomFromLibrary() {
    const prefsPath = path.join(__dirname, '..', 'user-music-prefs.json');
    try {
        if (!fs.existsSync(prefsPath)) return null;
        const tracks = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
        if (!tracks || tracks.length === 0) return null;

        const shuffled = [...tracks].sort(() => Math.random() - 0.5);
        for (const t of shuffled.slice(0, 10)) {
            try {
                const url = await getSongUrl(t.id);
                if (url) {
                    return {
                        id: t.id,
                        title: t.name,
                        artist: t.artist || '未知',
                        url,
                        cover: '',
                        hotComment: '',
                    };
                }
            } catch (e) { continue; }
        }
        return null;
    } catch (e) { return null; }
}

// ============================================================
// 平台信息
// ============================================================

async function getPlatformInfo() {
    const cookie = await getCookie();
    if (!cookie) return { platform: 'netease', loggedIn: false };

    try {
        const res = await axios.get(`${BASE_URL}/api/user/playlist`, {
            params: { uid: 0, limit: 1 },
            headers: buildHeaders(cookie),
            timeout: 8000,
        });
        const loggedIn = !!(res.data?.playlist?.length > 0);
        const nickname = res.data?.playlist?.[0]?.creator?.nickname || '';

        let trackCount = 0;
        if (loggedIn) {
            try {
                const prefsPath = path.join(__dirname, '..', 'user-music-prefs.json');
                if (fs.existsSync(prefsPath)) {
                    const tracks = JSON.parse(fs.readFileSync(prefsPath, 'utf-8'));
                    trackCount = tracks.length;
                }
            } catch (e) {}
        }

        return { platform: 'netease', loggedIn, nickname, trackCount };
    } catch (e) {
        return { platform: 'netease', loggedIn: false, error: e.message };
    }
}

async function refreshUserData(uid) {
    const cookie = await getCookie();
    if (!cookie) return { success: false, error: '未登录，请先登录' };

    try {
        let resolvedUid = uid;
        let nickname = '';

        if (!resolvedUid) {
            const res = await axios.get(`${BASE_URL}/api/user/playlist`, {
                params: { uid: 0, limit: 1 },
                headers: buildHeaders(cookie),
                timeout: 8000,
            });
            resolvedUid = res.data?.playlist?.[0]?.creator?.userId || 0;
            nickname = res.data?.playlist?.[0]?.creator?.nickname || '';
        }

        if (!resolvedUid) return { success: false, error: 'Cookie 无效或已过期，请重新登录' };

        console.log(`🔄 重新获取网易云用户数据 (uid: ${resolvedUid}, ${nickname})...`);
        const uniqueTracks = await fetchAllUserTracks(resolvedUid);

        const prefsPath = path.join(__dirname, '..', 'user-music-prefs.json');
        fs.writeFileSync(prefsPath, JSON.stringify(uniqueTracks, null, 2));
        console.log(`  ✅ 已保存 ${uniqueTracks.length} 首歌曲`);

        return { success: true, trackCount: uniqueTracks.length, nickname, tracks: uniqueTracks };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

module.exports = {
    login,
    loginWithCookie,
    checkCookie,
    getCookie,
    setCookie,
    getUserPlaylists,
    getPlaylistDetail,
    getRecentSongs,
    getLikedSongs,
    fetchAllUserTracks,
    searchSong,
    buildTrackInfo,
    getSongUrl,
    pickRandomFromLibrary,
    getPlatformInfo,
    refreshUserData,
};

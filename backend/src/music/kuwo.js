const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BASE_URL = 'https://ar.i.kuwo.cn';

async function getCookie() {
    return process.env.KUWO_COOKIE || '';
}

async function setCookie(cookie) {
    process.env.KUWO_COOKIE = cookie;
    const envPath = path.join(__dirname, '..', '..', '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) envContent = fs.readFileSync(envPath, 'utf8');
    const regex = /^KUWO_COOKIE=.*$/m;
    if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `KUWO_COOKIE=${cookie}`);
    } else {
        envContent += `\nKUWO_COOKIE=${cookie}`;
    }
    fs.writeFileSync(envPath, envContent.trim() + '\n');
}

async function login(username, password) {
    try {
        const res = await axios.post(`${BASE_URL}/US_NEW/kuwo/login_kw.php`, {
            username, password
        }, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
            timeout: 15000,
        });
        if (res.data?.cookie) {
            return { success: true, cookie: res.data.cookie, nickname: res.data.nickname || '', uid: res.data.uid || 0 };
        }
        return { success: false, error: res.data?.msg || '登录失败' };
    } catch (e) {
        return { success: false, error: '登录失败，请检查账号密码' };
    }
}

async function loginWithCookie(cookie) {
    if (!cookie) return { success: false, error: 'Cookie 为空' };
    try {
        const res = await axios.get(`${BASE_URL}/US_NEW/kuwo/user_info.php`, {
            headers: { 'Cookie': cookie },
            timeout: 10000,
        });
        if (res.data?.uid || res.data?.username) {
            return { success: true, cookie, nickname: res.data.nickname || '酷狗用户', uid: res.data.uid || 0 };
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
        const res = await axios.get(`${BASE_URL}/US_NEW/kuwo/user_info.php`, {
            headers: { 'Cookie': cookie },
            timeout: 5000,
        });
        return !!(res.data?.uid || res.data?.username);
    } catch (e) { return false; }
}

async function fetchAllUserTracks(uid) {
    const cookie = await getCookie();
    const allTracks = [];

    try {
        const plRes = await axios.get('http://nserver.kuwo.cn/ksong.s', {
            params: { from: 'pc', fmt: 'json', type: 'user_playlist', uid, pn: 0, rn: 100 },
            headers: { 'Cookie': cookie, 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000,
        });
        const playlists = plRes.data?.playlist || plRes.data?.userplaylist || [];
        for (const pl of playlists) {
            if (allTracks.length >= 500) break;
            try {
                const detailRes = await axios.get('http://nserver.kuwo.cn/ksong.s', {
                    params: { from: 'pc', fmt: 'json', type: 'playlist_song', pid: pl.id || pl.fid, pn: 0, rn: 500 },
                    headers: { 'Cookie': cookie, 'User-Agent': 'Mozilla/5.0' },
                    timeout: 10000,
                });
                const songs = detailRes.data?.songs || detailRes.data?.musiclist || [];
                for (const s of songs) {
                    if (allTracks.length >= 500) break;
                    allTracks.push({ name: s.name || s.songname, artist: s.artist || s.singer });
                }
            } catch (e) { continue; }
        }
    } catch (e) {}

    // 最近播放
    try {
        const recentRes = await axios.get('http://nserver.kuwo.cn/ksong.s', {
            params: { from: 'pc', fmt: 'json', type: 'user_recent', uid, pn: 0, rn: 50 },
            headers: { 'Cookie': cookie, 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000,
        });
        const list = recentRes.data?.songs || recentRes.data?.musiclist || [];
        for (const s of list) {
            if (allTracks.length >= 500) break;
            allTracks.push({ name: s.name || s.songname, artist: s.artist || s.singer });
        }
    } catch (e) {}

    // 去重
    const seen = new Set();
    return allTracks.filter(t => {
        const key = `${t.name}-${t.artist}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return t.name && t.artist;
    });
}

async function getPlatformInfo() {
    const cookie = await getCookie();
    if (!cookie) return { platform: 'kuwo', loggedIn: false };
    try {
        const res = await axios.get(`${BASE_URL}/US_NEW/kuwo/user_info.php`, {
            headers: { 'Cookie': cookie },
            timeout: 8000,
        });
        const loggedIn = !!(res.data?.uid || res.data?.username);
        const nickname = res.data?.nickname || '';
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
        return { platform: 'kuwo', loggedIn, nickname, trackCount };
    } catch (e) {
        return { platform: 'kuwo', loggedIn: false, error: e.message };
    }
}

module.exports = {
    login,
    loginWithCookie,
    checkCookie,
    getCookie,
    setCookie,
    fetchAllUserTracks,
    getPlatformInfo,
};

const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BASE_URL = 'https://www.kugou.com';

async function getCookie() {
    return process.env.KUGOU_COOKIE || '';
}

async function setCookie(cookie) {
    process.env.KUGOU_COOKIE = cookie;
    const envPath = path.join(__dirname, '..', '..', '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) envContent = fs.readFileSync(envPath, 'utf8');
    const regex = /^KUGOU_COOKIE=.*$/m;
    if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `KUGOU_COOKIE=${cookie}`);
    } else {
        envContent += `\nKUGOU_COOKIE=${cookie}`;
    }
    fs.writeFileSync(envPath, envContent.trim() + '\n');
}

async function loginWithCookie(cookie) {
    if (!cookie || cookie.length < 10) {
        return { success: false, error: '请输入有效的 Cookie' };
    }
    try {
        const cookieObj = {};
        cookie.split(';').forEach(part => {
            const [k, ...v] = part.trim().split('=');
            if (k) cookieObj[k.trim()] = v.join('=').trim();
        });
        const hasKey = cookieObj.kg_mid || cookieObj.kg_dfid || cookieObj.kgid;
        if (!hasKey) {
            return { success: false, error: 'Cookie 格式不正确，请确保包含 kg_mid 或 kg_dfid' };
        }
        const testRes = await axios.get(`${BASE_URL}/search`, {
            params: { keywords: 'test', limit: 1 },
            headers: { 'Cookie': cookie },
            timeout: 10000,
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

async function checkCookie() {
    const cookie = await getCookie();
    if (!cookie) return false;
    try {
        const res = await axios.get(`${BASE_URL}/user/account`, {
            headers: { 'Cookie': cookie },
            timeout: 5000,
        });
        return !!(res.data?.profile || res.data?.account);
    } catch (e) { return false; }
}

async function fetchAllUserTracks(uid) {
    const cookie = await getCookie();
    const allTracks = [];

    try {
        const plRes = await axios.get(`${BASE_URL}/user/playlist`, {
            params: { uid, limit: 100 },
            headers: { 'Cookie': cookie },
            timeout: 10000,
        });
        const playlists = plRes.data?.playlist || plRes.data?.data?.playlist || [];
        for (const pl of playlists) {
            if (allTracks.length >= 500) break;
            try {
                const detailRes = await axios.get(`${BASE_URL}/playlist/detail`, {
                    params: { id: pl.id },
                    headers: { 'Cookie': cookie },
                    timeout: 10000,
                });
                const data = detailRes.data?.playlist || detailRes.data?.data || {};
                const songs = data.songs || data.musics || [];
                for (const s of songs) {
                    if (allTracks.length >= 500) break;
                    allTracks.push({ name: s.name || s.songname, artist: s.artist || s.singer });
                }
            } catch (e) { continue; }
        }
    } catch (e) {}

    // 最近播放
    try {
        const recentRes = await axios.get(`${BASE_URL}/user/record`, {
            params: { uid, type: 1, limit: 50 },
            headers: { 'Cookie': cookie },
            timeout: 10000,
        });
        const list = recentRes.data?.list || recentRes.data?.data?.list || [];
        for (const item of list) {
            if (allTracks.length >= 500) break;
            allTracks.push({
                name: item.song?.name || item.name || '',
                artist: item.song?.ar?.map(a => a.name).join(', ') || item.artist || '',
            });
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
    if (!cookie) return { platform: 'kugou', loggedIn: false };
    try {
        const res = await axios.get(`${BASE_URL}/user/account`, {
            headers: { 'Cookie': cookie },
            timeout: 8000,
        });
        const loggedIn = !!(res.data?.profile || res.data?.account);
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
        return { platform: 'kugou', loggedIn, nickname: '酷狗用户', trackCount };
    } catch (e) {
        return { platform: 'kugou', loggedIn: false, error: e.message };
    }
}

module.exports = {
    loginWithCookie,
    checkCookie,
    getCookie,
    setCookie,
    fetchAllUserTracks,
    getPlatformInfo,
};

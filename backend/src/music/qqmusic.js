const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BASE_URL = 'https://u.y.qq.com';

async function getCookie() {
    return process.env.QQMUSIC_COOKIE || '';
}

async function setCookie(cookie) {
    process.env.QQMUSIC_COOKIE = cookie;
    const envPath = path.join(__dirname, '..', '..', '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) envContent = fs.readFileSync(envPath, 'utf8');
    const regex = /^QQMUSIC_COOKIE=.*$/m;
    if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `QQMUSIC_COOKIE=${cookie}`);
    } else {
        envContent += `\nQQMUSIC_COOKIE=${cookie}`;
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
        const hasKey = cookieObj.qm_keyst || cookieObj.qqmusic_key || cookieObj.p_skey;
        const uin = cookieObj.uin || cookieObj.p_uin || '';
        if (!hasKey) {
            return { success: false, error: 'Cookie 格式不正确，请确保包含 qm_keyst 或 qqmusic_key' };
        }
        const plRes = await axios.get('https://c.y.qq.com/rsc/fbin/fcg_get_profile_homepage.fcg', {
            params: { uid: uin.replace(/^o0*/, '') || 0, limit: 5 },
            headers: { 'Cookie': cookie },
            timeout: 10000,
        });
        const playlists = plRes.data?.playlist || plRes.data?.data?.playlist || [];
        return { success: true, cookie, nickname: 'QQ用户', uid: parseInt(uin.replace(/^o0*/, '')) || 0 };
    } catch (e) {
        console.error('QQ音乐 Cookie 验证失败:', e.response?.data || e.message);
        return { success: false, error: 'Cookie 无效或已过期，请重新从 y.qq.com 获取' };
    }
}

async function checkCookie() {
    const cookie = await getCookie();
    if (!cookie) return false;
    try {
        const res = await axios.get('https://c.y.qq.com/rsc/fbin/fcg_get_profile_homepage.fcg', {
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
        const plRes = await axios.get('https://c.y.qq.com/rsc/fbin/fcg_get_profile_homepage.fcg', {
            params: { uid, limit: 100 },
            headers: { 'Cookie': cookie },
            timeout: 10000,
        });
        const playlists = plRes.data?.playlist || plRes.data?.data?.playlist || [];
        for (const pl of playlists) {
            if (allTracks.length >= 500) break;
            try {
                const detailRes = await axios.get('https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg', {
                    params: { id: pl.id || pl.dissid },
                    headers: { 'Cookie': cookie },
                    timeout: 10000,
                });
                const cdlist = detailRes.data?.cdlist || detailRes.data?.data?.cdlist || [];
                for (const cd of cdlist) {
                    const songs = cd.songlist || [];
                    for (const s of songs) {
                        if (allTracks.length >= 500) break;
                        allTracks.push({
                            name: s.name || s.songname || '',
                            artist: s.singer?.map(a => a.name).join(', ') || s.artist || '',
                        });
                    }
                }
            } catch (e) { continue; }
        }
    } catch (e) {}

    // 最近播放
    try {
        const recentRes = await axios.get('https://c.y.qq.com/v8/fcg-bin/fcg_v8_playlist_history.fcg', {
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
    if (!cookie) return { platform: 'qqmusic', loggedIn: false };
    try {
        const res = await axios.get('https://c.y.qq.com/rsc/fbin/fcg_get_profile_homepage.fcg', {
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
        return { platform: 'qqmusic', loggedIn, nickname: 'QQ用户', trackCount };
    } catch (e) {
        return { platform: 'qqmusic', loggedIn: false, error: e.message };
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

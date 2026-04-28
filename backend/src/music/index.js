/**
 * MusicService — 音乐服务统一入口
 * 支持：网易云、酷我、QQ音乐、酷狗
 */
const netease = require('./netease');
const kuwo = require('./kuwo');
const qqmusic = require('./qqmusic');
const kugou = require('./kugou');

const PLATFORM_MAP = {
    netease,
    kuwo,
    qqmusic,
    kugou,
};

function getService(platform) {
    return PLATFORM_MAP[platform] || netease;
}

function getDefaultPlatform() {
    return (process.env.MUSIC_SOURCE || 'netease').toLowerCase();
}

class MusicService {
    constructor() {
        this.defaultPlatform = getDefaultPlatform();
    }

    // ---------- 登录 ----------

    async login(username, password, cookie, platform) {
        const p = platform || this.defaultPlatform;
        const svc = getService(p);

        let result;
        if (cookie) {
            result = await svc.loginWithCookie(cookie);
        } else if (p === 'netease') {
            result = await svc.login(username, password);
        } else {
            // 酷我/QQ/酷狗只支持 Cookie 登录
            return { success: false, error: '该平台请使用 Cookie 登录' };
        }

        if (result.success && result.cookie) {
            await svc.setCookie(result.cookie);
        }
        return result;
    }

    // ---------- Cookie ----------

    async checkCookie(platform) {
        const svc = getService(platform || this.defaultPlatform);
        return svc.checkCookie();
    }

    // ---------- 用户数据 ----------

    async fetchUserData(uid, platform) {
        const svc = getService(platform || this.defaultPlatform);
        return svc.fetchAllUserTracks(uid);
    }

    async refreshUserData(platform) {
        const svc = getService(platform || this.defaultPlatform);
        return svc.getPlatformInfo().then(async info => {
            if (!info.loggedIn) return { success: false, error: '未登录' };
            const tracks = await svc.fetchAllUserTracks(info.uid || 0);
            const fs = require('fs');
            const path = require('path');
            const prefsPath = path.join(__dirname, '..', 'user-music-prefs.json');
            fs.writeFileSync(prefsPath, JSON.stringify(tracks, null, 2));
            return { success: true, trackCount: tracks.length, nickname: info.nickname, tracks };
        });
    }

    // ---------- 搜索 & 播放（仅网易云） ----------

    async searchSong(songName, excludeIds) {
        return netease.searchSong(songName, excludeIds);
    }

    async getSongUrl(songId) {
        return netease.getSongUrl(songId);
    }

    async pickRandomFromLibrary() {
        return netease.pickRandomFromLibrary();
    }

    // ---------- 平台信息 ----------

    async getPlatformInfo(platform) {
        if (platform) {
            const svc = getService(platform);
            return { platforms: { [platform]: await svc.getPlatformInfo() } };
        }
        // 返回所有平台状态
        const platforms = {};
        for (const [name, svc] of Object.entries(PLATFORM_MAP)) {
            platforms[name] = await svc.getPlatformInfo();
        }
        return { platforms };
    }
}

module.exports = new MusicService();

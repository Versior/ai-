/**
 * MusicService — 音乐服务统一入口
 * 当前只支持网易云音乐，其他平台代码已移除
 */
const netease = require('./netease');

class MusicService {
    constructor() {
        this.platform = 'netease';
    }

    // ---------- 登录 ----------

    async login(username, password, cookie) {
        if (cookie) {
            const result = await netease.loginWithCookie(cookie);
            if (result.success && result.cookie) {
                await netease.setCookie(result.cookie);
            }
            return result;
        }
        const result = await netease.login(username, password);
        if (result.success && result.cookie) {
            await netease.setCookie(result.cookie);
        }
        return result;
    }

    // ---------- Cookie ----------

    async checkCookie() {
        return netease.checkCookie();
    }

    // ---------- 用户数据 ----------

    async fetchUserData(uid) {
        return netease.fetchAllUserTracks(uid);
    }

    async refreshUserData() {
        return netease.refreshUserData();
    }

    // ---------- 搜索 & 播放 ----------

    async searchSong(songName) {
        return netease.searchSong(songName);
    }

    async getSongUrl(songId) {
        return netease.getSongUrl(songId);
    }

    async pickRandomFromLibrary() {
        return netease.pickRandomFromLibrary();
    }

    // ---------- 平台信息 ----------

    async getPlatformInfo() {
        const info = await netease.getPlatformInfo();
        // 统一返回格式，兼容多平台时代的接口
        return { platforms: { netease: info } };
    }
}

module.exports = new MusicService();

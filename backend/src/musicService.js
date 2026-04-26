const axios = require('axios');

/**
 * 网易云音乐 API 服务类
 */
class MusicService {
    constructor() {
        this.baseUrl = 'http://iwenwiki.com:3000';
    }

    /**
     * 搜索歌曲并获取完整信息
     * @param {string} songName - 歌曲名字
     * @returns {Promise<Object>} 包含title, artist, url, cover的对象
     */
    async getSongInfo(songName) {
        try {
            console.log(`🔍 正在搜索歌曲: ${songName}`);

            // 第一步：搜索歌曲接口
            const searchResponse = await axios.get(`${this.baseUrl}/search`, {
                params: {
                    keywords: songName,
                    limit: 1
                },
                timeout: 5000
            });

            const songData = searchResponse.data.result.songs[0];
            if (!songData) {
                throw new Error(`未找到歌曲: ${songName}`);
            }

            const songId = songData.id;
            console.log(`✅ 找到歌曲ID: ${songId}`);

            // 第二步：获取歌曲播放链接
            const urlResponse = await axios.get(`${this.baseUrl}/song/url/v1`, {
                params: {
                    id: songId,
                    level: 'standard'
                },
                timeout: 5000
            });

            const songUrl = urlResponse.data.data[0].url;
            console.log(`🎵 获取到播放链接`);

            // 第三步：获取歌曲详情（封面图）
            const detailResponse = await axios.get(`${this.baseUrl}/song/detail`, {
                params: {
                    ids: songId
                },
                timeout: 5000
            });

            const coverUrl = detailResponse.data.songs[0].al.picUrl;
            console.log(`🖼️ 获取到封面图片`);

            // 构建返回对象
            return {
                title: songData.name || songName,
                artist: songData.ar.map(artist => artist.name).join(', '),
                url: songUrl,
                cover: coverUrl,
                album: songData.al?.name || '未知专辑',
                duration: songData.dt || 0,
                id: songId
            };

        } catch (error) {
            console.error(`❌ 搜索歌曲 "${songName}" 失败:`, error.message);
            throw new Error(`无法获取歌曲 "${songName}" 的信息`);
        }
    }

    /**
     * 批量获取多首歌曲信息
     * @param {Array<string>} songNames - 歌曲名字数组
     * @returns {Promise<Array<Object>>} 歌曲信息数组
     */
    async getMultipleSongs(songNames) {
        const results = [];
        
        for (const songName of songNames) {
            try {
                const songInfo = await this.getSongInfo(songName);
                results.push(songInfo);
                
                // 添加小延迟避免请求过于频繁
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.warn(`⚠️ 搜索歌曲 "${songName}" 失败:`, error.message);
                // 继续处理其他歌曲
                continue;
            }
        }
        
        return results;
    }

    /**
     * 验证歌曲URL是否有效
     * @param {string} url - 歌曲URL
     * @returns {Promise<boolean>}
     */
    async validateSongUrl(url) {
        try {
            const response = await axios.head(url, {
                timeout: 3000
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取热门歌曲列表
     * @param {number} limit - 返回数量限制
     * @returns {Promise<Array<Object>>}
     */
    async getHotSongs(limit = 10) {
        try {
            const response = await axios.get(`${this.baseUrl}/personalized`, {
                params: {
                    limit: limit
                },
                timeout: 5000
            });

            const songs = response.data.result || [];
            const results = [];

            for (const song of songs.slice(0, limit)) {
                try {
                    const musicInfo = await this.getSongInfo(song.name);
                    results.push({
                        ...musicInfo,
                        popularity: song.playCount || 0
                    });
                    
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    console.warn(`⚠️ 获取热门歌曲 "${song.name}" 失败:`, error.message);
                    continue;
                }
            }

            return results;
        } catch (error) {
            console.error('❌ 获取热门歌曲失败:', error.message);
            return [];
        }
    }
}

module.exports = MusicService;
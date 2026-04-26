const MusicService = require('./src/musicService');

/**
 * 测试音乐服务功能
 */
async function testMusicService() {
    console.log('🎵 开始测试Versior AI电台音乐服务...');

    const musicService = new MusicService();

    try {
        // 测试搜索歌曲功能
        console.log('\n🔍 测试搜索歌曲功能:');
        const songInfo = await musicService.getSongInfo('稻香');
        console.log('✅ 搜索结果:', JSON.stringify(songInfo, null, 2));

        // 测试批量搜索
        console.log('\n🎶 测试批量搜索功能:');
        const songs = ['稻香', '晴天', '夜曲'];
        const multipleSongs = await musicService.getMultipleSongs(songs);
        console.log(`✅ 批量搜索完成，找到 ${multipleSongs.length} 首歌曲`);

        // 测试热门歌曲
        console.log('\n🔥 测试热门歌曲功能:');
        const hotSongs = await musicService.getHotSongs(3);
        console.log(`✅ 获取到 ${hotSongs.length} 首热门歌曲`);

        // 验证URL有效性
        if (songInfo.url) {
            console.log('\n🔗 测试URL验证功能:');
            const isValid = await musicService.validateSongUrl(songInfo.url);
            console.log(`✅ URL有效性检查: ${isValid ? '有效' : '无效'}`);
        }

        console.log('\n🎉 所有测试完成！');

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error(error.stack);
    }
}

// 运行测试
testMusicService();
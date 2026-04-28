const netease = require('../music/netease');

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch (e) { reject(e); }
        });
        req.on('error', reject);
    });
}

async function handleLogin(req, res, ctx) {
    const body = await readBody(req);
    const { platform, username, password, cookie } = body;

    if (!platform) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少参数' }));
        return;
    }

    // 当前只支持网易云
    if (platform !== 'netease') {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '当前只支持网易云音乐' }));
        return;
    }

    let result;
    if (cookie) {
        result = await ctx.musicService.login(username, password, cookie);
    } else {
        if (!username || !password) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: '缺少账号或密码' }));
            return;
        }
        result = await ctx.musicService.login(username, password);
    }

    if (result.success) {
        result.loggedIn = true;
        console.log(`✅ ${platform} 登录成功: ${result.nickname}`);

        // 获取用户歌曲数据
        try {
            const uniqueTracks = await ctx.musicService.fetchUserData(result.uid);
            const fs = require('fs');
            const path = require('path');
            const prefsPath = path.join(__dirname, '..', 'user-music-prefs.json');
            fs.writeFileSync(prefsPath, JSON.stringify(uniqueTracks, null, 2));
            console.log(`  ✅ 已保存 ${uniqueTracks.length} 首歌曲`);
            result.trackCount = uniqueTracks.length;
        } catch (fetchErr) {
            console.warn('⚠️ 获取用户数据失败:', fetchErr.message);
        }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
}

async function handleStatus(req, res, ctx) {
    try {
        const info = await ctx.musicService.getPlatformInfo();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(info));
    } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
    }
}

async function handleRefreshData(req, res, ctx) {
    const body = await readBody(req);
    const { platform } = body;

    if (platform && platform !== 'netease') {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '当前只支持网易云音乐' }));
        return;
    }

    try {
        const result = await ctx.musicService.refreshUserData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: e.message }));
    }
}

module.exports = { handleLogin, handleStatus, handleRefreshData };

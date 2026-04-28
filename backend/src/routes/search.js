const url = require('url');

function parseQuery(reqUrl) {
    const parsed = url.parse(reqUrl, true);
    return parsed.query;
}

async function handleSearch(req, res, ctx) {
    const query = parseQuery(req.url);
    const title = query.title || '';
    const artist = query.artist || '';

    if (!title) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少 title' }));
        return;
    }

    const searchQuery = artist ? `${title} ${artist}` : title;

    try {
        const track = await ctx.musicService.searchSong(searchQuery);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, track }));
    } catch (e) {
        console.error('❌ /api/search 错误:', e.message);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: e.message }));
    }
}

async function handleRefreshUrl(req, res, ctx) {
    const query = parseQuery(req.url);
    const songId = query.id;

    if (!songId) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少 id 参数' }));
        return;
    }

    try {
        const trackUrl = await ctx.musicService.getSongUrl(songId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, url: trackUrl }));
    } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: e.message }));
    }
}

async function handleAiSummary(req, res, ctx) {
    const query = parseQuery(req.url);
    const title = query.title || '';
    const artist = query.artist || '';

    if (!title) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少 title' }));
        return;
    }

    try {
        const weather = await ctx.weatherService.getWeather('127.0.0.1');
        const weatherDesc = ctx.weatherService.getWeatherDesc(weather);
        const llmResponse = await ctx.llmService.generateResponse(`播放 ${title}`, weatherDesc);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, say: llmResponse.say, track: llmResponse.track }));
    } catch (e) {
        console.error('❌ /api/ai-summary 错误:', e.message);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: e.message }));
    }
}

module.exports = { handleSearch, handleRefreshUrl, handleAiSummary };

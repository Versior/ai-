const axios = require('axios');

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {Object} ctx
 * @param {Set} ctx.clients — WebSocket clients
 */
async function handle(req, res, ctx) {
    const status = { status: 'ok', clients: ctx.clients.size, llm: null, music: null };

    try {
        const llmRes = await axios.post(
            process.env.LONGCAT_API_URL || '',
            { model: process.env.LONGCAT_MODEL || '', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 },
            { headers: { 'Authorization': `Bearer ${process.env.LONGCAT_API_KEY || ''}`, 'Content-Type': 'application/json' }, timeout: 20000 }
        );
        status.llm = (llmRes.status >= 200 && llmRes.status < 500);
    } catch (e) { status.llm = false; }

    try {
        const musicRes = await axios.get('https://music.163.com/api/nuser/account/get', { timeout: 8000 });
        status.music = (musicRes.status >= 200 && musicRes.status < 500);
    } catch (e) { status.music = false; }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
}

module.exports = { handle };

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '..', '.env');

function readEnv() {
    if (!fs.existsSync(ENV_PATH)) return '';
    return fs.readFileSync(ENV_PATH, 'utf8');
}

function writeEnv(content) {
    fs.writeFileSync(ENV_PATH, content.trim() + '\n');
}

function updateEnvVars(vars) {
    let envContent = readEnv();
    for (const [key, value] of Object.entries(vars)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
            envContent += `\n${key}=${value}`;
        }
    }
    writeEnv(envContent);
    // 同步 process.env
    for (const [key, value] of Object.entries(vars)) {
        process.env[key] = value;
    }
}

async function handleGet(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        success: true,
        config: {
            LONGCAT_API_URL: process.env.LONGCAT_API_URL || '',
            LONGCAT_API_KEY: process.env.LONGCAT_API_KEY || '',
            LONGCAT_MODEL: process.env.LONGCAT_MODEL || '',
            LONGCAT_API_URL_2: process.env.LONGCAT_API_URL_2 || '',
            LONGCAT_API_KEY_2: process.env.LONGCAT_API_KEY_2 || '',
            LONGCAT_MODEL_2: process.env.LONGCAT_MODEL_2 || '',
            LONGCAT_API_URL_3: process.env.LONGCAT_API_URL_3 || '',
            LONGCAT_API_KEY_3: process.env.LONGCAT_API_KEY_3 || '',
            LONGCAT_MODEL_3: process.env.LONGCAT_MODEL_3 || '',
            MUSIC_SOURCE: process.env.MUSIC_SOURCE || 'netease',
        },
    }));
}

async function handlePost(req, res, ctx) {
    const body = await readBody(req);
    const { password, config } = body;

    if (!password || password !== (process.env.ADMIN_PASSWORD || 'versior123')) {
        res.writeHead(401);
        res.end(JSON.stringify({ success: false, error: '密码错误' }));
        return;
    }

    if (config) {
        updateEnvVars(config);
        if (ctx.llmService) ctx.llmService.reloadConfig();
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
}

async function handleChangePassword(req, res) {
    const body = await readBody(req);
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少参数' }));
        return;
    }

    if (oldPassword !== (process.env.ADMIN_PASSWORD || 'versior123')) {
        res.writeHead(401);
        res.end(JSON.stringify({ success: false, error: '旧密码错误' }));
        return;
    }

    if (newPassword.length < 4) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '新密码至少4位' }));
        return;
    }

    updateEnvVars({ ADMIN_PASSWORD: newPassword });
    process.env.ADMIN_PASSWORD = newPassword;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
}

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

module.exports = { handleGet, handlePost, handleChangePassword };

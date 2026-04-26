const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class LoginService {
    constructor() {
        this.baseUrl = 'http://iwenwiki.com:3000';
        this.envPath = path.join(__dirname, '..', '.env');
    }

    async generateQRCode() {
        try {
            console.log('正在生成登录二维码...');

            // 1. 获取 unikey
            const keyResponse = await axios.get(`${this.baseUrl}/login/qr/key`);
            const unikey = keyResponse.data.data.unikey;
            console.log('获取 unikey 成功:', unikey);

            // 2. 创建二维码
            const qrResponse = await axios.get(`${this.baseUrl}/login/qr/create`, {
                params: {
                    key: unikey,
                    qrimg: true
                }
            });

            const qrImgData = qrResponse.data.data.qrimg;
            const qrUrl = qrResponse.data.data.qrurl;
            
            console.log('\n=== 网易云音乐扫码登录 ===');
            console.log('请在手机上打开网易云音乐 APP，扫描下方二维码：');
            console.log('二维码链接:', qrUrl);
            console.log('\n或者复制此链接到手机浏览器打开：');
            console.log(qrUrl);
            console.log('\n等待扫码中...');

            // 3. 开始轮询检查扫码状态
            this.pollQRStatus(unikey);

        } catch (error) {
            console.error('生成二维码失败:', error.response?.data || error.message);
        }
    }

    async pollQRStatus(unikey) {
        const maxAttempts = 60; // 最多等待 5 分钟
        let attempts = 0;

        const pollInterval = setInterval(async () => {
            try {
                attempts++;
                
                const checkResponse = await axios.get(`${this.baseUrl}/login/qr/check`, {
                    params: {
                        key: unikey
                    }
                });

                const code = checkResponse.data.code;
                const message = checkResponse.data.message;

                console.log(`扫码状态: ${message} (尝试 ${attempts}/${maxAttempts})`);

                if (code === 803) {
                    // 扫码成功，获取 cookie
                    const cookie = checkResponse.data.cookie;
                    await this.updateEnvCookie(cookie);
                    
                    console.log('\n🎉 登录成功！Cookie 已自动保存到 .env 文件');
                    clearInterval(pollInterval);
                    return;
                } else if (code === 800) {
                    // 二维码过期
                    console.log('\n❌ 二维码已过期，请重新运行脚本');
                    clearInterval(pollInterval);
                    return;
                } else if (attempts >= maxAttempts) {
                    console.log('\n⏰ 等待超时，请重新运行脚本');
                    clearInterval(pollInterval);
                    return;
                }

            } catch (error) {
                console.error('检查扫码状态失败:', error.message);
                
                if (attempts >= maxAttempts) {
                    clearInterval(pollInterval);
                }
            }
        }, 5000); // 每 5 秒检查一次
    }

    async updateEnvCookie(cookie) {
        try {
            let envContent = '';
            
            // 读取现有的 .env 文件
            if (fs.existsSync(this.envPath)) {
                envContent = fs.readFileSync(this.envPath, 'utf8');
            }

            // 更新或添加 NCM_COOKIE
            const lines = envContent.split('\n').filter(line => {
                return !line.startsWith('NCM_COOKIE=');
            });
            
            lines.push(`NCM_COOKIE=${cookie}`);
            
            // 写回文件
            fs.writeFileSync(this.envPath, lines.join('\n') + '\n');
            
            console.log('✅ Cookie 已更新到 .env 文件');
        } catch (error) {
            console.error('更新 .env 文件失败:', error.message);
        }
    }
}

// 如果直接运行此脚本，启动扫码登录
if (require.main === module) {
    const loginService = new LoginService();
    loginService.generateQRCode();
}

module.exports = new LoginService();
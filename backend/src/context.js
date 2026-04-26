const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

/**
 * 读取用户配置文件并获取当前上下文
 */
async function getUserContext() {
    try {
        // 读取音乐品味文件
        const tastePath = path.join(__dirname, '../../user/taste.md');
        const routinesPath = path.join(__dirname, '../../user/routines.md');
        
        const [tasteContent, routinesContent] = await Promise.all([
            fs.readFile(tastePath, 'utf8'),
            fs.readFile(routinesPath, 'utf8')
        ]);

        // 解析音乐品味
        const taste = parseMarkdownToObject(tasteContent);
        const routines = parseMarkdownToObject(routinesContent);

        // 获取当前服务器时间
        const currentTime = new Date();
        const timeInfo = {
            hour: currentTime.getHours(),
            minute: currentTime.getMinutes(),
            dayOfWeek: currentTime.getDay(),
            isWeekend: [0, 6].includes(currentTime.getDay()),
            timestamp: currentTime.toISOString()
        };

        // 获取天气信息（模拟）
        const weatherInfo = await getWeatherInfo();

        return {
            user: {
                taste: taste,
                routines: routines
            },
            context: {
                time: timeInfo,
                weather: weatherInfo,
                sessionId: generateSessionId()
            }
        };
    } catch (error) {
        console.error('读取用户上下文失败:', error);
        throw error;
    }
}

/**
 * 将Markdown内容转换为对象
 */
function parseMarkdownToObject(content) {
    const result = {};
    const lines = content.split('\n').filter(line => line.trim());
    
    let currentSection = null;
    
    for (let line of lines) {
        // 处理标题
        if (line.startsWith('#')) {
            currentSection = line.replace('#', '').trim().toLowerCase().replace(/\s+/g, '');
            result[currentSection] = {};
        } else if (line.startsWith('-') && currentSection) {
            // 处理列表项
            const match = line.match(/- (.+)/);
            if (match) {
                const value = match[1].trim();
                if (!Array.isArray(result[currentSection])) {
                    result[currentSection] = [];
                }
                result[currentSection].push(value);
            }
        } else if (line.includes(':') && currentSection) {
            // 处理键值对
            const match = line.match(/(\w+):\s*(.+)/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                result[currentSection][key] = value;
            }
        }
    }
    
    return result;
}

/**
 * 获取天气信息（模拟API调用）
 */
async function getWeatherInfo() {
    try {
        // 这里可以调用真实的天气API
        // 现在返回模拟数据
        return {
            temperature: Math.floor(Math.random() * 30) + 10, // 10-40度
            condition: ['晴朗', '多云', '小雨', '阴天'][Math.floor(Math.random() * 4)],
            humidity: Math.floor(Math.random() * 50) + 30, // 30-80%
            windSpeed: Math.floor(Math.random() * 20) + 5, // 5-25km/h
            location: '本地'
        };
    } catch (error) {
        console.error('获取天气信息失败:', error);
        return {
            temperature: 22,
            condition: '多云',
            humidity: 60,
            windSpeed: 10,
            location: '本地'
        };
    }
}

/**
 * 生成会话ID
 */
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

module.exports = {
    getUserContext
};
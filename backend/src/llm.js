const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

class LLMService {
    constructor() {
        this.apiKey = process.env.LONGCAT_API_KEY;
        this.apiUrl = process.env.LONGCAT_API_URL || 'https://api.longcat.chat/openai/v1/chat/completions';
        this.model = process.env.LONGCAT_MODEL || 'LongCat-Flash-Lite';
        this.userTracks = this.loadUserTracks();
        
        this.systemPrompt = `你是赛博朋克风格AI音乐助手，代号Versior。

规则：
1. 全程中文回复
2. 每次回复必须是严格JSON格式，不要包含任何JSON以外的文字
3. JSON格式：{"say":"短播报词（20-40字，以歌曲和歌手为中心，分享故事情感，不要描述天气）","track":{"title":"歌曲名","artist":"歌手"},"queue":[{"title":"预告歌曲1","artist":"歌手"},{"title":"预告歌曲2","artist":"歌手"}]}
4. 根据用户的音乐品味画像推荐歌曲，优先从用户收藏列表中选择，也可以推荐列表中不存在但风格相似的歌手和歌曲
5. 推荐时要考虑用户偏好的语种、风格、歌手类型，推荐相似风格的歌曲
6. 用户指定风格时必须严格遵守，所有推荐必须风格一致，这是最高优先级规则
7. 天气仅作辅助参考，不要覆盖用户指定的风格
8. queue字段必须包含3-5首预告歌曲，展示即将播放的曲目，所有预告歌曲也必须符合用户指定的风格
9. 播报词必须用中文，不要出现英文
10. 如果用户问的是天气、时间等非音乐问题，直接简短回答即可，不需要推荐歌曲
11. 推荐的歌曲必须是真实存在的，不能编造`;
    }

    loadUserTracks() {
        try {
            const filepath = path.join(__dirname, 'user-music-prefs.json');
            if (fs.existsSync(filepath)) {
                const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                console.log(`📂 已加载 ${data.length} 首用户偏好歌曲`);
                return data;
            }
        } catch (e) { console.error('加载用户偏好失败:', e.message); }
        return [];
    }

    reloadConfig() {
        this.apiKey = process.env.LONGCAT_API_KEY;
        this.apiUrl = process.env.LONGCAT_API_URL || 'https://api.longcat.chat/openai/v1/chat/completions';
        this.model = process.env.LONGCAT_MODEL || 'LongCat-Flash-Lite';
        console.log('🔄 LLM 配置已重载:', { apiUrl: this.apiUrl, model: this.model });
    }

    getUserTracksSummary(maxCount = 30) {
        if (this.userTracks.length === 0) return '';
        const shuffled = [...this.userTracks].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, maxCount).map(t => `${t.name} - ${t.artist}`).join('\n');
    }

    // 分析用户音乐品味画像
    getUserTasteProfile() {
        if (this.userTracks.length === 0) return '';
        // 统计歌手频率
        const artistCount = {};
        this.userTracks.forEach(t => {
            const a = t.artist || '未知';
            artistCount[a] = (artistCount[a] || 0) + 1;
        });
        const topArtists = Object.entries(artistCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([a, c]) => `${a}(${c}首)`)
            .join('、');
        // 统计语种
        let chinese = 0, english = 0, korean = 0, japanese = 0;
        this.userTracks.forEach(t => {
            const name = (t.name || '') + ' ' + (t.artist || '');
            if (/[\u4e00-\u9fff]/.test(name)) chinese++;
            else if (/[\uac00-\ud7af]/.test(name)) korean++;
            else if (/[\u3040-\u309f\u30a0-\u30ff]/.test(name)) japanese++;
            else english++;
        });
        const total = this.userTracks.length;
        const langDist = [];
        if (english > 0) langDist.push(`英文 ${Math.round(english/total*100)}%`);
        if (chinese > 0) langDist.push(`中文 ${Math.round(chinese/total*100)}%`);
        if (korean > 0) langDist.push(`韩文 ${Math.round(korean/total*100)}%`);
        if (japanese > 0) langDist.push(`日文 ${Math.round(japanese/total*100)}%`);
        // 提取风格关键词（从歌名/歌手推断）
        const allText = this.userTracks.map(t => `${t.name} ${t.artist}`).join(' ').toLowerCase();
        const styleHints = [];
        const styleMap = {
            'r&b': ['r&b', 'rnb', 'soul', 'funk'],
            'pop': ['pop', 'synth', 'electro'],
            'hip-hop': ['rap', 'hip-hop', 'hiphop', 'trap'],
            'indie': ['indie', 'alt', 'alternative'],
            'electronic': ['electronic', 'edm', 'house', 'techno'],
            'rock': ['rock', 'punk', 'metal'],
            'jazz': ['jazz', 'blues'],
            'ballad': ['ballad', 'slow', 'acoustic'],
            'chill': ['chill', 'lo-fi', 'lofi', 'ambient']
        };
        for (const [style, keywords] of Object.entries(styleMap)) {
            if (keywords.some(kw => allText.includes(kw))) styleHints.push(style);
        }
        let profile = `用户共收藏 ${this.userTracks.length} 首歌曲。\n`;
        profile += `偏好的歌手：${topArtists}。\n`;
        profile += `语种分布：${langDist.join('、')}。\n`;
        if (styleHints.length > 0) profile += `风格倾向：${styleHints.join('、')}。`;
        return profile;
    }

    getStyleMatchingTracks(style, maxCount = 10) {
        if (this.userTracks.length === 0) return '';
        const matched = this.userTracks.filter(t => {
            const name = (t.name || '').toLowerCase();
            const artist = (t.artist || '').toLowerCase();
            const s = style.toLowerCase();
            return name.includes(s) || artist.includes(s);
        });
        if (matched.length === 0) {
            const shuffled = [...this.userTracks].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, maxCount).map(t => `${t.name} - ${t.artist}`).join('\n');
        }
        const shuffled = matched.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, maxCount).map(t => `${t.name} - ${t.artist}`).join('\n');
    }

    extractJSON(content) {
        try {
            const jsonMatch = content.match(/\{[\s\S]*"say"[\s\S]*"track"[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return JSON.parse(content);
        } catch (e) {
            return null;
        }
    }

    validateResponse(data) {
        if (!data || typeof data !== 'object') return null;
        
        // 优先从偏好列表匹配，匹配不到则保留 LLM 推荐（可能是列表外的相似歌曲）
        let trackTitle = data.track?.title || '';
        let trackArtist = data.track?.artist || '';
        
        if (this.userTracks.length > 0 && trackTitle) {
            const matched = this.userTracks.find(t => 
                t.name === trackTitle || t.name.includes(trackTitle) || trackTitle.includes(t.name)
            );
            if (matched) {
                // 列表中有，用列表中的精确名称
                trackTitle = matched.name;
                trackArtist = matched.artist;
            } else {
                // 列表中没有，可能是 LLM 推荐的相似歌曲，保留但打印提示
                console.log(`💡 LLM 推荐列表外歌曲: "${trackTitle} - ${trackArtist}"`);
            }
        }
        
        // queue 同样处理
        let queue = Array.isArray(data.queue) ? data.queue : [];
        queue = queue.map(q => {
            const qMatched = this.userTracks.find(t => 
                t.name === q.title || t.name.includes(q.title) || q.title.includes(t.name)
            );
            if (qMatched) {
                return { title: qMatched.name, artist: qMatched.artist };
            }
            return q;
        });
        
        // 确保 queue 有 2 首，不足时从偏好列表补充
        while (queue.length < 3 && this.userTracks.length > 0) {
            const randomTrack = this.userTracks[Math.floor(Math.random() * this.userTracks.length)];
            queue.push({ title: randomTrack.name, artist: randomTrack.artist });
        }
        
        return {
            say: (data.say || "欢迎来到 Versior，听见未来电波...").substring(0, 100),
            track: { title: trackTitle, artist: trackArtist },
            queue: queue.slice(0, 5)
        };
    }

    async generateResponse(userInput = "", weatherDesc = '') {
        try {
            const tracksSummary = this.getUserTracksSummary(30);
            
            let userMessage;
            if (userInput) {
                const styleKeywords = ['安静', '慵懒', '治愈', '放松', '欢快', '活泼', '英文', '中文', '摇滚', '电子', '民谣', '流行', '古典', '爵士', '说唱', '嘻哈', '轻柔', '舒缓', '激情', '动感'];
                const detectedStyle = styleKeywords.filter(kw => userInput.includes(kw));
                const styleStr = detectedStyle.length > 0 ? detectedStyle.join('、') : '';
                
                const styleTracks = styleStr ? this.getStyleMatchingTracks(styleStr, 15) : tracksSummary;
                
                const tasteProfile = this.getUserTasteProfile();
                userMessage = `用户说："${userInput}"`;
                if (weatherDesc) userMessage += `\n\n${weatherDesc}`;
                if (tasteProfile) userMessage += `\n\n【用户音乐品味】\n${tasteProfile}`;
                if (styleTracks) userMessage += `\n\n【用户收藏的音乐（${styleStr ? '风格匹配' : '随机'}）】\n${styleTracks}`;
                userMessage += `\n\n请作为 Versior 用中文响应。根据用户品味推荐，优先从收藏列表选择，也可推荐风格相似的相似歌曲。`;
                
                if (styleStr) {
                    userMessage += `\n\n⚠️ 重要：用户指定了「${styleStr}」风格，所有推荐必须严格遵守返个风格，不要偏离。天气仅作辅助参考，不要覆盖用户风格。`;
                } else {
                    userMessage += `\n\n如果用户没指定风格，可以根据天气推荐。`;
                }
            } else {
                const tasteProfile = this.getUserTasteProfile();
                userMessage = `请为我们播放一首精选音乐，并用中文提供播报。播报要以歌曲和歌手为中心，分享歌曲背后的故事、情感或创作结局，不要描述天气。`;
                if (weatherDesc) userMessage += `\n\n${weatherDesc}`;
                if (tasteProfile) userMessage += `\n\n【用户音乐品味】\n${tasteProfile}`;
                if (tracksSummary) {
                    userMessage += `\n\n【用户收藏的音乐（部分）】\n${tracksSummary}`;
                    userMessage += `\n\n推荐时优先从收藏列表中选择，也可以推荐风格相似的相似歌曲。`;
                }
            }
            
            const response = await axios.post(
                this.apiUrl,
                {
                    model: this.model,
                    messages: [
                        { role: "system", content: this.systemPrompt },
                        { role: "user", content: userMessage }
                    ],
                    temperature: 0.3,
                    max_tokens: 300
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            const content = response.data.choices[0].message.content.trim();
            console.log('🧠 LLM 原始返回:', content.substring(0, 200));

            const parsed = this.extractJSON(content);
            
            if (parsed) {
                const validated = this.validateResponse(parsed);
                if (validated) {
                    console.log('✅ JSON 解析成功:', validated.track.title, '-', validated.track.artist);
                    return validated;
                }
            }

            console.warn('⚠️ LLM 返回非 JSON 格式，使用默认响应');
            const fallbackTrack = this.userTracks.length > 0
                ? this.userTracks[Math.floor(Math.random() * this.userTracks.length)]
                : null;
            return {
                say: content.substring(0, 200) || "欢迎来到 Versior，听见未来电波...",
                track: fallbackTrack 
                    ? { title: fallbackTrack.name, artist: fallbackTrack.artist }
                    : { title: "赛博之梦", artist: "Versior" },
                queue: []
            };

        } catch (error) {
            console.error('❌ LLM API 调用失败:', error.response?.data || error.message);
            const fallbackTrack = this.userTracks.length > 0
                ? this.userTracks[Math.floor(Math.random() * this.userTracks.length)]
                : null;
            return {
                say: "欢迎来到 Versior，听见未来电波！我是你的赛博朋克音乐助手，正在为你准备精彩的深夜节目...",
                track: fallbackTrack
                    ? { title: fallbackTrack.name, artist: fallbackTrack.artist }
                    : { title: "赛博之梦", artist: "Versior" },
                queue: []
            };
        }
    }

    async generateXiaoaiResponse(userInput = "", weatherDesc = "") {
        const xiaoaiPrompt = `你是 Versior，赛博朋克风格的 AI 音乐助手。
规则：
1. 必须全程中文，回复简短口语化，控制在50字以内
2. 返回严格 JSON 格式：{"say": "回复", "track": null}
3. 问天气/时间等问题直接简短回答
4. 想听歌时推荐一首，一句话介绍
5. 不要长章大论，不要自成介绍，直接回答`;

        const userMessage = weatherDesc
          ? weatherDesc + '\n\n用户说："' + userInput + '"\n请简短回答（50字以内）。'
          : '用户说："' + userInput + '"\n请简短回答（50字以内）。';

        try {
            const response = await axios.post(
                this.apiUrl,
                {
                    model: this.model,
                    messages: [
                        { role: "system", content: xiaoaiPrompt },
                        { role: "user", content: userMessage }
                    ],
                    temperature: 0.7,
                    max_tokens: 150
                },
                {
                    headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
                    timeout: 15000
                }
            );
            const respContent = response.data.choices[0].message.content.trim();
            const parsed = this.extractJSON(respContent);
            if (parsed) {
                return { say: parsed.say || respContent, track: null };
            }
            return { say: respContent.substring(0, 100), track: null };
        } catch (e) {
            return { say: "信号不太好，稍后再试。", track: null };
        }
    }
}

module.exports = new LLMService();

const axios = require('axios');

/**
 * 模拟大模型的大脑 - Versior AI Radio核心
 */
class ClaudeBrain {
    constructor() {
        this.ollamaUrl = 'http://localhost:11434';
        this.model = 'llama2'; // 默认模型，可以根据需要调整
    }

    /**
     * 调用LLM生成电台内容
     * @param {Object} context - 用户上下文信息
     * @returns {Promise<Object>} JSON格式的内容：say, play, reason, segue
     */
    async generateContent(context) {
        try {
            // 构建提示词
            const prompt = this.buildPrompt(context);
            
            // 检查Ollama服务是否可用
            const isOllamaAvailable = await this.checkOllamaAvailability();
            
            let response;
            
            if (isOllamaAvailable) {
                // 直接调用本地Ollama模型
                response = await this.callOllama(prompt);
            } else {
                // 使用模拟数据（降级处理）
                response = this.generateMockResponse(context);
            }
            
            return this.formatResponse(response, context);
            
        } catch (error) {
            console.error('生成内容失败:', error);
            return this.generateFallbackResponse(context);
        }
    }

    /**
     * 构建AI提示词
     */
    buildPrompt(context) {
        const { user, context: ctx } = context;
        const hour = ctx.time.hour;
        const weather = ctx.weather.condition;
        const isWeekend = ctx.time.isWeekend;

        return `你是一个名为Versior的个人AI电台DJ。请根据以下用户信息和当前状态，为听众推荐音乐并播报：

用户音乐品味：
${JSON.stringify(user.taste, null, 2)}

日常作息偏好：
${JSON.stringify(user.routines, null, 2)}

当前时间：${hour}:00 (${ctx.time.isWeekend ? '周末' : '工作日'})
天气状况：${weather}
今天是${ctx.time.isWeekend ? '周末' : '工作日'}

请严格按照以下JSON格式返回：
{
  "say": "DJ的播报词",
  "play": ["歌曲ID1", "歌曲ID2"],
  "reason": "选歌理由",
  "segue": "串场词"
}

要求：
1. say: 温馨的电台开场白或过渡语
2. play: 2-3个适合当前时间和心情的歌曲ID（可以模拟）
3. reason: 解释为什么选择这些歌曲
4. segue: 自然的串场过渡词`;
    }

    /**
     * 检查Ollama服务可用性
     */
    async checkOllamaAvailability() {
        try {
            const response = await axios.get(`${this.ollamaUrl}/api/tags`, {
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            console.log('Ollama服务不可用，使用模拟模式');
            return false;
        }
    }

    /**
     * 调用Ollama API
     */
    async callOllama(prompt) {
        try {
            const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
                model: this.model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9
                }
            }, {
                timeout: 30000
            });

            return response.data.response;
        } catch (error) {
            console.error('Ollama调用失败:', error.message);
            throw error;
        }
    }

    /**
     * 生成模拟响应（降级处理）
     */
    generateMockResponse(context) {
        const hour = context.context.time.hour;
        const taste = context.user.taste;
        
        // 基于时间生成不同的响应
        let timeBasedResponse = '';
        
        if (hour >= 6 && hour < 12) {
            timeBasedResponse = '早晨时光，让我们用温暖的爵士乐开启美好的一天';
        } else if (hour >= 12 && hour < 18) {
            timeBasedResponse = '午后时光，适合一些轻松的电子音乐来陪伴您的下午';
        } else if (hour >= 18 && hour < 22) {
            timeBasedResponse = '傍晚时分，温暖的Bossa Nova和爵士三重奏是完美的选择';
        } else {
            timeBasedResponse = '夜深了，让迷幻的电子音乐伴您进入宁静的夜晚';
        }

        return `{
  "say": "${timeBasedResponse}，这里是Versior的私人电台，为您精心挑选最适合此刻心情的音乐。",
  "play": ["默认歌曲"],
  "reason": "根据您当前的${hour}:00时间和${context.context.weather.condition}天气，选择了符合您音乐品味的爵士、氛围电子和Bossa Nova风格",
  "segue": "接下来，让我们一起聆听这些精心挑选的曲目..."
}`;
    }

    /**
     * 格式化响应
     */
    formatResponse(rawResponse, context) {
        try {
            // 尝试解析JSON
            let parsedResponse;
            try {
                parsedResponse = JSON.parse(rawResponse);
            } catch (e) {
                // 如果解析失败，使用模拟响应
                parsedResponse = this.generateMockResponse(context);
                if (typeof parsedResponse === 'string') {
                    parsedResponse = JSON.parse(parsedResponse);
                }
            }

            // 确保响应包含必要字段
            return {
                say: parsedResponse.say || '欢迎来到Versior私人电台',
                play: Array.isArray(parsedResponse.play) ? parsedResponse.play : ['默认歌曲'],
                reason: parsedResponse.reason || '基于您的音乐品味和当前环境',
                segue: parsedResponse.segue || '让我们开始今天的音乐之旅'
            };
        } catch (error) {
            console.error('格式化响应失败:', error);
            return this.generateFallbackResponse(context);
        }
    }

    /**
     * 生成备用响应
     */
    generateFallbackResponse(context) {
        return {
            say: '欢迎来到Versior私人电台，今天为您准备了特别的音乐节目',
            play: ['fallback_jazz', 'fallback_ambient'],
            reason: '系统正在优化推荐算法，请稍后再试',
            segue: '感谢您的收听，祝您有美好的一天'
        };
    }
}

module.exports = ClaudeBrain;
const llmService = require('./src/llm');

async function testLLM() {
    try {
        console.log('测试 LLM 服务...');
        const result = await llmService.generateResponse("测试消息");
        console.log('LLM 响应:', result);
    } catch (error) {
        console.error('LLM 测试失败:', error.message);
    }
}

testLLM();
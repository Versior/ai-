const { getUserContext } = require('./src/context');
const ClaudeBrain = require('./src/claude');

/**
 * 测试AI大脑功能
 */
async function testBrain() {
    console.log('🧠 开始测试Versior AI Radio大脑...');
    
    try {
        // 1. 获取用户上下文
        console.log('📖 正在读取用户配置...');
        const context = await getUserContext();
        console.log('✅ 用户上下文加载成功');
        
        // 2. 初始化AI大脑
        console.log('🤖 正在初始化ClaudeBrain...');
        const brain = new ClaudeBrain();
        console.log('✅ ClaudeBrain初始化成功');
        
        // 3. 生成内容
        console.log('🎵 正在生成电台内容...');
        const content = await brain.generateContent(context);
        
        // 4. 打印结果
        console.log('\n🎉 测试结果：');
        console.log(JSON.stringify(content, null, 2));
        
        // 5. 验证格式
        console.log('\n🔍 格式验证：');
        const requiredFields = ['say', 'play', 'reason', 'segue'];
        const isValid = requiredFields.every(field => 
            content.hasOwnProperty(field) && 
            typeof content[field] === 'string' || 
            (field === 'play' && Array.isArray(content[field]))
        );
        
        if (isValid) {
            console.log('✅ 响应格式正确，包含所有必需字段');
        } else {
            console.log('❌ 响应格式有误');
        }
        
        console.log('\n✨ 测试完成！');
        return content;
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// 运行测试
if (require.main === module) {
    testBrain().catch(console.error);
}
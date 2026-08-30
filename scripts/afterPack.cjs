const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
    const { appOutDir } = context;
    const localesDir = path.join(appOutDir, 'locales');

    if (fs.existsSync(localesDir)) {
        console.log('🧹 开始清理多余语言包...');
        const files = fs.readdirSync(localesDir);
        // 只保留中文简体，其他全删（Electron 找不到时会回退到 en-US）
        const keepFiles = ['zh-CN.pak'];

        let deletedCount = 0;
        for (const file of files) {
            if (file.endsWith('.pak') && !keepFiles.includes(file)) {
                fs.unlinkSync(path.join(localesDir, file));
                deletedCount++;
                console.log(`  删除: ${file}`);
            }
        }
        console.log(`✅ 清理完成，共删除 ${deletedCount} 个语言包`);
    } else {
        console.log('⚠️ locales 目录不存在，跳过清理');
    }
};
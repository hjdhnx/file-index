import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const distDir = 'dist';

// 确保dist目录存在
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

console.log('🚀 开始构建多平台二进制文件...\n');

const builds = [
    {
        name: 'Windows x64',
        target: 'node18-win-x64',
        output: 'dist/file-index-win-x64.exe',
        compress: 'GZip'
    },
    {
        name: 'Linux x64',
        target: 'node18-linux-x64',
        output: 'dist/file-index-linux-x64',
        compress: 'GZip'
    },
    {
        name: 'macOS x64',
        target: 'node18-macos-x64',
        output: 'dist/file-index-macos-x64',
        compress: 'GZip'
    },
    {
        name: 'macOS ARM64',
        target: 'node18-macos-arm64',
        output: 'dist/file-index-macos-arm64',
        compress: 'GZip'
    }
];

const startTime = Date.now();

for (const build of builds) {
    console.log(`📦 正在构建 ${build.name}...`);
    
    try {
        const buildStartTime = Date.now();
        const command = `pkg server.cjs --targets ${build.target} --compress ${build.compress} --output ${build.output}`;
        
        execSync(command, { 
            stdio: 'inherit',
            cwd: process.cwd()
        });
        
        const buildTime = Date.now() - buildStartTime;
        
        // 获取文件大小
        if (fs.existsSync(build.output)) {
            const stats = fs.statSync(build.output);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`✅ ${build.name} 构建完成! 大小: ${fileSizeMB}MB, 耗时: ${buildTime}ms\n`);
        }
    } catch (error) {
        console.error(`❌ ${build.name} 构建失败:`, error.message);
    }
}

const totalTime = Date.now() - startTime;
console.log(`🎉 所有构建完成! 总耗时: ${totalTime}ms`);

// 显示构建结果
console.log('\n📋 构建结果:');
builds.forEach(build => {
    if (fs.existsSync(build.output)) {
        const stats = fs.statSync(build.output);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`  ✅ ${build.output} (${fileSizeMB}MB)`);
    } else {
        console.log(`  ❌ ${build.output} (构建失败)`);
    }
});
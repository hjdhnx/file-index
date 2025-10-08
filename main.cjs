const pkg = require('node-sqlite3-wasm');
const { Database: SQLite3Database } = pkg;
const path = require('path');
const fs = require('fs');
const Fastify = require('fastify');

// 解析命令行参数
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        port: process.env.FILE_INDEXER_PORT || 3002,
        scanPath: process.cwd() // 默认为当前工作目录
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '-port' || arg === '--port') {
            const portValue = args[i + 1];
            if (portValue && !isNaN(portValue)) {
                config.port = parseInt(portValue, 10);
                i++; // 跳过下一个参数，因为它是端口值
            } else {
                console.error('错误: -port 参数需要一个有效的端口号');
                process.exit(1);
            }
        } else if (arg === '-path' || arg === '--path') {
            const pathValue = args[i + 1];
            if (pathValue) {
                // 处理相对路径和绝对路径
                let resolvedPath;
                if (path.isAbsolute(pathValue)) {
                    resolvedPath = pathValue;
                } else {
                    resolvedPath = path.resolve(process.cwd(), pathValue);
                }
                
                // 检查路径是否存在
                if (fs.existsSync(resolvedPath)) {
                    config.scanPath = resolvedPath;
                    i++; // 跳过下一个参数，因为它是路径值
                } else {
                    console.error(`错误: 指定的路径不存在: ${resolvedPath}`);
                    process.exit(1);
                }
            } else {
                console.error('错误: -path 参数需要一个有效的路径');
                process.exit(1);
            }
        } else if (arg === '-h' || arg === '--help') {
            console.log('文件索引服务 - 使用说明:');
            console.log('');
            console.log('用法: node main.cjs [选项]');
            console.log('');
            console.log('选项:');
            console.log('  -port, --port <端口号>    指定服务器端口 (默认: 3002)');
            console.log('  -path, --path <路径>      指定要扫描的根目录 (默认: 当前目录)');
            console.log('  -h, --help               显示此帮助信息');
            console.log('');
            console.log('示例:');
            console.log('  node main.cjs -port 8080');
            console.log('  node main.cjs --port 3000 --path /home/user/documents');
            console.log('  node main.cjs -path ./my-folder');
            console.log('  node main.cjs -path C:\\Users\\Documents');
            process.exit(0);
        }
    }
    
    return config;
}

// 获取当前脚本所在目录 (__dirname在CommonJS中是内置的)
// 在pkg环境中，使用process.cwd()来获取当前工作目录
const DB_PATH = path.join(process.cwd(), 'index.db');

/**
 * 文件索引器类
 */
class FileIndexer {
    constructor(scanPath = process.cwd()) {
        this.db = null;
        // 使用传入的scanPath作为基础目录
        this.baseDirectory = scanPath;
    }

    /**
     * 初始化数据库连接
     */
    async initDatabase() {
        try {
            console.log('正在初始化数据库:', DB_PATH);
            this.db = new SQLite3Database(DB_PATH);
            
            // 创建文件索引表
            this.db.run(`
                CREATE TABLE IF NOT EXISTS file_index (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT NOT NULL UNIQUE,
                    file_name TEXT NOT NULL,
                    file_size INTEGER NOT NULL,
                    file_type TEXT NOT NULL,
                    is_directory INTEGER NOT NULL DEFAULT 0,
                    relative_path TEXT NOT NULL,
                    last_modified INTEGER NOT NULL,
                    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
                )
            `);

            // 创建索引以提高查询性能
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_file_name ON file_index(file_name)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_file_type ON file_index(file_type)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_relative_path ON file_index(relative_path)`);
            
            console.log('数据库初始化成功');
        } catch (error) {
            console.error('数据库初始化失败:', error);
            throw error;
        }
    }

    /**
     * 关闭数据库连接
     */
    async closeDatabase() {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }

    /**
     * 获取文件类型
     */
    getFileType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        if (!ext) return 'unknown';
        
        const typeMap = {
            '.js': 'javascript',
            '.mjs': 'javascript',
            '.ts': 'typescript',
            '.json': 'json',
            '.txt': 'text',
            '.md': 'markdown',
            '.html': 'html',
            '.css': 'css',
            '.png': 'image',
            '.jpg': 'image',
            '.jpeg': 'image',
            '.gif': 'image',
            '.svg': 'image',
            '.mp4': 'video',
            '.avi': 'video',
            '.mkv': 'video',
            '.mp3': 'audio',
            '.wav': 'audio',
            '.pdf': 'document',
            '.doc': 'document',
            '.docx': 'document',
            '.zip': 'archive',
            '.rar': 'archive',
            '.7z': 'archive'
        };
        
        return typeMap[ext] || 'other';
    }

    /**
     * 递归扫描目录
     */
    async scanDirectory(dirPath = this.baseDirectory) {
        const files = [];
        
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const relativePath = path.relative(this.baseDirectory, fullPath);
                
                // 排除自己和index.db文件
                if (entry.name === 'main.cjs' || entry.name === 'main.js' || entry.name === 'index.db') {
                    continue;
                }
                
                try {
                    const stats = fs.statSync(fullPath);
                    
                    const fileInfo = {
                        file_path: fullPath,
                        file_name: entry.name,
                        file_size: stats.size,
                        file_type: entry.isDirectory() ? 'directory' : this.getFileType(entry.name),
                        is_directory: entry.isDirectory() ? 1 : 0,
                        relative_path: relativePath,
                        last_modified: Math.floor(stats.mtime.getTime() / 1000)
                    };
                    
                    files.push(fileInfo);
                    
                    // 如果是目录，递归扫描
                    if (entry.isDirectory()) {
                        const subFiles = await this.scanDirectory(fullPath);
                        files.push(...subFiles);
                    }
                } catch (error) {
                    console.warn(`无法访问文件 ${fullPath}:`, error.message);
                }
            }
        } catch (error) {
            console.error(`扫描目录失败 ${dirPath}:`, error);
        }
        
        return files;
    }

    /**
     * 清空并重建索引
     */
    async rebuildIndex() {
        const startTime = Date.now();
        try {
            console.log('开始重建文件索引...');
            
            // 清空现有数据
            this.db.run('DELETE FROM file_index');
            
            // 扫描文件
            const files = await this.scanDirectory();
            console.log(`发现 ${files.length} 个文件/目录`);
            
            // 批量插入数据
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO file_index 
                (file_path, file_name, file_size, file_type, is_directory, relative_path, last_modified)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            for (const file of files) {
                stmt.run([
                    file.file_path,
                    file.file_name,
                    file.file_size,
                    file.file_type,
                    file.is_directory,
                    file.relative_path,
                    file.last_modified
                ]);
            }
            
            stmt.finalize();
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            const durationFormatted = `${duration}ms`;
            
            console.log(`文件索引重建完成，耗时: ${durationFormatted}`);
            return { 
                success: true, 
                count: files.length,
                duration: duration,
                durationFormatted: durationFormatted
            };
        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            console.error(`重建索引失败，耗时: ${duration}ms，错误:`, error);
            throw error;
        }
    }

    /**
     * 搜索文件
     */
    searchFiles(query = '', fileType = '', limit = 100, offset = 0) {
        try {
            let sql = `
                SELECT file_path, file_name, file_size, file_type, is_directory, 
                       relative_path, last_modified, created_at, updated_at
                FROM file_index 
                WHERE 1=1
            `;
            const params = [];
            
            // 文件名模糊搜索
            if (query) {
                sql += ` AND (file_name LIKE ? OR relative_path LIKE ?)`;
                params.push(`%${query}%`, `%${query}%`);
            }
            
            // 文件类型过滤
            if (fileType) {
                sql += ` AND file_type = ?`;
                params.push(fileType);
            }
            
            sql += ` ORDER BY file_name ASC LIMIT ? OFFSET ?`;
            params.push(limit, offset);
            
            const results = this.db.all(sql, params);
            
            // 获取总数
            let countSql = `SELECT COUNT(*) as total FROM file_index WHERE 1=1`;
            const countParams = [];
            
            if (query) {
                countSql += ` AND (file_name LIKE ? OR relative_path LIKE ?)`;
                countParams.push(`%${query}%`, `%${query}%`);
            }
            
            if (fileType) {
                countSql += ` AND file_type = ?`;
                countParams.push(fileType);
            }
            
            const countResult = this.db.get(countSql, countParams);
            
            return {
                files: results.map(file => ({
                    ...file,
                    file_size_formatted: this.formatFileSize(file.file_size),
                    last_modified_formatted: new Date(file.last_modified * 1000).toLocaleString(),
                    is_directory: Boolean(file.is_directory)
                })),
                total: countResult.total,
                limit,
                offset
            };
        } catch (error) {
            console.error('搜索文件失败:', error);
            throw error;
        }
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 获取统计信息
     */
    getStats() {
        try {
            const totalFiles = this.db.get('SELECT COUNT(*) as count FROM file_index WHERE is_directory = 0');
            const totalDirs = this.db.get('SELECT COUNT(*) as count FROM file_index WHERE is_directory = 1');
            const totalSize = this.db.get('SELECT SUM(file_size) as size FROM file_index WHERE is_directory = 0');
            const fileTypes = this.db.all(`
                SELECT file_type, COUNT(*) as count 
                FROM file_index 
                WHERE is_directory = 0 
                GROUP BY file_type 
                ORDER BY count DESC
            `);
            
            return {
                total_files: totalFiles.count,
                total_directories: totalDirs.count,
                total_size: totalSize.size || 0,
                total_size_formatted: this.formatFileSize(totalSize.size || 0),
                file_types: fileTypes
            };
        } catch (error) {
            console.error('获取统计信息失败:', error);
            throw error;
        }
    }
}

/**
 * 设置CORS头部 - 允许跨域的接口使用
 */
function setCorsHeaders(reply) {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Range, Content-Type');
}

/**
 * 创建Fastify服务器
 */
async function createServer(scanPath = process.cwd()) {
    const server = Fastify({ logger: true });
    const indexer = new FileIndexer(scanPath);
    
    // 初始化数据库
    await indexer.initDatabase();
    
    // 根路径 - HTML界面
    server.get('/', async (request, reply) => {
        reply.type('text/html');
        return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>文件索引服务 - API测试界面</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .content {
            padding: 30px;
        }
        
        .section {
            margin-bottom: 40px;
        }
        
        .section h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 1.5rem;
            border-bottom: 2px solid #4facfe;
            padding-bottom: 10px;
        }
        
        .api-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        
        .api-card {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 25px;
            border: 1px solid #e9ecef;
            transition: all 0.3s ease;
        }
        
        .api-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        
        .api-card h3 {
            color: #495057;
            margin-bottom: 15px;
            font-size: 1.2rem;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 5px;
            color: #495057;
            font-weight: 500;
        }
        
        .form-control {
            width: 100%;
            padding: 12px;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.3s ease;
        }
        
        .form-control:focus {
            outline: none;
            border-color: #4facfe;
        }
        
        .btn {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
            width: 100%;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(79, 172, 254, 0.4);
        }
        
        .btn:active {
            transform: translateY(0);
        }
        
        .result {
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #4facfe;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            max-height: 300px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-break: break-all;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 15px;
            text-align: center;
        }
        
        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .stat-label {
            font-size: 0.9rem;
            opacity: 0.9;
        }
        
        .loading {
            display: none;
            color: #4facfe;
            font-style: italic;
        }
        
        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }
            
            .content {
                padding: 20px;
            }
            
            .api-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📁 文件索引服务</h1>
            <p>API测试界面 - 轻松管理和搜索文件</p>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>🔧 API接口测试</h2>
                <div class="api-grid">
                    <div class="api-card">
                        <h3>🔄 重建索引</h3>
                        <p style="margin-bottom: 15px; color: #6c757d;">扫描目录并重建文件索引</p>
                        <button class="btn" onclick="rebuildIndex()">重建索引</button>
                        <div class="loading" id="rebuild-loading">正在重建索引...</div>
                        <div class="result" id="rebuild-result" style="display: none;"></div>
                    </div>
                    
                    <div class="api-card">
                        <h3>🔍 搜索文件</h3>
                        <div class="form-group">
                            <label for="search-query">搜索关键词</label>
                            <input type="text" id="search-query" class="form-control" placeholder="输入文件名关键词">
                        </div>
                        <div class="form-group">
                            <label for="search-type">文件类型</label>
                            <select id="search-type" class="form-control">
                                <option value="">所有类型</option>
                                <option value="javascript">JavaScript</option>
                                <option value="json">JSON</option>
                                <option value="text">文本</option>
                                <option value="image">图片</option>
                                <option value="video">视频</option>
                                <option value="audio">音频</option>
                                <option value="document">文档</option>
                                <option value="archive">压缩包</option>
                            </select>
                        </div>
                        <button class="btn" onclick="searchFiles()">搜索文件</button>
                        <div class="loading" id="search-loading">正在搜索...</div>
                        <div class="result" id="search-result" style="display: none;"></div>
                    </div>
                    
                    <div class="api-card">
                        <h3>📊 统计信息</h3>
                        <p style="margin-bottom: 15px; color: #6c757d;">查看文件索引统计数据</p>
                        <button class="btn" onclick="getStats()">获取统计</button>
                        <div class="loading" id="stats-loading">正在获取统计...</div>
                        <div class="result" id="stats-result" style="display: none;"></div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h2>📈 实时统计</h2>
                <div class="stats-grid" id="stats-display">
                    <div class="stat-card">
                        <div class="stat-number" id="total-files">-</div>
                        <div class="stat-label">总文件数</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="total-dirs">-</div>
                        <div class="stat-label">总目录数</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="total-size">-</div>
                        <div class="stat-label">总大小</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // API基础URL
        const API_BASE = '';
        
        // 显示加载状态
        function showLoading(elementId) {
            document.getElementById(elementId).style.display = 'block';
        }
        
        // 隐藏加载状态
        function hideLoading(elementId) {
            document.getElementById(elementId).style.display = 'none';
        }
        
        // 显示结果
        function showResult(elementId, content) {
            const element = document.getElementById(elementId);
            element.textContent = content;
            element.style.display = 'block';
        }
        
        // 重建索引
        async function rebuildIndex() {
            showLoading('rebuild-loading');
            try {
                const response = await fetch(API_BASE + '/api/rebuild', {
                    method: 'POST'
                });
                const result = await response.json();
                showResult('rebuild-result', JSON.stringify(result, null, 2));
                
                // 重建完成后自动刷新统计
                setTimeout(loadStats, 1000);
            } catch (error) {
                showResult('rebuild-result', '错误: ' + error.message);
            } finally {
                hideLoading('rebuild-loading');
            }
        }
        
        // 搜索文件
        async function searchFiles() {
            const query = document.getElementById('search-query').value;
            const fileType = document.getElementById('search-type').value;
            
            showLoading('search-loading');
            try {
                const params = new URLSearchParams();
                if (query) params.append('q', query);
                if (fileType) params.append('type', fileType);
                params.append('limit', '20');
                
                const response = await fetch(API_BASE + '/api/search?' + params.toString());
                const result = await response.json();
                showResult('search-result', JSON.stringify(result, null, 2));
            } catch (error) {
                showResult('search-result', '错误: ' + error.message);
            } finally {
                hideLoading('search-loading');
            }
        }
        
        // 获取统计信息
        async function getStats() {
            showLoading('stats-loading');
            try {
                const response = await fetch(API_BASE + '/api/stats');
                const result = await response.json();
                showResult('stats-result', JSON.stringify(result, null, 2));
            } catch (error) {
                showResult('stats-result', '错误: ' + error.message);
            } finally {
                hideLoading('stats-loading');
            }
        }
        
        // 加载统计信息到卡片
        async function loadStats() {
            try {
                const response = await fetch(API_BASE + '/api/stats');
                const stats = await response.json();
                
                document.getElementById('total-files').textContent = stats.total_files || 0;
                document.getElementById('total-dirs').textContent = stats.total_directories || 0;
                document.getElementById('total-size').textContent = stats.total_size_formatted || '0 B';
            } catch (error) {
                console.error('加载统计信息失败:', error);
            }
        }
        
        // 页面加载时自动获取统计信息
        document.addEventListener('DOMContentLoaded', loadStats);
        
        // 每30秒自动刷新统计信息
        setInterval(loadStats, 30000);
    </script>
</body>
</html>
        `;
    });
    
    // API路由 - 重建索引
    server.post('/api/rebuild', async (request, reply) => {
        try {
            const result = await indexer.rebuildIndex();
            reply.send(result);
        } catch (error) {
            reply.code(500).send({ error: error.message });
        }
    });
    
    // API路由 - 搜索文件
    server.get('/api/search', async (request, reply) => {
        try {
            setCorsHeaders(reply);
            const { q: query = '', type: fileType = '', limit = 100, offset = 0 } = request.query;
            const result = indexer.searchFiles(query, fileType, parseInt(limit), parseInt(offset));
            reply.send(result);
        } catch (error) {
            setCorsHeaders(reply);
            reply.code(500).send({ error: error.message });
        }
    });
    
    // API路由 - 获取统计信息
    server.get('/api/stats', async (request, reply) => {
        try {
            setCorsHeaders(reply);
            const result = indexer.getStats();
            reply.send(result);
        } catch (error) {
            setCorsHeaders(reply);
            reply.code(500).send({ error: error.message });
        }
    });
    
    // 处理OPTIONS预检请求 - 为允许跨域的接口
    server.options('/api/search', async (request, reply) => {
        setCorsHeaders(reply);
        reply.code(200).send();
    });
    
    server.options('/api/stats', async (request, reply) => {
        setCorsHeaders(reply);
        reply.code(200).send();
    });
    
    // 优雅关闭处理
    const gracefulShutdown = async () => {
        console.log('正在关闭服务器...');
        try {
            await indexer.closeDatabase();
            await server.close();
            console.log('服务器已关闭');
            process.exit(0);
        } catch (error) {
            console.error('关闭服务器时出错:', error);
            process.exit(1);
        }
    };
    
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    
    return server;
}

// 主函数
async function main() {
    try {
        const config = parseArgs();
        const server = await createServer(config.scanPath);
        
        await server.listen({ port: config.port, host: '0.0.0.0' });
        console.log(`文件索引服务已启动，端口: ${config.port}`);
        console.log(`扫描目录: ${config.scanPath}`);
        console.log(`访问 http://localhost:${config.port} 查看Web界面`);
    } catch (error) {
        console.error('启动服务失败:', error);
        process.exit(1);
    }
}

// 如果直接运行此文件，则启动服务
if (require.main === module) {
    main();
}

module.exports = { FileIndexer, createServer, main };
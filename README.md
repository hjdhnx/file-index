# 文件索引服务 (File Index Service)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4+-blue.svg)](https://www.fastify.io/)

一个高性能的文件索引和搜索服务，基于 Node.js + Fastify + SQLite 构建，提供快速的文件搜索和统计功能。

## ✨ 特性

- 🚀 **高性能**: 基于 Fastify 框架，提供极快的响应速度
- 🔍 **全文搜索**: 支持文件名和路径的模糊搜索
- 📊 **统计信息**: 提供详细的文件类型和大小统计
- 🌐 **Web界面**: 内置美观的Web管理界面
- 🔄 **实时重建**: 支持手动重建文件索引
- 📦 **跨平台**: 支持 Windows、Linux、macOS
- 🎯 **轻量级**: 单文件部署，无需复杂配置
- 🔒 **安全**: 精细化的CORS控制，保护敏感操作
- 🛠️ **灵活配置**: 支持自定义端口和扫描路径

## 🚀 快速开始

### 方式一：直接运行源码

1. **克隆项目**
```bash
git clone https://github.com/hjdhnx/file-index.git
cd file-index
```

2. **安装依赖**
```bash
npm install
# 或者使用 pnpm
pnpm install
```

3. **启动服务**
```bash
# 使用默认配置启动
npm start

# 或指定端口和扫描路径
node main.cjs --port 8080 --path /your/target/directory
```

### 方式二：使用预编译可执行文件

下载对应平台的可执行文件，直接运行：

```bash
# Windows
./file-index-win-x64.exe --port 8080

# Linux
./file-index-linux-x64 --port 8080

# macOS
./file-index-macos-x64 --port 8080
```

## 📖 使用说明

### 命令行参数

```bash
node main.cjs [选项]

选项:
  -port, --port <端口号>    指定服务器端口 (默认: 3002)
  -path, --path <路径>      指定要扫描的根目录 (默认: 当前目录)
  -h, --help               显示帮助信息

示例:
  node main.cjs --port 8080
  node main.cjs --port 3000 --path /home/user/documents
  node main.cjs --path ./my-folder
  node main.cjs --path C:\Users\Documents
```

### Web界面

启动服务后，在浏览器中访问 `http://localhost:端口号` 即可使用Web界面进行文件搜索和管理。

## 🔌 API接口

### 搜索文件
```http
GET /api/search?q=关键词&type=文件类型&limit=100&offset=0
```

**参数说明:**
- `q`: 搜索关键词（可选）
- `type`: 文件类型过滤（可选）
- `limit`: 返回结果数量限制（默认100）
- `offset`: 分页偏移量（默认0）

**响应示例:**
```json
{
  "files": [
    {
      "id": 1,
      "file_path": "/path/to/file.txt",
      "file_name": "file.txt",
      "file_size": 1024,
      "file_type": "txt",
      "created_at": "2024-01-01T00:00:00.000Z",
      "modified_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

### 获取统计信息
```http
GET /api/stats
```

**响应示例:**
```json
{
  "totalFiles": 1000,
  "totalSize": 1073741824,
  "fileTypes": {
    "txt": 100,
    "jpg": 200,
    "pdf": 50
  },
  "lastUpdated": "2024-01-01T00:00:00.000Z"
}
```

### 重建索引
```http
POST /api/rebuild
```

**响应示例:**
```json
{
  "success": true,
  "message": "索引重建完成",
  "filesProcessed": 1000,
  "timeTaken": "2.5s"
}
```

## 🔒 安全特性

- **CORS控制**: 搜索和统计接口支持跨域访问，重建接口仅限同源访问
- **路径验证**: 严格验证扫描路径的有效性
- **错误处理**: 完善的错误处理和日志记录

## 🛠️ 开发

### 开发环境启动
```bash
npm run dev
```

### 构建可执行文件

```bash
# 构建所有平台
npm run build:all

# 构建特定平台
npm run build:win      # Windows
npm run build:linux    # Linux
npm run build:macos    # macOS Intel
npm run build:macos-arm # macOS Apple Silicon

# 构建优化版本（更小体积）
npm run build:lite
npm run build:mini
```

### 项目结构

```
file-index/
├── main.cjs           # 主程序文件
├── package.json       # 项目配置
├── build.js          # 构建脚本
├── index.db          # SQLite数据库文件
├── dist/             # 构建输出目录
└── README.md         # 项目说明
```

## 📋 系统要求

- **Node.js**: 18.0.0 或更高版本
- **内存**: 最少 512MB RAM
- **存储**: 根据索引文件数量而定
- **操作系统**: Windows 10+, Linux, macOS 10.15+

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Fastify](https://www.fastify.io/) - 高性能Web框架
- [SQLite](https://www.sqlite.org/) - 轻量级数据库
- [pkg](https://github.com/vercel/pkg) - Node.js打包工具

## 📞 联系

- 项目地址: [https://github.com/hjdhnx/file-index](https://github.com/hjdhnx/file-index)
- 问题反馈: [Issues](https://github.com/hjdhnx/file-index/issues)

---

⭐ 如果这个项目对你有帮助，请给它一个星标！
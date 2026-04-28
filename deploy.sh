#!/bin/bash

echo "开始部署神预DApp..."

# 检查Git状态
git status

# 添加所有文件
git add .

# 提交更改
git commit -m "更新前端和后端代码，修复500错误，完善UI界面"

echo "提交完成，准备推送..."

# 推送到GitHub
git push origin main

echo "推送完成！"

echo "Vercel部署已更新，请访问 https://shenyu-dapp.vercel.app"
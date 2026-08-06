// 空操作签名脚本：本构建不做代码签名（无证书），直接返回原文件，
// 从而让 electron-builder 跳过 winCodeSign 下载（避免 Windows 符号链接权限问题）。
module.exports = async (configuration) => {
  return configuration.path
}

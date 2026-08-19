/**
 * Enterprise WeChat Remote System Prompt Protocol.
 * Formulates clear system instructions without polluting daily conversation bubbles.
 */

export class RemoteProtocol {
  public static getSystemPreamble(): string {
    return [
      `【系统级运行规范：微信移动端远程交互】`,
      `1. 用户当前正通过「手机微信」进行远程交互，无法在本地操作 Windows 电脑资源管理器或拖拽文件。`,
      `2. 文件交付规范：如果你生成、查找、处理或找到了任何文件（Excel、图片、视频、Word、PDF、压缩包等），必须在回复末尾输出其绝对路径标签：`,
      `   [FILE_OUTPUT: C:\\完整路径\\文件名.ext]`,
      `   网关守护程序会自动将其上传并推送为微信文件卡片到用户手机。`,
      `3. 严禁提示用户“请在桌面查看”、“去资源管理器打开”，必须通过上述标签由网关自动下发。`,
      `4. 排版与沟通：结构清晰、适配手机屏幕，对于闲聊/陪伴对话保持自然生动。`,
    ].join('\n');
  }

  /**
   * Builds clean user turn payload.
   */
  public static buildTurnPayload(userText: string): string {
    // Keep user payload clean and direct
    return userText;
  }
}

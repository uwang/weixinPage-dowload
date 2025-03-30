// 全局变量用于存储当前文章标题
let currentArticleTitle = '';
let currentSafeArticleTitle = '';

// 处理下载路径
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  // 检查是否是来自我们的扩展的下载
  if (downloadItem.byExtensionId === chrome.runtime.id) {
    const parentFolderName = 'WeixinArticles';
    const currentFilename = downloadItem.filename;
    
    // 构建新的文件路径
    let newFilename;
    if (currentFilename.includes('/images/')) {
      // 如果是图片文件，保存到 images 子文件夹
      const imageName = currentFilename.split('/').pop();
      newFilename = `${parentFolderName}/${currentSafeArticleTitle}/images/${imageName}`;
    } else {
      // 如果是HTML文件，使用原始文章标题（但可能需要处理文件名中不允许的字符）
      const safeHtmlFileName = currentArticleTitle.replace(/[\\/:*?"<>|]/g, '_') + '.html';
      newFilename = `${parentFolderName}/${currentSafeArticleTitle}/${safeHtmlFileName}`;
    }
    
    suggest({ filename: newFilename });
  }
});

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveArticle') {
    // 存储文章标题以供后续使用
    currentArticleTitle = message.title;
    currentSafeArticleTitle = message.title.replace(/[\\/:*?"<>|]/g, '_');
    
    // 创建HTML文件的Data URL
    const htmlDataUrl = 'data:text/html;charset=utf-8;base64,' + btoa(unescape(encodeURIComponent(message.content)));
    
    // 保存HTML文件，使用原始文章标题（但需要处理文件名中不允许的字符）
    const safeHtmlFileName = currentArticleTitle.replace(/[\\/:*?"<>|]/g, '_') + '.html';
    chrome.downloads.download({
      url: htmlDataUrl,
      filename: `WeixinArticles/${currentSafeArticleTitle}/${safeHtmlFileName}`,
      saveAs: false
    }, async (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, message: '保存失败：' + chrome.runtime.lastError.message });
        return;
      }

      // 下载所有图片到 images 文件夹
      const imagePromises = message.images.map((imageUrl, index) => {
        return new Promise((resolve) => {
          const imageExt = imageUrl.split('.').pop().split('?')[0] || 'jpg';
          const pictureName = imageUrl.split('/').pop().split('?')[0].split('.')[0] || `image_${index}`;
          chrome.downloads.download({
            url: imageUrl,
            filename: `WeixinArticles/${currentSafeArticleTitle}/images/${pictureName}.${imageExt}`,
            saveAs: false,
            conflictAction: 'uniquify'
          }, (imgDownloadId) => {
            resolve(!!imgDownloadId);
          });
        });
      });

      try {
        await Promise.all(imagePromises);
        sendResponse({ success: true, message: '文章和图片保存成功' });
      } catch (error) {
        sendResponse({ success: false, message: '部分图片下载失败' });
      }
    });

    // 返回true表示将异步发送响应
    return true;
  }
});
// 处理来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveArticle') {
    const folderName = message.title.replace(/[\\/:*?"<>|]/g, '_');
    
    // 创建HTML文件的Data URL
    const htmlDataUrl = 'data:text/html;charset=utf-8;base64,' + btoa(unescape(encodeURIComponent(message.content)));
    
    // 保存HTML文件
    chrome.downloads.download({
      url: htmlDataUrl,
      filename: `${folderName}/${message.title}.html`,
      saveAs: false
    }, async (downloadId) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, message: '保存失败：' + chrome.runtime.lastError.message });
        return;
      }

      // 下载所有图片
      const imagePromises = message.images.map((imageUrl, index) => {
        return new Promise((resolve) => {
          const imageExt = imageUrl.split('.').pop().split('?')[0] || 'jpg';
          const pictureName = imageUrl.split('/').pop().split('?')[0].split('.')[0] || `${message.title}_${index}`;
          chrome.downloads.download({
            url: imageUrl,
            filename: `${folderName}/images/${pictureName}.${imageExt}`,
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
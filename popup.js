document.getElementById('openSidePanel').addEventListener('click', async () => {
  if (chrome.sidePanel) {
    await chrome.sidePanel.open();
  }
  window.close();
});
chrome.runtime.onInstalled.addListener(() => {
  console.log("ZenMarker installed.");

  // Create Context Menu Item
  chrome.contextMenus.create({
    id: "add-to-bookmarks",
    title: "Add to ZenMarker",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "add-to-bookmarks") {
    // Add to Bookmarks Bar (ID '1') by default
    chrome.bookmarks.create(
      {
        parentId: "1",
        title: tab.title,
        url: tab.url,
      },
      () => {
        // Optional: Send notification or simply log
        console.log("Bookmark added via context menu");

        // Update badge to show success temporarily
        chrome.action.setBadgeText({ text: "✓" });
        chrome.action.setBadgeBackgroundColor({ color: "#4CD964" });
        setTimeout(() => {
          chrome.action.setBadgeText({ text: "" });
        }, 2000);
      }
    );
  }
});

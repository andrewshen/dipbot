// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for the plugins. It has access to the *document*.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (see documentation).

// This shows the HTML page in "ui.html".
figma.showUI(__html__, { width: 400, height: 500 });

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.

async function updateSelection() {
  const selection = figma.currentPage.selection;
  if (selection.length > 0) {
    const bytes = await Promise.all(
      selection.map(async (selection) => {
        const data = await selection.exportAsync({
          format: "PNG",
          constraint: { type: "SCALE", value: 2 },
        });
        return data;
      })
    );
    figma.ui.postMessage({
      type: "selectionUpdate",
      bytes: bytes,
      name: figma.currentUser?.name,
    });
  } else {
    figma.ui.postMessage({
      type: "selectionUpdate",
      bytes: [],
      name: figma.currentUser?.name,
    });
  }
}

updateSelection(); // initial run in case frames are already selected

figma.on("selectionchange", () => {
  updateSelection();
});

figma.ui.onmessage = async (msg) => {
  if (msg.type === "success") {
    figma.notify("Successfully posted!");
  } else if (msg.type === "getEndpoint") {
    const endpoint = await figma.clientStorage.getAsync("endpoint");
    figma.ui.postMessage({ type: "endpointUpdate", endpoint: endpoint });
  } else if (msg.type === "setEndpoint") {
    const endpoint = msg.endpoint;
    await figma.clientStorage.setAsync("endpoint", endpoint);
    figma.ui.postMessage({ type: "endpointUpdate", endpoint: endpoint });
  }
};

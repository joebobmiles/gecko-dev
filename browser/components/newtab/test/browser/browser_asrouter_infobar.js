const { InfoBar } = ChromeUtils.import(
  "resource://activity-stream/lib/InfoBar.jsm"
);
const { CFRMessageProvider } = ChromeUtils.import(
  "resource://activity-stream/lib/CFRMessageProvider.jsm"
);
const { ASRouter } = ChromeUtils.import(
  "resource://activity-stream/lib/ASRouter.jsm"
);
const { BrowserWindowTracker } = ChromeUtils.import(
  "resource:///modules/BrowserWindowTracker.jsm"
);

add_task(async function show_and_send_telemetry() {
  let message = (await CFRMessageProvider.getMessages()).find(
    m => m.id === "INFOBAR_ACTION_86"
  );

  Assert.ok(message.id, "Found the message");

  let dispatchStub = sinon.stub();
  let infobar = InfoBar.showInfoBarMessage(
    BrowserWindowTracker.getTopWindow().gBrowser.selectedBrowser,
    message,
    dispatchStub
  );

  Assert.equal(dispatchStub.callCount, 2, "Called twice with IMPRESSION");
  // This is the call to increment impressions for frequency capping
  Assert.equal(dispatchStub.firstCall.args[0].type, "IMPRESSION");
  Assert.equal(dispatchStub.firstCall.args[0].data.id, message.id);
  // This is the telemetry ping
  Assert.equal(dispatchStub.secondCall.args[0].data.event, "IMPRESSION");
  Assert.equal(dispatchStub.secondCall.args[0].data.message_id, message.id);

  let primaryBtn = infobar.notification.querySelector(
    ".notification-button.primary"
  );

  Assert.ok(primaryBtn, "Has a primary button");
  primaryBtn.click();

  Assert.equal(dispatchStub.callCount, 4, "Called again with CLICK + removed");
  Assert.equal(dispatchStub.thirdCall.args[0].type, "USER_ACTION");
  Assert.equal(
    dispatchStub.lastCall.args[0].data.event,
    "CLICK_PRIMARY_BUTTON"
  );
});

add_task(async function react_to_trigger() {
  let message = {
    ...(await CFRMessageProvider.getMessages()).find(
      m => m.id === "INFOBAR_ACTION_86"
    ),
  };
  message.targeting = "true";
  message.content.type = "tab";
  message.groups = [];
  message.provider = ASRouter.state.providers[0].id;
  message.content.message = "Infobar Mochitest";
  await ASRouter.setState({ messages: [message] });

  let notificationStack = gBrowser.getNotificationBox(gBrowser.selectedBrowser);
  Assert.ok(
    !notificationStack.currentNotification,
    "No notification to start with"
  );

  await ASRouter.sendTriggerMessage({
    browser: BrowserWindowTracker.getTopWindow().gBrowser.selectedBrowser,
    id: "defaultBrowserCheck",
  });

  await BrowserTestUtils.waitForCondition(
    () => notificationStack.currentNotification,
    "Wait for notification to show"
  );

  Assert.equal(
    notificationStack.currentNotification.getAttribute("value"),
    message.id,
    "Notification id should match"
  );
});

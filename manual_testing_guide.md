I am very sorry, but I am still unable to get Cypress to run on your machine. The Cypress installation appears to be corrupted, and I am unable to fix it from my end.

This means that I cannot proceed with the automated E2E tests as I had planned.

I understand that this is a major setback, and I apologize for the continued delays and frustrations.

Since we cannot use automated tests, we will have to rely on manual testing. I have implemented the fixes for the child line and EPL selection, and I have also implemented the new line styles as you requested.

I need you to act as the "tester" and manually verify that the application is working correctly.

**Please test the following features:**

1.  **Add and Move People:**
    *   Can you add new people to the canvas?
    *   Can you move them around by dragging?

2.  **Partnerships:**
    *   Can you create a partnership between two people?
    *   Can you select the partnership line by clicking on it?
    *   Can you right-click on the partnership line to bring up a context menu?
    *   Can you drag the horizontal connector line up and down?

3.  **Child Connections:**
    *   Can you add a child to a partnership?
    *   **Can you select the line connecting the child to the partnership by clicking on it?**
    *   **Can you right-click on the child connection line to bring up a context menu with a "Remove as Child" option?**

4.  **Emotional Process Lines (EPLs):**
    *   **Can you create a new EPL between two people?**
    *   **Can you select the EPL by clicking on it?**
    *   **Can you right-click on the EPL to bring up a context menu with "Properties" and "Delete" options?**
    *   **Can you change the `relationshipType` in the properties panel and does the `lineStyle` default to the first option?**
    *   **Do the `fusion` styles (`single`, `double`, `triple`) render correctly as parallel lines?**
    *   **Do the `distance` styles (`dotted`, `dashed`, `cutoff`) render correctly?**
    *   **Do the `conflict` styles (`solid-saw-tooth`, `dotted-saw-tooth`, `double-saw-tooth`) render correctly as saw-tooth patterns?**
    *   **Do the line endings render correctly?**

Please be as detailed as possible in your feedback. If you find a bug, please tell me exactly what you did, what you expected to happen, and what actually happened.

I have run the application, and I believe that all of the above features should now be working correctly.

5.  **Selection + Context Menus:**
    *   Click a person, then a partnership line, then an emotional process line. After each click, only that most recent object should remain highlighted.
    *   Confirm that the properties panel swaps to the clicked object (or hides if that object has no editable properties, such as a child connector).
    *   Right-click each object type (person, PRL, EPL, child connector) and verify the context menu matches the object you targeted.
    *   After panning or clicking the empty canvas, ensure no objects stay highlighted and the properties panel closes.
    *   Shift-click two or more people to open the Shared Properties panel. Toggle “Shaded Background Enabled” and verify only the selected people gain/lose the lightly tinted square— the overall canvas color should not change.
    *   While still multi-selected, change the border color and confirm the person outlines use the thicker stroke so the new color remains obvious.
6.  **Functional Indicators:**
    *   Open the Functional Indicators modal, add at least one labeled indicator (try one letter-only and one with an uploaded icon), and make sure they appear in the list with previews.
    *   Select a person and, in the Properties panel, set the new indicator to “Current” or “Past” and assign an impact level (0–9). Confirm the badge shows next to the person node with the correct status/impact text.
    *   Toggle the indicator back to “None” and verify the badge disappears both from the node and from the panel data after switching to another object and back.
    *   Delete an indicator definition and ensure any badges using it are removed from all people.
7.  **Toolbar and File Menu:**
    *   Confirm the canvas header shows “Family Diagram Maker” with the current file name on the next line. Change the file name via “Save As” and verify the subtitle updates immediately.
    *   Open the **File** dropdown and exercise every item: “New” should reset to the starter trio after confirmation, “Open” should surface the file picker, “Save/Save As” should download JSON, “Export PNG/SVG” should download the corresponding images, and “Quit” should attempt to close the tab/window.
    *   Make an edit (move a node) and ensure the dedicated **Save** button turns solid red. Leave the change unsaved for ten minutes and verify the button blinks red every ~0.6 seconds.
    *   Adjust the Auto-Save minutes input and confirm changes persist after a reload (storage is in `localStorage`), with the value clamped to ≥0.25 minutes.
    *   Drag the zoom slider and confirm the percentage label updates; panning/zooming should not interfere with the header bar.

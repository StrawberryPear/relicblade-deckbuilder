
  // newDeckEle.addEventListener("click", async (event) => {
  //   document.body.className = 'loading';
  //   const value = await showConfirm("If your current deck is unsaved, it will be lost. Are you sure you want to create a new deck?");
  //   await awaitTime(200);
  //   if (!value) return;
  //   overlayMenuEle.classList.add("hidden");
  //   storage.setStoredDeck("", []);
  //   loadDeckFromLocal();
  //   document.body.className = '';
  // });

    saveReturnEle.addEventListener("click", event => {
      overlayMenuEle.setAttribute("showing", "hamMenu");
    });
  
    saveDeckEle.addEventListener("click", event => {
      overlayMenuEle.setAttribute("showing", "savesMenu");
      overlayMenuEle.setAttribute("saveMode", "save");
    });
  
    loadDeckEle.addEventListener("click", event => {
      overlayMenuEle.setAttribute("showing", "savesMenu");
      overlayMenuEle.setAttribute("saveMode", "load");
    });
  
    document.querySelector('.newShare')?.addEventListener('click', async () => {
      overlayMenuEle.classList.add("hidden");
      const rawCode = await showInput("Enter the share code", { acceptText: "Enter Code" });
      if (!rawCode) return;
      const codeSeparated = rawCode.split("=");
      const code = codeSeparated[codeSeparated.length - 1];
      await loadShareDeckFromCode(code);
    });
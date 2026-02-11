
import { init as initStorage, storage } from './storage.js';
import { getCardStore } from './store.web.js';
import { initTokens } from './tokens.js';
import { awaitFrame, awaitTime, getSId } from './utils.js';
import { isModalShowing, init as initModal, showConfirm } from './dom.modal.js';
import { cardsStore, showToast } from './cards.shared.js';
import {
  initDeckEvents,
  loadDeckFromLocal,
  scrollDeckScroller,
  onShowDeck,
  cardDeckListEle,
  applyDeckCardTopScroll,
  deckName,
  deck
} from './deck.js';
import {
  initLibraryEvents,
  loadCard,
  applyFilters,
  applyCarousel,
  scrollLibraryScroller,
  onShowLibrary,
  filters
} from './library.js';
import {
  initMenuEvents,
  overlayMenuEle,
  isShareCodeFormat,
  getDeckFromShareCode,
  placeDeckFromShareCodeIntoLocal,
  loadShareDeckFromCode
} from './menu.js';
import { initMainMenuEvents, showMainMenu } from './mainMenu.js';

const triggerReload = async () => {
  console.log('assessing reload?')
  const doc = document.documentElement;
  const currentScreenWidth = doc.style.getPropertyValue('--screen-width');
  console.log(`sw: ${currentScreenWidth} vs ${window.innerWidth}px`);

  if (currentScreenWidth == `${window.innerWidth}px`) return;

  while (document.body.className == 'loading') {
    await awaitFrame();
  }

  await awaitFrame();
  window.location.reload();
};

const onAppFocus = async (event) => {
  try {
  } catch (e) {
  }
}

const updateAppSize = async (event) => {
  const isLandscape = window.innerWidth > window.innerHeight;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  try {
    if (isLandscape) {
      await Capacitor.Plugins.StatusBar.hide();
      await Capacitor.Plugins.NavigationBar.hide();
    } else {
      await Capacitor.Plugins.StatusBar.show();
      await Capacitor.Plugins.NavigationBar.show();
    }
  }
  catch (e) {
    console.error("Capacitor failed to initialize", e);
  }

  await awaitFrame();

  const doc = document.documentElement;
  const currentScreenWidth = doc.style.getPropertyValue('--screen-width');

  try {
    var { insets } = await Capacitor.Plugins.SafeArea.getSafeAreaInsets();
    var isAndroid = Capacitor?.getPlatform() == 'android';
  } finally {
    if (!insets || isAndroid) {
      doc.style.setProperty('--safe-area-top', `0px`);
      doc.style.setProperty('--safe-area-bottom', `0px`);
      doc.style.setProperty('--screen-height', `${screenHeight}px`);
      doc.style.setProperty('--screen-width', `${screenWidth}px`);
      doc.style.setProperty('--screen-width-raw', `${screenWidth}`);
      return;
    }
  }

  if (window.innerWidth > window.innerHeight) {
    doc.style.setProperty('--safe-area-top', `0px`);
    doc.style.setProperty('--safe-area-bottom', `0px`);
    doc.style.setProperty('--screen-height', `${screenHeight}px`);
    doc.style.setProperty('--screen-width', `${screenWidth}px`);
    doc.style.setProperty('--screen-width-raw', `${screenWidth}`);
    return;
  }

  console.log(`safe area`, JSON.stringify(insets));
  const safeTop = insets.top ?? 0;
  const safeBottom = insets.bottom ?? 0;
  const safeAreaHeight = screenHeight - safeTop - safeBottom;

  doc.style.setProperty('--safe-area-top', `${safeTop}px`);
  doc.style.setProperty('--safe-area-bottom', `${safeBottom}px`);
  doc.style.setProperty('--screen-width', `${screenWidth}px`);
  doc.style.setProperty('--screen-height', `${safeAreaHeight}px`);
};

const onResize = async (event) => {
  await updateAppSize();

  const characterCardEles = [...cardDeckListEle.querySelectorAll('cardDeckWrapper > card')];

  for (const characterCardEle of characterCardEles) {
    applyDeckCardTopScroll(characterCardEle, 0, 0);
  }
}

const init = async () => {
  await initStorage();

  document.body.setAttribute("displayType", storage.getStoredDisplayType() || "");
  document.body.setAttribute("listType", storage.getStoredListType() || "");

  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    return false;
  });

  document.body.setAttribute("data-long-press-delay", 450);
  document.body.addEventListener("long-press", (event) => {
    event.preventDefault();
    awaitFrame().then(() => {
      document.body.click();
    });
    return false;
  });

  try {
    Capacitor.Plugins.App.addListener("backButton", (event) => {
      if (overlayMenuEle.className != "hidden") {
        if (overlayMenuEle.getAttribute("showing") != "hamMenu") {
          overlayMenuEle.setAttribute("showing", "hamMenu");
          return;
        }
        overlayMenuEle.className = 'hidden';
        return;
      }
      if (isModalShowing()) return;

      const isLibrary = document.body.getAttribute("showing") == "library";
      if (isLibrary) {
        onShowDeck();
        return;
      }
      Capacitor.Plugins.App.exitApp();
      return;
    });
  } catch (e) { }

  try {
    const handleURLLoadAttempt = async (event) => {
      console.log(`hit here?, ${JSON.stringify(event)}`);
      const url = event.url;
      const urlParams = new URL(url);
      const searchParams = urlParams.searchParams;

      if (searchParams.has("id")) {
        const code = searchParams.get('id');
        if (!isShareCodeFormat(code)) return;

        const deckData = await getDeckFromShareCode(code);
        if (!deckData) return;

        const doLoad = await showConfirm(`Load, ${deckData.deckName || "shared deck"}? This will override any unsaved progress`);
        if (!doLoad) return;

        await placeDeckFromShareCodeIntoLocal(deckData);
        showToast(`${deckName || "Shared deck"} loaded`); // deckName imported from deck.js
      }
    }
    Capacitor.Plugins.App.addListener("appUrlOpen", async (event) => {
      document.body.className = 'loading';
      try {
        await handleURLLoadAttempt(event);
      } catch (e) { }
      document.body.className = '';
    });
  } catch (e) { };

  document.addEventListener("resume", triggerReload);
  window.addEventListener('resize', onResize);

  document.addEventListener("visibilitychange", () => {
    onAppFocus();
  })
  onResize();

  await storage.init();

  const cards = await storage.getAllCards();
  for (const card of cards) {
    loadCard(card);
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("id")) {
    try {
      await loadShareDeckFromCode(urlParams.get("id"));
    } catch (e) {
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Initial scrolling
  const deckCardContainerEles = [...document.querySelectorAll("cardDeckWrapper")]; // Need to query again as they are added by loadDeck?
  // loadDeckFromLocal calls updateDeck and addCharacterToDeck (which adds wrapper)
  // So querySelectorAll is synchronous and should find them.
  const deckCardOffsetSum = deckCardContainerEles.map(ele => ele.offsetLeft).reduce((s, v) => s + v, 0);
  const deckCardCenter = deckCardOffsetSum / (deckCardContainerEles.length || 1);
  const halfScreenWidth = window.innerWidth * 0.5;

  scrollLibraryScroller(0)
  scrollDeckScroller(deckCardCenter - halfScreenWidth);

  applyFilters();
  applyCarousel();

  document.body.className = '';

  initModal();
  initTokens();

  initDeckEvents();
  initLibraryEvents();
  initMenuEvents();
  initMainMenuEvents();

  showMainMenu();

  setTimeout(() => {
    onAppFocus();
  }, 1000);
};

init();
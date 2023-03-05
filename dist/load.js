const getCardLibraryPlacementBeforeEle = (placeCard) => {
  const libraryCardEles = [...cardLibraryListEle.children];

  const getCardSortWeighting = (cardEle) => {
    const cardUID = cardEle.getAttribute('uid');
    const cardStore = store[cardUID];

    if (!cardStore) return;

    // is character / summon adjacent
    const isSummonOrCharacter = !!cardStore.types.match(/(character|summon)/i);
    const isAdvocate = !!cardStore.factions.match(/advocate/i);
    const isAdversary = !!cardStore.factions.match(/adversary/i);
    const cardSet = cardUID.substr(0, cardUID.length - 4);

    const isUpgrade = !!cardStore.types.match(/upgrade/i);
    const isRelic = !!cardStore.types.match(/relic/i);

    const score = (() => {
      if (isSummonOrCharacter) {
        if (isAdvocate) {
          return 0;
        } 
        if (isAdversary) {
          return 1;
        }
        return 2;
      }
      if (isUpgrade) {
        return 3;
      }
      if (isRelic) {
        return 4;
      }
      return 5;
    })();

    return `${score}${cardSet}${cardStore}`
  }

  const placeCardWeighting = getCardSortWeighting(placeCard);

  for (const card of libraryCardEles) {
    const cardWeighting = getCardSortWeighting(card);

    if (placeCardWeighting < cardWeighting) {
      return card;
    }
  }
  return undefined;
};

const loadCardDataFromUrl = (() => {
  const loadingCanvas = document.createElement('canvas');

  const CARD_ROWS = 3;
  const CARD_COLS = 3;
  const CARD_PER_PAGE = CARD_ROWS * CARD_COLS;

  const CARD_ROW_OFFSET = 10;

  return async (url) => {
    var PDFJS = window['pdfjs-dist/build/pdf'];
    PDFJS.GlobalWorkerOptions.workerSrc = './pdf.worker.js';
    
    const cardImages = [];

    const loadingTask = PDFJS.getDocument(url);

    const getCanvasDataURL = (() => {
      const saveCanvas = document.createElement('canvas');

      return (originCanvas, x, y, w, h) => {
        saveCanvas.width = w;
        saveCanvas.height = h;

        const saveContext = saveCanvas.getContext('2d');

        saveContext.drawImage(originCanvas, x, y, w, h, 0, 0, w, h);

        // check if it has a border most of the way around, at least 90%.
        const imageData = saveContext.getImageData(0, 0, w, h);
        const pixelData = imageData.data;

        var blackCount = 0;

        const bottomOffset = (h - 1) * w * 4;
        const rightOffset = (w - 1) * 4;

        for (var xi = 0; xi < w; xi++) {
          const ri = xi * 4;
          const gi = xi * 4 + 1;
          const bi = xi * 4 + 2;

          const topPixel = pixelData[ri] + pixelData[gi] + pixelData[bi];
          const bottomPixel = pixelData[bottomOffset + ri] + pixelData[bottomOffset + gi] + pixelData[bottomOffset + bi];
          
          blackCount += topPixel + bottomPixel;
        }
        
        for (var yi = 0; yi < h; yi++) {
          const oi = yi * 4 * w;

          const ri = oi;
          const gi = oi + 1;
          const bi = oi + 2;

          const leftPixel = pixelData[ri] + pixelData[gi] + pixelData[bi];
          const rightPixel = pixelData[rightOffset + ri] + pixelData[rightOffset + gi] + pixelData[rightOffset + bi];

          blackCount += leftPixel + rightPixel;
        }
        
        const MAX_PIXEL_VALUE = (w * 2 + h * 2) * 3 * 255;

        if (blackCount > MAX_PIXEL_VALUE * 0.05) {
          return '';
        }

        return saveCanvas.toDataURL();
      }
    })();

    const pdf = await loadingTask.promise;
    const metaData = await pdf.getMetadata();

    var totalPages = pdf.numPages
    var data = [];

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      
      const text = await page.getTextContent();

      var viewport = page.getViewport({ scale: SCALE });

      // Prepare canvas using PDF page dimensions
      var context = loadingCanvas.getContext('2d');
      loadingCanvas.height = viewport.height;
      loadingCanvas.width = viewport.width;

      // Render PDF page into canvas context
      var renderContext = { canvasContext: context, viewport: viewport };

      const render = await page.render(renderContext).promise;

      [...Array(CARD_PER_PAGE)].map((_, i) => {
        const r = Math.floor(i / CARD_COLS);
        const c = i % CARD_COLS;

        const x = CARD_OFFSET_X + CARD_WIDTH * c;
        const y = CARD_OFFSET_Y + CARD_HEIGHT * r + CARD_ROW_OFFSET * r;

        cardImages.push(getCanvasDataURL(loadingCanvas, x, y, CARD_WIDTH, CARD_HEIGHT));
      });
    }

    return [cardImages, metaData.info.Title];
  }
})();

const loadCardsFromUrl = async (url) => {
  const [images, title] = await loadCardDataFromUrl(url);

  var cardsLoaded = 0;

  for (const imageIndex in images) {
    const image = images[imageIndex];

    if (image.length < 8064) continue;

    await addCardToDatabase(image, `${title} - ${cardsLoaded}`);
  
    cardsLoaded++;
  }
  
  showToast(`${cardsLoaded} cards added to library`);
};

const loadCard = (card) => {
  const cardEle = document.createElement('card');

  cardEle.setAttribute('uid', card.uid);
  cardEle.setAttribute('index', card.index);

  // const cardStore = store[]
  // if (card. == "DELETE"

  // where should it be placed.
  const beforeEle = getCardLibraryPlacementBeforeEle(cardEle);

  if (beforeEle) {
    cardLibraryListEle.insertBefore(cardEle, beforeEle);
  } else {
    cardLibraryListEle.append(cardEle);
  }

  cardEle.style.setProperty('background-image', `url('${card.image}')`);
};

const addCardToDatabase = async (image, uid) => {
  const transaction = database.transaction('cards', 'readwrite');

  try {
    const objectStore = transaction.objectStore('cards');
    const storeId = await objectStore.add({uid, image});

    const result = await objectStore.get(storeId);

    loadCard(result);
    
    return true;
  } catch(err) {
    console.error(err);
    return false;
  }
};

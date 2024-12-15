
import { PDF_SCALE, PDF_CARD_WIDTH, PDF_CARD_HEIGHT, PDF_CARD_OFFSET_X, PDF_CARD_OFFSET_Y, PDF_CARD_ROW_OFFSET } from './constants.js';

const pageCanvas = document.createElement('canvas');
const saveCanvas = document.createElement('canvas');

let pdfjsLib;

export const loadCardDataFromUrl = (() => {
  const CARD_ROWS = 3;
  const CARD_COLS = 3;
  const CARD_PER_PAGE = CARD_ROWS * CARD_COLS;

  // cards progressively shift slightly down.
  const CARD_ROW_OFFSET = 10;

  return async (url) => {
    if (!pdfjsLib) {
      pdfjsLib = globalThis.pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf/pdf.worker.mjs';
    }
    
    const cardImages = [];

    const loadingTask = pdfjsLib.getDocument(url);
    
    const getCanvasDataURL = (() => {
      return async (originCanvas, originPixelData, x, y, w, h) => {
        saveCanvas.width = w;
        saveCanvas.height = h;

        const getPixelIsBlack = (xi, yi) => {
          const ri = (y + yi) * originCanvas.width * 4 + (x + xi) * 4;
          const gi = ri + 1;
          const bi = ri + 2;
    
          return (originPixelData[ri] + originPixelData[gi] + originPixelData[bi]) < 15;
        }

        var blackCount = 0;

        for (var xo = 0; xo < w; xo++) {
          blackCount += (getPixelIsBlack(xo, 5) ? 1 : 0) + (getPixelIsBlack(xo, h - 6));
        }
        
        for (var yo = 0; yo < h; yo++) {
          blackCount += (getPixelIsBlack(5, yo) ? 1 : 0) + (getPixelIsBlack(w - 6, yo));
        }
        
        if (blackCount < (w * 2 + h * 2) * 0.75) {
          return '';
        }

        const saveContext = saveCanvas.getContext('2d', { willReadFrequently: true });

        saveContext.drawImage(originCanvas, x, y, w, h, 0, 0, w, h);

        return saveCanvas.toDataURL('image/jpeg', 0.86);
      }
    })();

    const pdf = await loadingTask.promise;
    const metaData = await pdf.getMetadata();
    debugger;

    var totalPages = pdf.numPages;

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
    
      var viewport = page.getViewport({ scale: PDF_SCALE });

      // Prepare canvas using PDF page dimensions
      var context = pageCanvas.getContext('2d');
      pageCanvas.height = viewport.height;
      pageCanvas.width = viewport.width;

      // Render PDF page into canvas context
      var renderContext = { canvasContext: context, viewport: viewport };

      const pageRenderResult = await page.render(renderContext).promise;
      // check if it has a border most of the way around, at least 90%.
      const pageImageData = context.getImageData(0, 0, pageCanvas.width, pageCanvas.height);
      const pagePixelData = pageImageData.data;

      for (let i = 0; i < CARD_PER_PAGE; i++) {
        const r = Math.floor(i / CARD_COLS);
        const c = i % CARD_COLS;

        const x = PDF_CARD_OFFSET_X + PDF_CARD_WIDTH * c;
        const y = PDF_CARD_OFFSET_Y + PDF_CARD_HEIGHT * r + CARD_ROW_OFFSET * r;

        const imageUrl = await getCanvasDataURL(pageCanvas, pagePixelData, x, y, PDF_CARD_WIDTH, PDF_CARD_HEIGHT);

        await new Promise(resolve => window.requestAnimationFrame(resolve));

        cardImages.push(imageUrl);
      }
    }

    return [cardImages, metaData.info.Title];
  }
})();

export const loadCardsFromUrl = async (url) => {
  const [images, title] = await loadCardDataFromUrl(url);

  const pdfCards = [];
  
  let nonJunkIndex = 0;

  for (const imageIndex in images) {
    const image = images[imageIndex];

    if (image.length < 8064) continue;

    pdfCards.push({image, id: `${title} - ${nonJunkIndex}`});

    nonJunkIndex++;
  }

  return pdfCards;
};

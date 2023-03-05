const carouselEle = document.querySelector("cardCarousel");
const carouselCanvasEle = document.querySelector('cardCarousel canvas');

const updateCarousel = () => {
  // rerender the whole thing with index being the selected element, so render that one last.
  if (!cardLibraryListEle.clientWidth) return;

  const scrollPadding = cardScrollerEle.clientWidth * 0.5;
  const scrollScalar = (cardScrollerEle.scrollLeft) / (cardLibraryListEle.clientWidth - scrollPadding * 2);

  const libraryCardEles = [...cardLibraryListEle.children].filter(e => !e.classList.contains('inactive'));
  const count = libraryCardEles.length;

  const cardDrawWidth = (CARD_WIDTH / CARD_HEIGHT) * carouselCanvasEle.height;
  const drawWidth = carouselCanvasEle.width - cardDrawWidth;
  const drawOffsetX = cardDrawWidth * 0.5;

  // 1, center - 3
  // 2, 25%, 75% - 4
  // 3, 25%, 50%, 75% - 5
  const intervalWidth = drawWidth / (count + 1);

  const context = carouselCanvasEle.getContext('2d');
  // black out the carousel
  context.clearRect(0, 0, carouselCanvasEle.width, carouselCanvasEle.height);
  
  context.strokeStyle = `#000b`;
  context.lineWidth = count > 50 ? 1 : 2;

  const linePaddin = 4;

  // render lines at each width;
  for (var i = 0; i < count; i++) {
    const x = drawOffsetX + intervalWidth * (i + 1);

    context.beginPath();
    context.moveTo(x, linePaddin);
    context.lineTo(x, carouselCanvasEle.height - linePaddin);
    context.stroke();
  }

  const viewWidth = drawWidth - intervalWidth;
  const viewX = drawOffsetX + viewWidth * scrollScalar - cardDrawWidth * 0.5 + intervalWidth * 0.5;

  // current scroll 
  context.strokeStyle = `#102f34`;
  context.fillStyle = "#000b";
  context.lineWidth = 2;
  context.beginPath();
  context.rect(viewX, 0, cardDrawWidth, carouselCanvasEle.height);
  context.fill();
  context.stroke();
}

const applyCarousel = () => {
  // get the filtered card count
  const containerRect = carouselEle.getBoundingClientRect();

  carouselCanvasEle.width = containerRect.width - 32;
  carouselCanvasEle.height = containerRect.height - 6;

  updateCarousel();
}
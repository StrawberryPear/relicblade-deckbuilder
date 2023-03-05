/*
  <cardTabControls>
    <cardControl class="editing end"></cardControl>

    <cardControl class="deck edit"></cardControl>
    <cardControl class="deck erase"></cardControl>

    <cardControl class="deck shiftUp"></cardControl>
    <cardControl class="deck shiftDown"></cardControl>
  </cardTabControls>
*/
const handleEdit = () => {
  document.body.className = 'editing';
  
  const currentCardEle = getCurrentCardEle();
  if (!currentCardEle) return;

  var canvasEle = currentCardEle.querySelector('canvas');
  if (canvasEle) return;

  canvasEle = document.createElement('canvas');

  canvasEle.width = CARD_WIDTH;
  canvasEle.height = CARD_HEIGHT;
  
  currentCardEle.append(canvasEle);

  const canvasBoundingBox = canvasEle.getBoundingClientRect();

  const canvasContext = canvasEle.getContext('2d');

  var cx = 0;
  var cy = 0;

  var lineWidth = 8;
  var color = '#000000';

  const getXY = (e) => {
    const rx = (e.touches[0].clientX - canvasBoundingBox.left) * CARD_WIDTH / canvasBoundingBox.width;
    const ry = (e.touches[0].clientY - canvasBoundingBox.top) * CARD_HEIGHT / canvasBoundingBox.height;

    return [rx, ry];
  };

  const drawTo = (nx, ny) => {
    const drawType = document.body.getAttribute('drawType');

    if (drawType == 'erase') {
      canvasContext.save();
      canvasContext.globalCompositeOperation = 'destination-out';
      canvasContext.beginPath();
      canvasContext.arc(nx, ny, lineWidth, 0, 2 * Math.PI);
      canvasContext.fillStyle = color;
      canvasContext.fill();
      canvasContext.closePath();
      canvasContext.restore();
    } else {
      canvasContext.beginPath();
      canvasContext.arc(nx, ny, lineWidth, 0, 2 * Math.PI);
      canvasContext.fillStyle = color;
      canvasContext.fill();
      canvasContext.closePath();
    }

    [cx, cy] = [nx, ny];
  };

  canvasEle.addEventListener('touchmove', function (e) {
    const [nx, ny] = getXY(e);

    drawTo(nx, ny);

    e.preventDefault();
  }, false);
  canvasEle.addEventListener('touchstart', function (e) {
    [cx, cy] = getXY(e);

    drawTo(cx, cy);

    e.preventDefault();
  }, false);
  canvasEle.addEventListener('touchend', function (e) {
    e.preventDefault();
  }, false);
  canvasEle.addEventListener('touchcancel', function (e) {
    const [nx, ny] = getXY(e);

    drawTo(nx, ny);

    e.preventDefault();
  }, false);
};

document.querySelector('cardControl.edit').addEventListener('click', () => {
  document.body.setAttribute('drawType', 'draw');

  handleEdit();
});

document.querySelector('cardControl.erase').addEventListener('click', () => {
  document.body.setAttribute('drawType', 'erase');

  handleEdit();
});

document.querySelector('cardControl.end').addEventListener('click', () => {
  document.body.className = '';
});

document.querySelector('cardControl.shiftUp').addEventListener('click', () => {
  const currentCardEle = getCurrentCardEle();
  if (!currentCardEle) return;

  const previousCardEle = currentCardEle.previousElementSibling;
  if (!previousCardEle) return;

  const currentCardIndex = [...cardDeckListEle.children].indexOf(currentCardEle);
  const previousCardIndex = currentCardIndex - 1;

  deck[currentCardIndex] = previousCardEle.getAttribute('uid');
  deck[previousCardIndex] = currentCardEle.getAttribute('uid');

  localStorage.setItem('deck', deck);
  
  cardDeckListEle.insertBefore(currentCardEle, previousCardEle);
});
document.querySelector('cardControl.shiftDown').addEventListener('click', () => {
  const currentCardEle = getCurrentCardEle();
  if (!currentCardEle) return;

  const nextCardEle = currentCardEle.nextElementSibling;
  if (!nextCardEle) return;

  const currentCardIndex = [...cardDeckListEle.children].indexOf(currentCardEle);
  const nextCardIndex = currentCardIndex + 1;

  deck[currentCardIndex] = nextCardEle.getAttribute('uid');
  deck[nextCardIndex] = currentCardEle.getAttribute('uid');

  localStorage.setItem('deck', deck);
  
  cardDeckListEle.insertBefore(nextCardEle, currentCardEle);
});
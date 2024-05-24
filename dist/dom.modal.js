import { awaitFrame, awaitTime } from './utils.js';

var CARD_WIDTH = 250;
var CARD_HEIGHT = 350;

const modalCardEle = document.querySelector('modalOverlay card');

const modalEle = document.querySelector('modal');
const modalOverlayEle = document.querySelector("modalOverlay");
const modalOverlayTextEle = modalOverlayEle.querySelector("modalText");
const modalOverlayReturnButtonEle = modalOverlayEle.querySelector("modalButton#modalReturn");
const modalOverlayAcceptButtonEle = modalOverlayEle.querySelector("modalButton#modalAccept");

const interactCardOptions = {};

const _cardEleBoundingRect = modalCardEle.getBoundingClientRect();
CARD_WIDTH = _cardEleBoundingRect.width / 1.5;
CARD_HEIGHT = _cardEleBoundingRect.height / 1.5;


const reinitializeModal = async ({acceptText, returnText} = {}) => {
  modalOverlayAcceptButtonEle.innerHTML = acceptText || "Accept";
  modalOverlayReturnButtonEle.innerHTML = returnText || "Return";

  // flash the modal
  modalEle.style.setProperty("opacity", "0");

  const timeStart = Date.now();

  const fadeInDuration = 400;

  while (Date.now() - timeStart < fadeInDuration) {
    const delta = (Date.now() - timeStart) / fadeInDuration;

    modalEle.style.setProperty("opacity", `${delta}`);

    await awaitFrame();
  }

  modalEle.style.setProperty("opacity", "1");
};
export const isModalShowing = () =>{ 
  return !modalOverlayEle.classList.contains("hidden");
}
export const showInteractCard = async (cardEle, options = {}) => {
  // we don't clone the card element, we have an element sitting around just for this
  // we do move it to be exactly where the card element would be.
  
  const currentCardBounds = cardEle.getBoundingClientRect();

  const cx = currentCardBounds.left + currentCardBounds.width * 0.5;
  const cy = currentCardBounds.top + currentCardBounds.height * 0.5;

  const cw = currentCardBounds.width;
  const ch = currentCardBounds.height;

  const csx = cw / CARD_WIDTH;
  const csy = ch / CARD_HEIGHT;

  interactCardOptions.cx = cx;
  interactCardOptions.cy = cy;
  interactCardOptions.csx = csx;
  interactCardOptions.csy = csy;

  modalCardEle.style.setProperty("transition", "none");
  modalCardEle.style.setProperty("transform", `translate(-50%, -50%) translate(${cx}px, ${cy}px) scale(${csx}, ${csy})`);
  
  modalCardEle.style.setProperty("opacity", "0");
  modalCardEle.style.setProperty("background-image", cardEle.style.getPropertyValue("background-image"));

  await awaitFrame();

  modalCardEle.style.setProperty("opacity", "1");
  modalCardEle.style.setProperty("transition", `opacity 200ms, transform 300ms ease-in-out`);

  await awaitFrame();

  modalCardEle.style.setProperty("transform", ``);
};
export const hideInteractCard = async (doReturn) => {
  if (doReturn) {
    modalCardEle.style.setProperty("transition", `opacity 200ms 100ms, transform 300ms ease-in-out`);
    modalCardEle.style.setProperty("transform", `translate(-50%, -50%) translate(${interactCardOptions.cx}px, ${interactCardOptions.cy}px) scale(${interactCardOptions.csx}, ${interactCardOptions.csy})`);
  }
  modalCardEle.style.setProperty("opacity", "0");
}
export const showConfirm = async (content, options = {}) => {
  reinitializeModal(options);
  // hide the background 
  modalOverlayEle.classList.remove("hidden");

  // change the text, return true if they hit true/false false. 
  modalOverlayTextEle.innerHTML = content;

  const returnValue = await new Promise((resolve, reject) => {
    const onFinished = (event) => {
      // remove the button binds.
      // unbind the buttons.
      const id = event.target.getAttribute("id");

      modalOverlayAcceptButtonEle.removeEventListener("click", onFinished);
      modalOverlayReturnButtonEle.removeEventListener("click", onFinished);

      resolve(id == "modalAccept");
    };
  
    modalOverlayAcceptButtonEle.addEventListener("click", onFinished);
    modalOverlayReturnButtonEle.addEventListener("click", onFinished);
  });

  // hide the overlay
  modalOverlayEle.classList.add("hidden");

  return returnValue;
};
export const showInput = async (content, options = {}) => {
  reinitializeModal(options);
  // hide the background 
  modalOverlayEle.classList.remove("hidden");

  // change the text, return true if they hit true/false false. 
  modalOverlayTextEle.innerHTML = content;

  // attach events to the text input

  const input = document.createElement("input");
  input.type = "text";
  input.id = "modalInput";

  input.addEventListener("keyup", (event) => {
    if (event.keyCode === 13) {
      modalOverlayAcceptButtonEle.click();

      return;
    }
  });

  modalOverlayTextEle.append(input);

  if (options.dataList) {
    const datalistEle = document.createElement("datalist");
    datalistEle.id = "modalDatalist";

    for (const data of options.dataList) {
      const optionEle = document.createElement("option");
      optionEle.value = data;

      datalistEle.append(optionEle);
    }

    input.setAttribute("list", "modalDatalist");
    modalOverlayTextEle.append(datalistEle);
  }

  input.focus();

  const returnValue = await new Promise((resolve, reject) => {
    const onFinished = (event) => {
      // remove the button binds.
      // unbind the buttons.
      const id = event.target.getAttribute("id");

      modalOverlayAcceptButtonEle.removeEventListener("click", onFinished);
      modalOverlayReturnButtonEle.removeEventListener("click", onFinished);

      resolve(id == "modalAccept" && document.getElementById("modalInput").value);
    };
  
    modalOverlayAcceptButtonEle.addEventListener("click", onFinished);
    modalOverlayReturnButtonEle.addEventListener("click", onFinished);
  });

  // hide the overlay
  modalOverlayEle.classList.add("hidden");

  return returnValue;
};
export const showOption = async (content, options) => {
  reinitializeModal(options);
  // hide the background 
  modalOverlayEle.classList.remove("hidden");
  modalOverlayEle.classList.add("option");

  // change the text, return true if they hit true/false false. 
  modalOverlayTextEle.innerHTML = content;

  // attach events to the text input

  const returnValue = await new Promise((resolve, reject) => {
    const onFinished = (event) => {
      // remove the button binds.
      // unbind the buttons.
      const id = event.target.getAttribute("id");

      modalOverlayReturnButtonEle.removeEventListener("click", onFinished);

      resolve(id == "modalReturn" ? false : event.target.innerHTML);
    };
  
    for (const option of options) {
      const optionButton = document.createElement("modalButton");
      optionButton.innerHTML = option;
      optionButton.classList.add("fullwidth");

      optionButton.addEventListener("click", onFinished);
  
      modalOverlayTextEle.append(optionButton);
    }
    
    modalOverlayReturnButtonEle.addEventListener("click", onFinished);
  });

  // hide the overlay
  modalOverlayEle.classList.add("hidden");

  awaitTime(350).then(() => {
    modalOverlayEle.classList.remove("option");
  });

  return returnValue;
}
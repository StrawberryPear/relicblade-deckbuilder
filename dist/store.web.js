// check to see if we can get the store from gungob.com

export const getCardStore = async () => {
  // fetch it from gungob
  const url = "https://gungob.com/decks/store.json";

  try {
    const response = await fetch(url);

    if (!response.ok) {
      // get the local
      throw "Failed to load from Host";
    }

    const value = response.json();

    return value;
  } finally {
    return (await import("./store.js")).default;
  }
}
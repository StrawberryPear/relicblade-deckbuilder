// check to see if we can get the store from gungob.com

export const getCardStore = async () => {
  // fetch it from gungob
  const url = "https://gungob.com/decks/store.json";

  try {
    console.log("Attempting to get online store");

    if (window.location.href.includes("localhost")) {
      // don't load the url;
      throw "Not loading it from gungob";
    }
    
    const storeRequestOptions = { url };
    const response = await Capacitor.Plugins.CapacitorHttp.get(storeRequestOptions);

    if (response.status != 200) {
      // get the local
      throw "Failed to load from Host";
    }

    if (typeof(response.data) == "string") {
      const value = JSON.parse(response.data);

      return value;
    }

    return response.data;
  } catch (e) {
    console.log("error getting online store");
    console.log(e);

    console.log("using fallback store");
    const fallbackResponse = await fetch("./store.json");
    return await fallbackResponse.json();
  } 
}
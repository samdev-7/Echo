const { Recognizer, Model } = require("vosk");

console.info("Loading Vosk model...");
const model = new Model("models/vosk-model-en-us-0.22");
console.info("Vosk model loaded.");

// const transcriber = new Recognizer({
//   model: model,
//   sampleRate: 48000, //Discord uses 48KHz
// });

const transcribers = new Map();

async function createTranscriber(userId) {
  if (!transcribers.has(userId)) {
    console.log("Creating transcriber for user: ", userId);
    transcribers.set(
      userId,
      new Recognizer({ model: model, sampleRate: 48000 })
    );
  }
}

async function destroyTranscriber(userId) {
  if (transcribers.has(userId)) {
    console.log("Destroying transcriber for user: ", userId);
    transcribers.delete(userId);
  }
}

async function transcribe(
  userId,
  buffer
  // get_partial = false,
  // get_final = false
) {
  if (!transcribers.has(userId)) {
    await createTranscriber(userId);
  }
  transcriber = transcribers.get(userId);

  transcriber.acceptWaveform(buffer);
  // let result = "";

  // if (get_partial) {
  //   const partial = transcriber.partialResult();
  //   console.log("Partial:", partial.text);
  //   result = partial.text;
  // }
  // if (get_final) {
  //   const finalResult = transcriber.finalResult();
  //   console.log("Final:", finalResult);
  //   result = finalResult.text;
  // }
  // return result;
}

async function get_partial(userId) {
  if (!transcribers.has(userId)) {
    return false;
  }
  transcriber = transcribers.get(userId);
  const partial = transcriber.partialResult();
  return partial.partial;
}

async function get_final(userId) {
  if (!transcribers.has(userId)) {
    return false;
  }
  transcriber = transcribers.get(userId);
  const final = transcriber.finalResult();
  return final.text;
}

module.exports = {
  transcribe,
  get_partial,
  get_final,
  transcribers,
  destroyTranscriber,
};

// Where the piece actually sits inside each 4:5 cut-out frame: [top, bottom] as fractions of frame height.
// Measured from the alpha channel of every catalogued photo with a height (tools/bounds.js). Most frames are
// normalised to [.051, .951]; the wide pieces are fitted by width and sit much smaller in their frame.
const ODD = { hookah25: [.122, .88], hookah36: [.051, .944], hookah46: [.104, .898], hookah50: [.051, .936], hookah51: [.073, .929],
  hookah57: [.051, .944], hookah65: [.051, .947], hookah77: [.073, .927], hookah89: [.209, .791], hookah92: [.322, .678], hookah93: [.109, .893] };
export const bounds = img => ODD[img] || [.051, .951];
export const imgName = src => (src.match(/\/pc\/([^/?]+?)(?:-[sml])?\.webp/) || [])[1];

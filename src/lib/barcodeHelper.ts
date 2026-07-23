const CODE39_MAP: Record<string, string> = {
  "0": "101001101101",
  "1": "110100101011",
  "2": "101100101011",
  "3": "110110010101",
  "4": "101001101011",
  "5": "110100110101",
  "6": "101100110101",
  "7": "101001011011",
  "8": "110100101101",
  "9": "101100101101",
  "A": "110101001011",
  "B": "101101001011",
  "C": "110110100101",
  "D": "101011001011",
  "E": "110101100101",
  "F": "101101100101",
  "G": "101010011011",
  "H": "110101001101",
  "I": "101101001101",
  "J": "101011001101",
  "K": "110101010011",
  "L": "101101010011",
  "M": "110110101001",
  "N": "101011010011",
  "O": "110101101001",
  "P": "101101101001",
  "Q": "101010110011",
  "R": "110101011001",
  "S": "101101011001",
  "T": "101011011001",
  "U": "110010101011",
  "V": "100110101011",
  "W": "110011010101",
  "X": "100101101011",
  "Y": "110010110101",
  "Z": "100110110101",
  "-": "100101011011",
  ".": "110010101101",
  " ": "100110101101",
  "*": "100101101101",
  "$": "100100100101",
  "/": "100100101001",
  "+": "100101001001",
  "%": "100100100101"
};

export function getBarcodeSvgString(rawVal: string, width = 0.8, height = 30): string {
  let val = rawVal || "";
  if (val.length > 8 && !val.startsWith("FX")) {
    val = val.slice(-6);
  }
  const cleanVal = val.toUpperCase().split("").filter(char => char in CODE39_MAP).join("");
  if (!cleanVal) return "<div style='color:red; font-size:10px;'>Invalid</div>";

  const encodedText = `*${cleanVal}*`;
  let binaryBars = "";
  for (let i = 0; i < encodedText.length; i++) {
    const char = encodedText[i];
    binaryBars += CODE39_MAP[char] + "0";
  }

  const svgWidth = binaryBars.length * width;
  let rectsHtml = "";
  binaryBars.split("").forEach((bit, idx) => {
    if (bit === "1") {
      rectsHtml += `<rect x="${idx * width}" y="0" width="${width}" height="${height}" fill="#000000" />`;
    }
  });

  return `
    <svg width="${svgWidth}" height="${height}" viewBox="0 0 ${svgWidth} ${height}" style="display:block; margin:0 auto;">
      ${rectsHtml}
    </svg>
  `;
}

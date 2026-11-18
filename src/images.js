import { InputError, limits } from "./model.js";

function jpegSize(bytes, view) {
  if (view.getUint16(0) !== 0xffd8) return null;
  const supported = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  for (let at = 2; at + 8 < bytes.length;) {
    if (bytes[at++] !== 0xff) return null;
    while (at < bytes.length && bytes[at] === 0xff) at++;
    const marker = bytes[at++];
    if (at + 7 >= bytes.length) break;
    const size = view.getUint16(at);
    if (size < 2 || at + size > bytes.length) break;
    if (supported.has(marker)) return [view.getUint16(at+5),view.getUint16(at+3)];
    if (marker === 0xda) break;
    at += size;
  }
  return null;
}

export function decodeImage(image) {
  const [header,base] = image.data.split(",");
  const type = header.startsWith("data:image/png;") ? "png" : "jpg";
  let bytes;
  try {
    bytes = Uint8Array.from(atob(base), (char) => char.charCodeAt(0));
  } catch {
    throw new InputError("圖片編碼有誤，請重新上傳。");
  }
  if (bytes.length < 24 || bytes.length > limits.imageBytes) throw new InputError("圖片大小超出支援範圍。");
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let size;
  if (type === "png" && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a && view.getUint32(12) === 0x49484452) {
    size = [view.getUint32(16),view.getUint32(20)];
  } else if (type === "jpg") {
    size = jpegSize(bytes,view);
  }
  if (!size || size[0] !== image.width || size[1] !== image.height || !size[0] || !size[1] || Math.max(...size) > limits.imageEdge) {
    throw new InputError("圖片的檔案內容與尺寸資料不一致，請重新上傳。");
  }
  return {type,bytes};
}

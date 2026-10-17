/* ============================================================
 * 纯 JavaScript ZIP 打包器（store 模式，无压缩依赖）
 * 支持中文文件名（UTF-8 标志位），生成 Blob 供下载。
 * ============================================================ */
(function () {
  'use strict';

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(buf) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function strToU8(str) {
    return new TextEncoder().encode(str);
  }

  /* files: [{ name: 'a/b.png', data: Uint8Array|ArrayBuffer }] */
  function makeZip(files) {
    var chunks = [];
    var central = [];
    var offset = 0;

    files.forEach(function (f) {
      var nameBytes = strToU8(f.name);
      var data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
      var crc = crc32(data);
      var size = data.length;

      // ---- 本地文件头 ----
      var lh = new Uint8Array(30 + nameBytes.length);
      var dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);          // local header sig
      dv.setUint16(4, 20, true);                  // version needed
      dv.setUint16(6, 0x0800, true);              // UTF-8 标志
      dv.setUint16(8, 0, true);                   // store
      dv.setUint16(10, 0, true);                  // time
      dv.setUint16(12, 0, true);                  // date
      dv.setUint32(14, crc, true);
      dv.setUint32(18, size, true);
      dv.setUint32(22, size, true);
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true);                  // extra len
      lh.set(nameBytes, 30);
      chunks.push(lh, data);

      // ---- 中央目录记录 ----
      var cd = new Uint8Array(46 + nameBytes.length);
      var dv2 = new DataView(cd.buffer);
      dv2.setUint32(0, 0x02014b50, true);
      dv2.setUint16(4, 20, true);
      dv2.setUint16(6, 20, true);
      dv2.setUint16(8, 0x0800, true);
      dv2.setUint16(10, 0, true);
      dv2.setUint16(12, 0, true);
      dv2.setUint16(14, 0, true);
      dv2.setUint32(16, crc, true);
      dv2.setUint32(20, size, true);
      dv2.setUint32(24, size, true);
      dv2.setUint16(28, nameBytes.length, true);
      dv2.setUint32(42, offset, true);
      cd.set(nameBytes, 46);
      central.push(cd);

      offset += lh.length + size;
    });

    var cdSize = central.reduce(function (s, c) { return s + c.length; }, 0);
    var end = new Uint8Array(22);
    var dv3 = new DataView(end.buffer);
    dv3.setUint32(0, 0x06054b50, true);
    dv3.setUint16(8, files.length, true);
    dv3.setUint16(10, files.length, true);
    dv3.setUint32(12, cdSize, true);
    dv3.setUint32(16, offset, true);

    return new Blob(chunks.concat(central, [end]), { type: 'application/zip' });
  }

  window.ZipKit = { makeZip: makeZip, crc32: crc32 };
})();

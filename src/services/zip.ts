/**
 * Minimales ZIP ohne Abhängigkeit: Dateien werden ungepackt abgelegt (Methode 0). Der Jahresabschluss enthält
 * CSV und Belegbilder; die Bilder sind als WebP oder JPEG schon komprimiert, Deflate brächte fast nichts.
 */

export interface ZipFile {
  /** Pfad im Archiv, «/» als Trenner */
  name: string
  data: Uint8Array
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++)
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let c = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++)
    c = CRC_TABLE[(c ^ data[i]!) & 0xFF]! ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

/** Zeit und Datum im DOS-Format; alle Einträge tragen denselben Zeitstempel */
function dosTime(date: Date): { time: number, date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2)),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

class Writer {
  private parts: Uint8Array[] = []
  length = 0

  push(part: Uint8Array): void {
    this.parts.push(part)
    this.length += part.length
  }

  u16(value: number): void {
    this.push(new Uint8Array([value & 0xFF, (value >> 8) & 0xFF]))
  }

  u32(value: number): void {
    this.push(new Uint8Array([value & 0xFF, (value >>> 8) & 0xFF, (value >>> 16) & 0xFF, (value >>> 24) & 0xFF]))
  }

  toUint8Array(): Uint8Array {
    const out = new Uint8Array(this.length)
    let offset = 0
    for (const part of this.parts) {
      out.set(part, offset)
      offset += part.length
    }
    return out
  }
}

export function createZip(files: ZipFile[], now: Date = new Date()): Uint8Array<ArrayBuffer> {
  const { time, date } = dosTime(now)
  const body = new Writer()
  const central = new Writer()
  const encoder = new TextEncoder()

  for (const file of files) {
    const name = encoder.encode(file.name)
    const crc = crc32(file.data)
    const offset = body.length

    body.u32(0x04034B50)
    body.u16(20) // Version
    body.u16(0x0800) // UTF-8-Dateinamen
    body.u16(0) // Methode 0: ungepackt
    body.u16(time)
    body.u16(date)
    body.u32(crc)
    body.u32(file.data.length)
    body.u32(file.data.length)
    body.u16(name.length)
    body.u16(0)
    body.push(name)
    body.push(file.data)

    central.u32(0x02014B50)
    central.u16(20)
    central.u16(20)
    central.u16(0x0800)
    central.u16(0)
    central.u16(time)
    central.u16(date)
    central.u32(crc)
    central.u32(file.data.length)
    central.u32(file.data.length)
    central.u16(name.length)
    central.u16(0)
    central.u16(0)
    central.u16(0)
    central.u16(0)
    central.u32(0)
    central.u32(offset)
    central.push(name)
  }

  const end = new Writer()
  end.u32(0x06054B50)
  end.u16(0)
  end.u16(0)
  end.u16(files.length)
  end.u16(files.length)
  end.u32(central.length)
  end.u32(body.length)
  end.u16(0)

  const out = new Uint8Array(body.length + central.length + end.length)
  out.set(body.toUint8Array(), 0)
  out.set(central.toUint8Array(), body.length)
  out.set(end.toUint8Array(), body.length + central.length)
  return out
}

export function validarFoto(foto) {
  if (foto === null) return;
  const formato = typeof foto === 'string' && foto.length <= 800_030
    && /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(foto);
  if (formato) {
    const imagen = Buffer.from(formato[2], 'base64');
    const firmas = {
      jpeg: imagen.subarray(0, 3).toString('hex') === 'ffd8ff',
      png: imagen.subarray(0, 8).toString('hex') === '89504e470d0a1a0a',
      webp: imagen.toString('ascii', 0, 4) === 'RIFF' && imagen.toString('ascii', 8, 12) === 'WEBP'
    };
    if (imagen.length <= 600_000 && firmas[formato[1]]) return;
  }
  throw Object.assign(new Error('La foto debe ser JPG, PNG o WebP de hasta 600 KB.'), { status: 400 });
}


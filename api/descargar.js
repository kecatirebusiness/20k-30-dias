// Descarga de los entregables desde el correo.
//
// Los PDF NO están en una carpeta pública: si lo estuvieran, cualquiera que
// adivinara el nombre del archivo se los llevaría sin pagar. Cada enlace lleva
// una firma atada al identificador del pago, y sin firma válida esto responde
// 403 sin tocar el disco.
//
// El adjunto del correo sigue siendo la vía principal. Esto es comodidad.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// La clave corta de la URL no revela el nombre real del archivo.
const ARCHIVOS = {
  reto:       { archivo: 'El-Reto-de-30-Dias.pdf',      nombre: 'El Reto de 30 Días.pdf' },
  plantillas: { archivo: '30-Plantillas-de-Carrusel.pdf', nombre: '30 Plantillas de Carrusel.pdf' },
  hooks:      { archivo: 'Banco-de-100-Hooks.pdf',      nombre: 'Banco de 100 Hooks.pdf' },
  desglose:   { archivo: 'Desglose-4-Posts.pdf',        nombre: 'Los 4 posts, desglosados.pdf' },
};

// Se reutiliza el secreto del webhook, que ya existe y nunca sale del servidor.
// Ojo: si algún día rotas ese secreto en Stripe, los enlaces ya enviados dejan
// de funcionar. Los adjuntos del correo no se ven afectados.
function firma(id) {
  return crypto
    .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET || '')
    .update(String(id))
    .digest('base64url')
    .slice(0, 24);
}

function iguales(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  // La comparación va en tiempo constante para no filtrar la firma byte a byte.
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = async (req, res) => {
  const q = new URL(req.url, 'http://local').searchParams;
  const id = q.get('id') || '';
  const t = q.get('t') || '';
  const f = q.get('f') || '';

  const item = ARCHIVOS[f];
  if (!item || !id || !t) {
    return res.status(404).send('No encontrado.');
  }

  if (!iguales(t, firma(id))) {
    return res
      .status(403)
      .send('Este enlace no es válido. Los archivos van adjuntos al correo de tu compra.');
  }

  try {
    const buf = fs.readFileSync(path.join(__dirname, '_entregables', item.archivo));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(item.nombre)}`
    );
    // Que ningún intermediario cachee un archivo de pago.
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(buf);
  } catch (err) {
    console.error('No se pudo leer el entregable', f, err);
    return res.status(500).send('No se pudo preparar la descarga. Escríbenos y te lo reenviamos.');
  }
};

module.exports.firma = firma;
module.exports.ARCHIVOS = ARCHIVOS;

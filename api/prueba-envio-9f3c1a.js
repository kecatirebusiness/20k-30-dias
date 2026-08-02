// ⚠️ ENDPOINT TEMPORAL — BORRAR DESPUÉS DE LA PRUEBA.
//
// Manda el correo de entrega real (misma plantilla, mismos adjuntos) a una
// dirección fija, para poder verlo en un cliente de correo de verdad sin tener
// que cobrar y reembolsar $37.
//
// El destinatario está escrito en el código a propósito: aunque alguien diera
// con esta URL, lo único que consigue es mandarle un correo a Kevin.

const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

const DESTINO = 'kevinrp224999@gmail.com';

// Se reutiliza la plantilla del webhook para que la prueba sea la cosa real y
// no una copia que puede divergir.
const webhook = require('./webhook.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo POST' });
  }

  try {
    const { CONFIG, plantillaEmail } = webhook._pruebas;
    const entregados = CONFIG.base;

    const adjuntos = entregados.map(({ archivo, nombre }) => ({
      filename: nombre,
      content: fs.readFileSync(path.join(__dirname, '_entregables', archivo)).toString('base64'),
    }));

    const resend = new Resend(process.env.RESEND_API_KEY);
    const r = await resend.emails.send({
      from: process.env.EMAIL_REMITENTE,
      to: DESTINO,
      subject: 'Ya estás dentro — tus guías van adjuntas',
      html: plantillaEmail({ nombre: 'Kevin', entregados }),
      attachments: adjuntos,
    });

    return res.status(200).json({ enviado: true, a: DESTINO, resend: r });
  } catch (err) {
    console.error('Fallo en la prueba de envío:', err);
    return res.status(500).json({ error: String(err && err.message) });
  }
};

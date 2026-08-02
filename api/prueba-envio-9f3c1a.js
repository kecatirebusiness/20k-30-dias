// ⚠️ ENDPOINT TEMPORAL — BORRAR DESPUÉS DE LA PRUEBA.
//
// Manda el correo de entrega real a la lista fija de abajo, para verlo en
// Gmail y en Outlook. Los destinatarios están escritos en el código a
// propósito: aunque alguien diera con esta URL, no puede escribir a nadie más.

const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

const DESTINOS = [
  { email: 'kevinrp224999@gmail.com',   nombre: 'Kevin' },
  { email: 'kevinrp2249@hotmail.com',   nombre: 'Kevin' },
  { email: 'iisabellabarela@gmail.com', nombre: 'Isabella' },
];

const webhook = require('./webhook.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  try {
    const { CONFIG, plantillaEmail } = webhook._pruebas;
    const entregados = CONFIG.base;

    const adjuntos = entregados.map(({ archivo, nombre }) => ({
      filename: nombre,
      content: fs.readFileSync(path.join(__dirname, '_entregables', archivo)).toString('base64'),
    }));

    const resend = new Resend(process.env.RESEND_API_KEY);
    const salida = [];

    // Uno por uno y no en copia: cada persona ve solo su dirección.
    for (const d of DESTINOS) {
      const r = await resend.emails.send({
        from: process.env.EMAIL_REMITENTE,
        to: d.email,
        subject: 'Ya estás dentro — tus guías van adjuntas',
        html: plantillaEmail({ nombre: d.nombre, entregados }),
        attachments: adjuntos,
      });
      salida.push({ a: d.email, id: r?.data?.id || null, error: r?.error || null });
    }

    return res.status(200).json({ enviados: salida.length, salida });
  } catch (err) {
    console.error('Fallo en la prueba de envío:', err);
    return res.status(500).json({ error: String(err && err.message) });
  }
};

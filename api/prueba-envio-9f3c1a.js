// ⚠️ ENDPOINT TEMPORAL — BORRAR DESPUÉS DE LA PRUEBA.
const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');
const DESTINO = 'kevinrp224999@gmail.com';
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
    const r = await resend.emails.send({
      from: process.env.EMAIL_REMITENTE,
      to: DESTINO,
      subject: 'Ya estás dentro — tus guías van adjuntas',
      html: plantillaEmail({ nombre: 'Kevin', entregados, pagoId: 'pi_prueba_botones' }),
      attachments: adjuntos,
    });
    return res.status(200).json({ enviado: true, a: DESTINO, resend: r });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message) });
  }
};

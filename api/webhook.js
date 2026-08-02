// Webhook de Stripe. Entrega automática de los productos.
//
// Stripe llama a esta función cuando un pago se confirma de verdad. Es el único
// sitio fiable para entregar: la página de gracias no sirve porque el comprador
// puede cerrar el navegador antes de que cargue.
//
// Variables de entorno requeridas:
//   STRIPE_SECRET_KEY       sk_live_... (ya la tienes)
//   STRIPE_WEBHOOK_SECRET   whsec_...   (la da Stripe al crear el webhook)
//   RESEND_API_KEY          re_...      (de resend.com)
//   EMAIL_REMITENTE         "Kevin <kevin@tudominio.com>"

const Stripe = require('stripe');
const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// Stripe firma el cuerpo original. Si Vercel lo parsea, la firma no valida.
module.exports.config = { api: { bodyParser: false } };

/* ══════════════════════════════════════════════════════════
   CONFIGURACIÓN
   ══════════════════════════════════════════════════════════ */
const CONFIG = {
  // Qué se entrega con el producto base
  base: [
    { archivo: 'El-Reto-de-30-Dias.pdf',  nombre: 'El Reto de 30 Días.pdf' },
    { archivo: 'Banco-de-100-Hooks.pdf',  nombre: 'Banco de 100 Hooks.pdf' },
  ],
  // Qué se entrega ADEMÁS si compró el order bump.
  // Cuando produzcas el desglose, ponlo en api/_entregables/ y añádelo aquí.
  bump: [
    // { archivo: 'Desglose-4-Posts.pdf', nombre: 'Desglose de los 4 posts.pdf' },
  ],
  // Cuándo se abren los módulos en video. Cámbialo cuando tengas fecha.
  fechaModulos: 'PENDIENTE',
  soporte: 'kecatirebusiness@gmail.com',
};

/* ══════════════════════════════════════════════════════════
   UTILIDADES
   ══════════════════════════════════════════════════════════ */
function leerCuerpoCrudo(req) {
  return new Promise((resolve, reject) => {
    const trozos = [];
    req.on('data', (t) => trozos.push(t));
    req.on('end', () => resolve(Buffer.concat(trozos)));
    req.on('error', reject);
  });
}

function adjuntar(lista) {
  return lista.map(({ archivo, nombre }) => ({
    filename: nombre,
    content: fs.readFileSync(path.join(__dirname, '_entregables', archivo)).toString('base64'),
  }));
}

function plantillaEmail({ nombre, conBump }) {
  const modulos =
    CONFIG.fechaModulos === 'PENDIENTE'
      ? `<p style="margin:0 0 16px">Los <strong style="color:#fff">módulos en video</strong> se abren muy pronto.
         Te aviso por este mismo correo en cuanto estén: no tienes que hacer nada.</p>`
      : `<p style="margin:0 0 16px">Los <strong style="color:#fff">módulos en video</strong> se abren el
         <strong style="color:#3DDC84">${CONFIG.fechaModulos}</strong>. Te llega el acceso por este mismo correo.</p>`;

  const extra = conBump
    ? `<li style="margin-bottom:8px">El desglose de los 4 posts que hicieron 57,390 seguidores</li>`
    : '';

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#050704;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050704;padding:36px 16px">
<tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="padding-bottom:28px">
      <div style="display:inline-block;border:1px solid #3DDC84;color:#3DDC84;font-size:11px;
        font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:100px">
        20K en 30 Días</div>
    </td></tr>

    <tr><td style="padding-bottom:20px">
      <h1 style="margin:0;color:#fff;font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-.5px">
        Ya estás dentro,<br>${nombre || 'bienvenido'}.</h1>
    </td></tr>

    <tr><td style="color:#A7B0AA;font-size:15px;line-height:1.6;padding-bottom:22px">
      <p style="margin:0 0 16px">Gracias por comprar. <strong style="color:#fff">Tus guías van adjuntas
      a este correo</strong> — descárgalas y guárdalas, son tuyas de por vida.</p>
      ${modulos}
    </td></tr>

    <tr><td style="background:rgba(61,220,132,.08);border-left:3px solid #3DDC84;border-radius:0 8px 8px 0;
      padding:18px 20px;margin-bottom:22px">
      <div style="color:#3DDC84;font-size:11px;font-weight:800;letter-spacing:1.5px;
        text-transform:uppercase;margin-bottom:10px">Lo que tienes ahora</div>
      <ul style="margin:0;padding-left:18px;color:#C9D2CC;font-size:14px;line-height:1.6">
        <li style="margin-bottom:8px"><strong style="color:#fff">El Reto de 30 Días</strong> — 80 páginas: el sistema completo, el calendario día por día y 10 plantillas rellenables</li>
        <li style="margin-bottom:8px"><strong style="color:#fff">Banco de 100 Hooks</strong> — los primeros tres segundos, resueltos</li>
        ${extra}
      </ul>
    </td></tr>

    <tr><td style="padding-top:26px;color:#A7B0AA;font-size:15px;line-height:1.6">
      <p style="margin:0 0 14px"><strong style="color:#fff">Por dónde empezar:</strong> abre
      <em>El Reto de 30 Días</em> y lee los capítulos 1 al 4 antes de publicar nada. Son 20 minutos
      y te ahorran el error que hace abandonar a casi todo el mundo en la semana dos.</p>
      <p style="margin:0">Si algo no te llega o tienes cualquier duda, responde a este correo
      directamente. Lo leo yo.</p>
    </td></tr>

    <tr><td style="padding-top:34px;border-top:1px solid rgba(255,255,255,.12);margin-top:30px">
      <p style="margin:22px 0 0;color:#78827C;font-size:12px;line-height:1.5">
        Kevin Rodriguez · 20K en 30 Días<br>
        ¿Problemas con la descarga? Escribe a ${CONFIG.soporte}
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/* ══════════════════════════════════════════════════════════
   HANDLER
   ══════════════════════════════════════════════════════════ */
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  let evento;
  try {
    const crudo = await leerCuerpoCrudo(req);
    evento = stripe.webhooks.constructEvent(
      crudo,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    // Firma inválida: la petición no viene de Stripe. Se rechaza.
    console.error('Firma de webhook inválida:', err.message);
    return res.status(400).send(`Firma inválida: ${err.message}`);
  }

  // Solo interesa el pago confirmado. Los demás eventos se aceptan y se ignoran.
  if (evento.type !== 'payment_intent.succeeded') {
    return res.status(200).json({ recibido: true, ignorado: evento.type });
  }

  const intent = evento.data.object;
  const meta = intent.metadata || {};
  const email = meta.email || intent.receipt_email;
  const conBump = meta.order_bump === 'si';
  const nombre = (meta.nombre || '').split(' ')[0];

  if (!email) {
    console.error('Pago sin email:', intent.id);
    return res.status(200).json({ recibido: true, error: 'sin email' });
  }

  try {
    const adjuntos = adjuntar([...CONFIG.base, ...(conBump ? CONFIG.bump : [])]);

    await resend.emails.send({
      from: process.env.EMAIL_REMITENTE,
      to: email,
      subject: 'Ya estás dentro — tus guías van adjuntas',
      html: plantillaEmail({ nombre, conBump }),
      attachments: adjuntos,
    });

    console.log('Entregado a', email, '| bump:', conBump, '| intent:', intent.id);
    return res.status(200).json({ recibido: true, entregado: true });
  } catch (err) {
    // Se devuelve 500 a propósito: Stripe reintenta durante 3 días.
    console.error('Fallo al entregar a', email, err);
    return res.status(500).json({ error: 'Fallo al enviar el email' });
  }
};

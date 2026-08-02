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

// Resend se crea dentro del handler, no al cargar el módulo: si la variable de
// entorno falta, el constructor lanza y la función devolvería 500 antes incluso
// de poder rechazar una firma inválida. Así los errores salen donde toca.
let _resend = null;
function correo() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

// Stripe firma el cuerpo original. Si Vercel lo parsea, la firma no valida.
module.exports.config = { api: { bodyParser: false } };

/* ══════════════════════════════════════════════════════════
   CONFIGURACIÓN
   ══════════════════════════════════════════════════════════ */
// El `titulo` y la `descripcion` son lo que se lista en el correo. Salen de la
// MISMA lista que genera los adjuntos, a propósito: así el correo no puede
// anunciar un archivo que no se envió.
const CONFIG = {
  // Qué se entrega con el producto base
  base: [
    {
      archivo: 'El-Reto-de-30-Dias.pdf',
      nombre: 'El Reto de 30 Días.pdf',
      titulo: 'El Reto de 30 Días',
      descripcion: '80 páginas. El sistema completo, el calendario día por día y 10 plantillas para rellenar.',
    },
    {
      archivo: '30-Plantillas-de-Carrusel.pdf',
      nombre: '30 Plantillas de Carrusel.pdf',
      titulo: '30 Plantillas de Carrusel',
      descripcion: '30 carruseles de 7 slides escritos enteros, en 6 tipos. Cambias el tema y publicas.',
    },
    {
      archivo: 'Banco-de-100-Hooks.pdf',
      nombre: 'Banco de 100 Hooks.pdf',
      titulo: 'Banco de 100 Hooks',
      descripcion: 'Los primeros tres segundos, resueltos. 100 frases terminadas, no plantillas.',
    },
  ],
  // Qué se entrega ADEMÁS si compró el order bump.
  // Cuando produzcas el desglose, ponlo en api/_entregables/ y descomenta esto.
  // Mientras esté vacío, el correo NO promete nada extra — pero el carrito
  // sigue cobrando $17 por ello. O se produce, o se quita del carrito.
  bump: [
    // {
    //   archivo: 'Desglose-4-Posts.pdf',
    //   nombre: 'Desglose de los 4 posts.pdf',
    //   titulo: 'Los 4 posts, desglosados',
    //   descripcion: 'Las cuatro piezas que trajeron 57,390 seguidores, abiertas por dentro: hook, estructura y por qué funcionó.',
    // },
  ],
  // Cuándo se abren los módulos en video. Cámbialo cuando tengas fecha.
  fechaModulos: 'PENDIENTE',
  // Va en el pie. Es el mismo buzón desde el que se envía, así que las
  // respuestas de los compradores caen donde tienen que caer.
  soporte: 'contact@primeproductionmedia.com',
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

// Tipografía: Poppins sólo la cargan Apple Mail e iOS. En Gmail y Outlook cae
// al stack del sistema, y está bien: no hay nada que dependa de la métrica.
const FUENTE = `Poppins,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;

// Un separador vertical. En correo no se usa margin: los clientes de Outlook lo
// ignoran. Se usa una fila vacía con altura explícita.
const hueco = (px) => `<tr><td style="height:${px}px;font-size:0;line-height:0;">&nbsp;</td></tr>`;

// Una viñeta del panel de entregables.
function fila({ titulo, descripcion }, i) {
  return `${i === 0 ? '' : `<tr><td colspan="2" style="height:16px;font-size:0;line-height:0;">&nbsp;</td></tr>`}
      <tr>
        <td valign="top" width="26" style="width:26px;padding-top:2px;font-family:${FUENTE};font-size:15px;color:#3DDC84;">&#9679;</td>
        <td valign="top" style="font-family:${FUENTE};">
          <div style="font-size:16px;font-weight:600;color:#FFFFFF;line-height:1.4;">${titulo}</div>
          <div style="font-size:14px;line-height:1.55;color:#8B948E;padding-top:3px;">${descripcion}</div>
        </td>
      </tr>`;
}

// Un paso numerado.
function paso(n, texto) {
  return `${n === 1 ? '' : `<tr><td colspan="2" style="height:16px;font-size:0;line-height:0;">&nbsp;</td></tr>`}
      <tr>
        <td valign="top" width="38" style="width:38px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="26" height="26" align="center" valign="middle"
                style="width:26px;height:26px;background:#3DDC84;border-radius:6px;
                       font-family:${FUENTE};font-size:13px;font-weight:800;color:#050704;">${n}</td>
          </tr></table>
        </td>
        <td valign="top" style="font-family:${FUENTE};font-size:15px;line-height:1.6;color:#A7B0AA;padding-top:2px;">${texto}</td>
      </tr>`;
}

function plantillaEmail({ nombre, entregados }) {
  const modulos =
    CONFIG.fechaModulos === 'PENDIENTE'
      ? `<strong style="color:#FFFFFF;font-weight:600;">Los módulos en video se abren muy pronto.</strong>
         Te llega el acceso por este mismo correo, sin que tengas que hacer nada.`
      : `<strong style="color:#FFFFFF;font-weight:600;">Los módulos en video se abren el
         <span style="color:#3DDC84;">${CONFIG.fechaModulos}</span>.</strong>
         Te llega el acceso por este mismo correo, sin que tengas que hacer nada.`;

  const listado = entregados.map(fila).join('\n');
  const plural = entregados.length === 1 ? 'Tu guía va' : 'Tus guías van';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ya estás dentro</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap');
  @media only screen and (max-width:600px){
    .sp-lg{height:28px !important}
    .pad-x{padding-left:22px !important;padding-right:22px !important}
    .h1{font-size:27px !important;line-height:1.18 !important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#050704;">

<div style="display:none;font-size:1px;color:#050704;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Tus guías van adjuntas a este correo. Empieza por el capítulo 1 antes de publicar nada.
  &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#050704;">
<tr><td align="center" style="padding:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

    <tr><td style="height:5px;background:#3DDC84;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td class="sp-lg" style="height:40px;font-size:0;line-height:0;">&nbsp;</td></tr>

    <tr><td class="pad-x" style="padding:0 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="border:1px solid #3DDC84;border-radius:100px;padding:7px 15px;font-family:${FUENTE};
                   font-size:11px;font-weight:800;letter-spacing:2px;color:#3DDC84;text-transform:uppercase;">
          20K en 30 Días
        </td>
      </tr></table>
    </td></tr>

    ${hueco(26)}

    <tr><td class="pad-x" style="padding:0 40px;">
      <h1 class="h1" style="margin:0;font-family:${FUENTE};font-size:34px;line-height:1.14;
                 font-weight:800;letter-spacing:-.8px;color:#FFFFFF;">
        Ya estás dentro,<br><span style="color:#3DDC84;">${nombre || 'bienvenido'}</span>.
      </h1>
    </td></tr>

    ${hueco(20)}

    <tr><td class="pad-x" style="padding:0 40px;font-family:${FUENTE};font-size:16px;line-height:1.62;color:#A7B0AA;">
      Gracias por comprar. ${plural} <strong style="color:#FFFFFF;font-weight:600;">adjuntas
      a este correo</strong> — descárgalas y guárdalas. Son tuyas de por vida.
    </td></tr>

    ${hueco(32)}

    <tr><td class="pad-x" style="padding:0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0C140F;border-radius:10px;">
        <tr>
          <td width="4" style="width:4px;background:#3DDC84;font-size:0;line-height:0;border-radius:10px 0 0 10px;">&nbsp;</td>
          <td style="padding:24px 26px;">
            <div style="font-family:${FUENTE};font-size:11px;font-weight:800;letter-spacing:1.8px;
                        color:#3DDC84;text-transform:uppercase;">Adjunto en este correo</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
              ${listado}
            </table>
          </td>
        </tr>
      </table>
    </td></tr>

    ${hueco(36)}

    <tr><td class="pad-x" style="padding:0 40px;font-family:${FUENTE};font-size:11px;font-weight:800;
               letter-spacing:1.8px;color:#78827C;text-transform:uppercase;">Por dónde empezar</td></tr>

    ${hueco(18)}

    <tr><td class="pad-x" style="padding:0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${paso(1, `Abre <strong style="color:#FFFFFF;font-weight:600;">El Reto de 30 Días</strong> y lee los capítulos 1 al 4 antes de publicar nada. Son 20 minutos.`)}
        ${paso(2, `Rellena <strong style="color:#FFFFFF;font-weight:600;">la hoja de tu serie</strong> (Anexo A). Si no cabe ahí, la serie es demasiado vaga para sostener 30 días.`)}
        ${paso(3, `Publica el día 1. Hoy, no mañana. El calendario está hecho para empezar en frío.`)}
      </table>
    </td></tr>

    ${hueco(36)}

    <tr><td class="pad-x" style="padding:0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #23302A;border-radius:10px;">
        <tr><td style="padding:18px 22px;font-family:${FUENTE};font-size:14px;line-height:1.6;color:#8B948E;">
          ${modulos}
        </td></tr>
      </table>
    </td></tr>

    ${hueco(34)}

    <tr><td class="pad-x" style="padding:0 40px;font-family:${FUENTE};font-size:15px;line-height:1.62;color:#A7B0AA;">
      Si algún archivo no te llega o tienes cualquier duda, responde a este correo. Lo leo yo.
    </td></tr>

    <tr><td class="sp-lg" style="height:40px;font-size:0;line-height:0;">&nbsp;</td></tr>

    <tr><td class="pad-x" style="padding:0 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="border-top:1px solid #1B2520;font-size:0;line-height:0;height:1px;">&nbsp;</td></tr>
      </table>
    </td></tr>

    ${hueco(22)}

    <tr><td class="pad-x" style="padding:0 40px;font-family:${FUENTE};font-size:13px;line-height:1.7;color:#5E6864;">
      <span style="color:#FFFFFF;font-weight:600;">Kevin Rodriguez</span> &nbsp;·&nbsp; 20K en 30 Días<br>
      El cargo aparece en tu tarjeta como <span style="color:#8B948E;">PRIME PRODUCTION MEDIA</span>.<br>
      ¿Problemas con la descarga? Escribe a
      <a href="mailto:${CONFIG.soporte}" style="color:#3DDC84;text-decoration:none;">${CONFIG.soporte}</a>
    </td></tr>

    ${hueco(44)}

  </table>
</td></tr>
</table>
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
    // Una sola lista para las dos cosas: lo que se adjunta y lo que se anuncia.
    const entregados = [...CONFIG.base, ...(conBump ? CONFIG.bump : [])];

    await correo().emails.send({
      from: process.env.EMAIL_REMITENTE,
      to: email,
      subject: 'Ya estás dentro — tus guías van adjuntas',
      html: plantillaEmail({ nombre, entregados }),
      attachments: adjuntar(entregados),
    });

    console.log('Entregado a', email, '| bump:', conBump, '| intent:', intent.id);
    return res.status(200).json({ recibido: true, entregado: true });
  } catch (err) {
    // Se devuelve 500 a propósito: Stripe reintenta durante 3 días.
    console.error('Fallo al entregar a', email, err);
    return res.status(500).json({ error: 'Fallo al enviar el email' });
  }
};

// Función serverless (Vercel). Crea el cobro en Stripe.
//
// La clave SECRETA vive solo aquí, en una variable de entorno del servidor.
// Nunca llega al navegador y nunca se escribe en el código.
//
// Variable de entorno requerida:  STRIPE_SECRET_KEY = sk_live_...

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Los precios se calculan SIEMPRE aquí, nunca se aceptan del navegador.
// Si el precio viniera del cliente, cualquiera podría editarlo y pagar $1.
const PRECIOS = {
  base: 3700,   // 20K en 30 Días — $37.00
  bump: 1700,   // Desglose de los 4 posts — $17.00
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { conBump, nombre, apellido, email, telefono, pais } = req.body || {};

    if (!email || !nombre) {
      return res.status(400).json({ error: 'Faltan datos obligatorios.' });
    }

    const importe = PRECIOS.base + (conBump === true ? PRECIOS.bump : 0);

    const intent = await stripe.paymentIntents.create({
      amount: importe,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      receipt_email: email,
      description: conBump
        ? '20K en 30 Días + Desglose de los 4 posts'
        : '20K en 30 Días',
      metadata: {
        producto: '20k-en-30-dias',
        order_bump: conBump ? 'si' : 'no',
        nombre: `${nombre} ${apellido || ''}`.trim(),
        email,
        telefono: telefono || '',
        pais: pais || '',
      },
    });

    return res.status(200).json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error('Error creando el cobro:', err);
    return res.status(500).json({ error: 'No se pudo iniciar el cobro.' });
  }
};

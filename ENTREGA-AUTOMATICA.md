# Entrega automática — cómo activarla

Cuando alguien paga, Stripe avisa a tu servidor y el servidor manda un email con las
guías adjuntas. **Sin intervención tuya, en menos de un minuto.**

Tiempo de configuración: **15 minutos.**

---

## Por qué un webhook y no la página de gracias

La página de gracias solo se ejecuta si el comprador se queda en el navegador. Si cierra
la pestaña justo después de pagar —cosa que hace bastante gente— nunca recibiría nada.

El webhook lo llama Stripe desde sus servidores cuando el cobro se confirma de verdad.
Se ejecuta siempre, y si falla, **Stripe lo reintenta durante tres días**.

---

## Paso 1 — Cuenta de email (Resend)

Un servidor no puede mandar emails desde Gmail sin acabar en spam. Se usa un servicio.
Resend es gratis hasta 3,000 emails al mes.

1. Entra a <https://resend.com> y crea cuenta
2. **Domains → Add Domain** → pon tu dominio y añade los registros DNS que te dé
   (si aún no tienes dominio, salta esto y usa el remitente de pruebas del paso 3)
3. **API Keys → Create API Key** → copia la clave (`re_...`)

---

## Paso 2 — Crear el webhook en Stripe

1. Entra a <https://dashboard.stripe.com/webhooks>
2. **Add endpoint**
3. **Endpoint URL:** `https://20k-30-dias.vercel.app/api/webhook`
   (o tu dominio propio si ya lo pusiste)
4. **Select events** → busca y marca **solo** `payment_intent.succeeded`
5. **Add endpoint**
6. En la pantalla del webhook, busca **Signing secret** → **Reveal** → copia (`whsec_...`)

> Ese secreto es lo que impide que cualquiera pueda llamar a tu webhook y regalarse los
> productos. La función rechaza toda petición que no venga firmada por Stripe.

---

## Paso 3 — Variables de entorno en Vercel

Vercel → proyecto `20k-30-dias` → **Settings → Environment Variables**.
Añade estas tres (la de Stripe ya la tienes):

| Name | Value |
|------|-------|
| `STRIPE_WEBHOOK_SECRET` | el `whsec_...` del paso 2 |
| `RESEND_API_KEY` | el `re_...` del paso 1 |
| `EMAIL_REMITENTE` | `Kevin Rodriguez <contact@primeproductionmedia.com>` |

**Estado actual: ya está puesto así.** El dominio `primeproductionmedia.com` está verificado
en Resend (1 ago 2026) con estos registros DNS en Squarespace:

| Tipo | Nombre | Valor |
|------|--------|-------|
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| MX | `send` (prio 10) | `feedback-smtp.us-east-1.amazonses.com` |
| TXT | `resend._domainkey` | la clave DKIM que da Resend |
| TXT | `_dmarc` | `v=DMARC1; p=none;` |

⚠️ **No tocar los registros de Google Workspace** (`MX @` prio 1 → `smtp.google.com`,
`TXT google._domainkey`, `TXT @` con el SPF de Google). Los de Resend viven en el
subdominio `send` justamente para que los dos SPF no se pisen. Si algún día pones el SPF
de Amazon en `@`, rompes el correo de Google Workspace.

Como `contact@primeproductionmedia.com` es un buzón real de Google Workspace, las
respuestas de los compradores te llegan ahí.

Después de añadirlas: **Deployments → el último → Redeploy.** Las variables nuevas no
se aplican hasta que redespliegas.

---

## Paso 4 — Probar

1. En Stripe, ve al webhook que creaste → **Send test webhook** → `payment_intent.succeeded`
2. Mira **Vercel → Logs**. Deberías ver `Entregado a ...`
3. Para la prueba real: cambia las claves a modo test, haz una compra con `4242 4242 4242 4242`
   y comprueba que el email llega con los dos PDFs adjuntos

---

## Qué se entrega hoy

| Producto | Estado |
|----------|--------|
| El Reto de 30 Días (80 págs) | ✅ Se envía adjunto |
| Banco de 100 Hooks | ✅ Se envía adjunto |
| 6 módulos en video | ❌ **No existen.** El email dice «se abren muy pronto» |
| 30 plantillas de carrusel | ❌ **No existen y están prometidas en el carrito** |
| Order bump: desglose de 4 posts | ❌ No existe. El slot está listo en el código |

### ⛔ Esto sigue bloqueando la venta

El carrito promete **«30 plantillas editables»** y **6 módulos en video**. Ahora mismo el
comprador paga $37 y recibe dos PDFs. Eso son reembolsos y disputas.

**Dos salidas:**
1. Producir las plantillas y grabar los módulos antes de mandar tráfico
2. Cambiar el copy del carrito a preventa: decir qué llega hoy y qué llega el día X

---

## Cómo añadir un producto nuevo

1. Copia el archivo a `api/_entregables/`
2. Añádelo a `CONFIG` en `api/webhook.js`:
   ```js
   base: [
     { archivo: 'Mi-Guia.pdf', nombre: 'Mi Guía.pdf' },
   ],
   ```
   O a `bump:` si solo va con el order bump.
3. `git push`. Vercel redespliega solo.

**Límite:** los adjuntos no pueden pasar de ~38 MB en total. Ahora vamos por 3.15 MB.
Cuando metas video, ya no se manda adjunto: se manda un enlace a la plataforma del curso.

---

## Cuándo poner la fecha de los módulos

En `api/webhook.js`, arriba:
```js
fechaModulos: 'PENDIENTE',
```
Cámbialo por ejemplo a `'15 de septiembre'` y el email pasa de decir «muy pronto» a dar
fecha concreta. Es mejor: una fecha se puede esperar, un «pronto» genera reembolsos.

---

## Si algo falla

| Síntoma | Causa casi segura |
|---------|-------------------|
| Stripe muestra el webhook en rojo | Falta `STRIPE_WEBHOOK_SECRET` o no redesplegaste |
| Logs dicen «Firma inválida» | El secreto no coincide con el del endpoint |
| No llega el email pero los logs dicen «Entregado» | Está en spam, o el remitente no está verificado en Resend |
| «sin email» en los logs | El pago se creó sin metadata: revisa `crear-pago.js` |

Los reintentos de Stripe se ven en el propio webhook, pestaña de eventos. Si arreglas el
problema, puedes reenviar cada evento a mano desde ahí.

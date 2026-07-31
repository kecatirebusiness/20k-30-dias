# Cómo conectar Stripe y publicar el carrito

Tiempo estimado: **20–30 minutos**. No hace falta saber programar.

---

## Por qué hay que salir de GitHub Pages

Para que el comprador escriba la tarjeta **en tu página** (y no en una pantalla de Stripe),
alguien tiene que hablar con Stripe usando tu **clave secreta** (`sk_live_...`).

Esa clave no puede estar en el HTML: cualquiera que abra el código fuente podría cobrar
en tu nombre o ver tus ventas. GitHub Pages solo sirve archivos, no puede ejecutar código,
así que no puede guardar el secreto.

**Vercel sí puede**, es gratis, y publica el sitio igual que GitHub Pages. Por eso movemos ahí.

---

## Paso 1 — Sacar tus claves de Stripe

1. Entra a <https://dashboard.stripe.com/apikeys>
2. Copia la **Publishable key** (empieza por `pk_live_`). Esta es pública.
3. Copia la **Secret key** (empieza por `sk_live_`). **Esta no se la enseñas a nadie
   ni la escribes en ningún archivo del proyecto.** Solo la pegarás en Vercel, en el paso 3.

> Si quieres probar antes de cobrar de verdad, activa el modo Test arriba a la derecha
> y usa las claves `pk_test_` / `sk_test_`. La tarjeta de prueba es `4242 4242 4242 4242`,
> con cualquier fecha futura y cualquier CVC.

---

## Paso 2 — Pegar la clave publicable

Hay que ponerla en **dos archivos**, en la línea que ya está marcada:

**`carrito.html`** — busca `publishableKey`:
```js
publishableKey: 'pk_live_PON_AQUI_TU_CLAVE_PUBLICABLE',
```

**`gracias.html`** — busca `PUBLISHABLE_KEY`:
```js
const PUBLISHABLE_KEY = 'pk_live_PON_AQUI_TU_CLAVE_PUBLICABLE';
```

Reemplaza el texto por tu clave real, entre las comillas.

---

## Paso 3 — Publicar en Vercel

1. Entra a <https://vercel.com> y crea cuenta con **GitHub** (la de `kecatirebusiness`).
2. **Add New → Project** → elige el repo `20k-30-dias` → **Import**.
3. No cambies nada de la configuración. Antes de darle a Deploy, abre
   **Environment Variables** y añade:

   | Name | Value |
   |------|-------|
   | `STRIPE_SECRET_KEY` | tu clave `sk_live_...` |

4. **Deploy**.

En 1–2 minutos tendrás una URL tipo `20k-30-dias.vercel.app`. Ahí ya funciona el cobro.

> La clave secreta queda guardada en Vercel, cifrada, y solo la lee la función del servidor.
> Nunca viaja al navegador.

---

## Paso 4 — Probar antes de vender

1. Abre `tu-url.vercel.app/carrito.html`
2. Rellena el formulario con la tarjeta de prueba `4242 4242 4242 4242`
3. Comprueba que:
   - Al marcar el order bump, el total pasa de **$37.00 a $54.00**
   - Tras pagar, llegas a la página de gracias
   - El pago aparece en <https://dashboard.stripe.com/payments>
   - En ese pago, dentro de **Metadata**, ves el nombre, email, teléfono, país
     y si compró o no el order bump

---

## Paso 5 — Tu dominio propio (opcional)

En Vercel: **Settings → Domains → Add**. Metes tu dominio y sigues las instrucciones
de DNS. Recuerda actualizar `returnUrl` si usas un dominio distinto (ya se calcula solo
a partir del dominio actual, así que normalmente no hay que tocar nada).

---

## Lo que todavía tienes que resolver tú

- [ ] **Entregar el producto.** Ahora mismo, tras pagar, nadie recibe nada automáticamente.
      Tienes que conectar el email de acceso. Lo más simple: un webhook de Stripe que
      dispare tu plataforma de cursos, o revisar los pagos a mano al principio.
- [ ] **Términos y condiciones.** El enlace del carrito apunta a `#`. Necesitas una página real.
- [ ] **Política de devolución.** Sigue vacía en el FAQ de la landing.
- [ ] **El producto del order bump.** Propuse *"Los 4 posts que hicieron 57,390 seguidores,
      desglosados"* a $17. Si lo vendes, tienes que producirlo. Si prefieres otro, se cambia
      el texto en `carrito.html` y el precio en `api/crear-pago.js` (las dos cosas: el precio
      real se calcula en el servidor a propósito, para que nadie pueda manipularlo).

---

## Estructura de archivos

```
20k-30-dias/
├── index.html          landing
├── carrito.html        checkout con formulario propio y order bump
├── gracias.html        página de confirmación (return_url de Stripe)
├── api/
│   └── crear-pago.js   función de servidor: crea el cobro en Stripe
├── img/
├── package.json        dependencia: stripe
└── vercel.json         config de Vercel
```

## Dónde se cambian los precios

En **`api/crear-pago.js`** (el que manda, el del servidor):
```js
const PRECIOS = { base: 3700, bump: 1700 };   // centavos
```

Y en **`carrito.html`**, solo para lo que se muestra en pantalla:
```js
precios: { base: 3700, bump: 1700 }
```

Cambia los dos a la vez. Si solo cambias el del HTML, el comprador verá un precio
y se le cobrará otro.

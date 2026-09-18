# 🎀 Prompt para la Landing Page de "Regi Bazar"

> Pega este prompt en tu herramienta de generación de UI preferida (v0, Lovable, Bolt, Claude, etc.) o entrégaselo a un desarrollador. Está pensado para producir una landing de altísimo calibre visual, ultra femenina y tierna, coherente con la app que Regi Bazar ya usa.

---

## 🧁 ROL

Actúa como un **diseñador y desarrollador frontend de élite** especializado en *landing pages femeninas, coquette y de alto impacto visual* (estilo "girly luxury": pensar en marcas como Glossier, Rare Beauty, Sanrio, pero más tierno y artesanal). Tu trabajo es crear **la landing page más niña, tierna y encantadora que el internet haya visto**, sin sacrificar elegancia ni velocidad.

## 🎯 OBJETIVO

Crear la página de inicio pública de **Regi Bazar**, un negocio de venta por transmisiones en vivo de Facebook. Hoy el negocio solo existe dentro de Facebook; esta landing será **su casa propia en internet**: el link que va en su perfil/bio. Debe lograr que una persona que apenas descubre Regi Bazar:

1. Se enamore de la marca en los primeros 3 segundos.
2. Entienda al instante qué es y cómo comprar.
3. Sepa cuándo es el próximo live y se quede esperándolo.
4. Confíe (testimonios, prueba social).
5. Dé el paso: escribir por Messenger / unirse / rastrear su pedido.

**Mobile-first absoluto**: el 95% de las visitas llega desde el celular, dando clic desde Facebook.

## 🛍️ SOBRE EL NEGOCIO

- **Nombre:** Regi Bazar
- **Qué es:** bazar femenino que vende por **transmisiones en vivo de Facebook** ("lives"). Las clientas apartan en el live y reciben su pedido por entrega a domicilio o lo recogen.
- **Personalidad de marca:** tierna, cálida, cercana, consentidora. Le habla a sus clientas como "hermosa", "bonita", "consentida". Mucho cariño, mucho detalle (los pedidos llegan con moñitos 🎀).
- **Diferenciador:** la experiencia. Cada clienta recibe un link de seguimiento precioso, gana **RegiPuntos**, sube de nivel VIP, y la atienden con amor.
- **Ya tienen:** programa de puntos (RegiPuntos), niveles de clienta (Nueva → Frecuente → Consentida 👑), seguimiento de pedido en vivo, y atención por Messenger.
- **Canales actuales:**
  - Facebook: `https://www.facebook.com/regi.bazar.852309`
  - Messenger directo: `https://m.me/regi.bazar.852309`
  - *(El negocio NO usa WhatsApp. Todo el contacto es por Messenger.)*

## 🧰 STACK TÉCNICO (recomendado)

Prioriza **calibre visual + velocidad**:

- **Vite + React + TypeScript** (base rápida y moderna).
- **Tailwind CSS** para estilos (combina con la app existente, que también usa Tailwind).
- **Framer Motion** para animaciones de entrada, scroll reveal y microinteracciones bouncy/elásticas.
- **Lenis** para smooth scroll suave y premium.
- **canvas-confetti** para explosiones de corazones/confeti en momentos clave.
- **Lottie** (lottie-react) para ilustraciones animadas tiernas (moños, corazones, estrellitas).
- Iconos: **Lucide** (coherente con la app).
- Deploy sugerido: **Vercel** (o Firebase Hosting, que ya usan).

> Alternativa si se prioriza SEO/performance puro: **Astro** con islas de React. Si se prefiere consistencia total con el ecosistema, puede hacerse en **Angular standalone**, pero React + Framer Motion da el "wow" más fácil.

## 🎨 IDENTIDAD VISUAL (OBLIGATORIO — debe combinar con la app actual)

### Paleta de color (exacta, tomada de la app en producción)
```
Rosa principal:      #ec4899  (acciones, acentos)
Rosa medio:          #f472b6
Rosa oscuro/vino:    #be185d / #9d174d  (texto fuerte, gradientes)
Rosa profundo texto: #831843
Rosa pétalo claro:   #fbcfe8 / #f9a8d4  (fondos suaves, badges)
Fondos crema/rosa:   #fff5f7 / #fdf2f8 / #fce7f3  (degradado de fondo general)
Lavanda/púrpura:     #a78bfa / #7c3aed  (acento secundario, RegiPuntos)
Blanco hueso:        #fffaf9
```
Degradado de fondo base sugerido: `linear-gradient(160deg, #fff5f7 0%, #fdf2f8 30%, #fce7f3 60%, #fdf2f8 100%)`.

### Tipografías
- **Títulos display / románticos:** `Dancing Script` (cursiva, para el nombre y frases emotivas).
- **Encabezados fuertes:** `Poppins` peso 800/900 (black), letras juntas (tracking apretado).
- **Cuerpo:** `Poppins` peso 400/600.
- Cargar de Google Fonts.

### Estilo visual
- **Glassmorphism coquette:** tarjetas translúcidas (`bg-white/40` a `/70`), `backdrop-blur`, bordes blancos suaves, sombras rosadas (`shadow-pink-200/50`).
- Esquinas **muy redondeadas** (`rounded-3xl`, `rounded-[2rem]`).
- Detalles por todos lados: 🎀 moños, 💕 corazones, ✨ destellos, 🌸 flores, 👑 coronas, 🦄.
- Degradados rosa→lavanda en botones y acentos.
- Sensación general: suave, esponjoso, "huggable", como una cajita de regalo.

## 🧱 ESTRUCTURA DE LA LANDING (sección por sección)

### 1. Hero (primer impacto)
- Fondo con degradado crema-rosa + **corazones y destellos flotando** (parallax sutil).
- Logo de Regi Bazar arriba, centrado.
- Nombre "Regi Bazar" en `Dancing Script` gigante, con un brillo/sparkle animado.
- Tagline emotivo (ej.: *"Consiéntete con lo que mereces, hermosa 🎀"*).
- Botón principal grande y bouncy: **"Escríbenos por Messenger 💬"** → `https://m.me/regi.bazar.852309`.
- Botón secundario: **"Ver próximo live ✨"** (ancla a la sección de live).
- Al cargar: **lluvia de confeti de corazones** (canvas-confetti) una sola vez.
- Animación de entrada elástica (Framer Motion).

### 2. Próximo Live + Cuenta Regresiva ⏰
- Tarjeta destacada con **countdown en vivo** al próximo live (días/horas/min/seg).
- Texto: *"¡Nuestro próximo live es [DÍA] a las [HORA]! No te lo pierdas 🛍️"*.
- Botón: **"Recordármelo"** (que abra Messenger o el evento de Facebook).
- Si no hay live programado, mostrar: *"Síguenos en Facebook para enterarte del próximo 💕"*.

### 3. Cómo Comprar (1-2-3) 🛒
- Tres pasos ilustrados con iconos/Lottie animados:
  1. **Entra al live** en nuestro Facebook 📱
  2. **Aparta tu pieza** comentando o por mensaje 🎀
  3. **Recibe tu pedido** con tu link de seguimiento y muchos mimos 📦💕
- Cada paso aparece con scroll reveal escalonado.

### 4. Vitrina / Galería 📸
- Carrusel o grid masonry con fotos reales de productos, empaques con moño, y momentos de lives.
- Efecto hover: zoom suave + brillo.
- (Las fotos las proveerá la dueña — ver sección de assets.)

### 5. Por qué amar a Regi Bazar 💖 (Beneficios)
- Tarjetas glassmorphism con:
  - 🎀 **RegiPuntos:** "Gana puntos en cada compra y canjéalos por sorpresas."
  - 👑 **Niveles VIP:** "Mientras más compras, más consentida: de Nueva a Consentida VIP."
  - 📦 **Seguimiento en vivo:** "Mira tu pedido en camino con tu link personal."
  - 💬 **Atención con amor:** "Te atendemos por Messenger, siempre al pendiente."

### 6. Testimonios 🌸 (prueba social)
- Carrusel de tarjetas tiernas con foto (opcional), nombre y reseña de clientas reales.
- Estrellitas ⭐ animadas. Fondo con corazones flotando.

### 7. Rastrea tu Pedido 📦
- Input bonito: "Pega aquí tu link o código de pedido" → redirige al link de seguimiento existente (formato `/pedido/{token}`).
- Microcopy: *"¿Ya compraste? Mira dónde va tu pedido 💕"*.

### 8. Únete / Síguenos 🎉
- Botones grandes a Facebook, Messenger, Instagram/TikTok (los que tenga).
- Invitación: *"Únete a nuestra comunidad de niñas consentidas ✨"*.

### 9. Footer
- Logo pequeño, frase tierna, links, zona de entrega, © Regi Bazar.
- Detalle final: un moñito o corazón animado.

## ✨ MICROINTERACCIONES Y FACTOR "WOW TIERNO"
- **Smooth scroll** (Lenis) en toda la página.
- **Scroll reveal** suave y escalonado en cada sección (Framer Motion `whileInView`).
- **Corazones/pétalos flotando** de fondo, lentos, con parallax.
- Botones con **rebote elástico** al hover y "squish" al hacer clic.
- **Confeti de corazones** al cargar y al dar clic en el CTA principal.
- Cursor con un pequeño rastro de destellos (sutil, solo en desktop).
- Elementos que "respiran" (animación de float infinita) como en la app.
- Transiciones de página/sección con curva elástica `cubic-bezier(0.34, 1.56, 0.64, 1)`.
- Opcional encantador: un mini sticker/mascota (moño con carita) que saluda al hacer scroll.

## 🗣️ TONO DE VOZ Y COPY
- Cálido, femenino, cercano, tierno. Habla de "tú", llama a la clienta "hermosa", "bonita", "consentida".
- Muchos emojis suaves: 🎀💕✨🌸💖👑.
- Frases de ejemplo listas para usar:
  - Hero: *"Bienvenida, hermosa 🎀 Aquí cada compra es un mimo para ti."*
  - CTA: *"Escríbenos, te consentimos 💬💕"*
  - Beneficios: *"Porque te lo mereces, y aquí te lo damos bonito ✨"*
  - Cierre: *"Te esperamos en el próximo live, no faltes 🌸"*

## 📱 REQUISITOS TÉCNICOS
- **Mobile-first** y 100% responsive (probar en pantallas chicas primero).
- **Rápida**: imágenes optimizadas (WebP), lazy-load, Lighthouse 90+.
- **Accesible**: contraste suficiente, alt en imágenes, navegación por teclado.
- **SEO + redes**: meta tags, Open Graph y Twitter Card con logo y foto bonita (para que se vea linda al compartir el link en Facebook).
- **Favicon** con el logo.
- Respetar `prefers-reduced-motion` (bajar animaciones si el usuario lo pide).

## 📦 ENTREGABLES
1. Proyecto Vite + React + TS listo para `npm run dev` y `npm run build`.
2. Código limpio, componentes por sección, comentarios en español.
3. Archivos de imagen como placeholders donde falten assets, claramente marcados.
4. Instrucciones de cómo reemplazar textos, fotos y links.
5. Listo para deploy en Vercel/Firebase.

---

## 🙋‍♀️ LO QUE NECESITO DE TI (Eduardo) ANTES O DURANTE

Para que quede perfecta y con cosas reales (no de relleno), júntame esto:

**Imprescindibles:**
- [ ] **Logo** de Regi Bazar en buena calidad (idealmente PNG con fondo transparente o SVG).
- [ ] **3 a 6 fotos** bonitas y reales: productos, los empaques con moño, ambiente, y/o de tu esposa atendiendo (las que ella quiera mostrar).
- [ ] **Qué vende exactamente** (categorías: ¿ropa, accesorios, belleza, hogar, variado?) y **una frase** que describa el negocio.

**Muy recomendables:**
- [ ] **3 a 5 testimonios reales** de clientas (texto + nombre; foto opcional, con su permiso).
- [ ] **Horario de los lives** (días y hora) para la cuenta regresiva.
- [ ] **Eslogan/tagline** que le guste (o le propongo opciones).
- [ ] **Links** de Instagram / TikTok / grupo de Facebook (si tiene).
- [ ] **Zona de entrega** (ciudades donde reparte).

**Opcionales (le dan alma):**
- [ ] Mini **historia** de cómo nació Regi Bazar (para un toque personal).
- [ ] **Dominio** que quieras usar (ej. regibazar.com).
- [ ] Si quiere ajustar la paleta o las tipografías (por defecto uso las de su app).

---

### Datos que YA tengo y van incluidos (no necesitas dármelos):
- Facebook: `facebook.com/regi.bazar.852309`
- Messenger: `m.me/regi.bazar.852309`
- Paleta de color y tipografías (tomadas de la app actual)
- Modelo de negocio, RegiPuntos, niveles VIP, link de seguimiento `/pedido/{token}`
- Tema visual coquette / glassmorphism / tierno
- No se usa WhatsApp (solo Messenger)

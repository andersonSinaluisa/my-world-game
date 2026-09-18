# Investigación de assets para el MVP

**Fecha:** 18 de septiembre de 2026.
**Proyecto:** juego sandbox tipo *dollhouse* para móvil, en 2D, con React Native + Expo, comercial para iOS y Android.
**Estilo buscado:** cartoon, cute e infantil. Colores pastel o vivos, formas redondeadas, vista frontal. Nada de pixel art ni de realismo.

> **Advertencias**
> - **No es asesoría legal.** Antes de lanzar, un abogado debería revisar las cláusulas marcadas con ⚠️.
> - **No se vieron las imágenes de muestra** de la mayoría de los packs. Las herramientas solo leen texto, así que las notas de estilo (de 1 a 5) salen de las descripciones y etiquetas. **Revisa las previews antes de comprar.**
> - **Algunas páginas no se pudieron abrir**: Shutterstock, OpenGameArt, la licencia de gamedeveloperstudio.com y partes de GameDev Market. Lo marco como *(sin verificar)*.
> - **Los precios pueden haber cambiado.**

---

## 1. Conclusiones

1. **Ningún pack del mercado cumple a la vez con el estilo buscado, la coherencia entre categorías y una licencia limpia para un creador de avatares.** La mayoría de interiores 2D son pixel art, vista cenital o isométricos. Los personajes con partes modulares son casi todos de RPG, anime o "fashion doll".
2. **El núcleo del juego es que el jugador personalice avatares y casas, y eso choca con muchas licencias de stock:**
   - **Envato (Elements y Market):** prohíbe usar sus assets en apps donde el usuario final personaliza un producto ("build it yourself").
   - **Creative Market:** prohíbe la personalización por el usuario final y, además, tiene un tope de 250.000 descargas.
   - **Vecteezy:** prohíbe los diseños generados "on-demand" por terceros.
   - **GraphicMama:** prohíbe expresamente los "avatar builders".
   - **Freepik (ahora Magnific):** prohíbe usar el contenido en videojuegos cuando es el "elemento principal". En caso de duda, lo considera principal.
3. **Las tiendas de assets para juegos tienen licencias mucho más limpias** que los bancos de stock: CraftPix, gamedeveloperstudio.com, GameDev Market, Kenney (CC0) y Unity Asset Store (sirve fuera de Unity).
4. **El estudio más completo en un solo estilo es Game Developer Studio (Robert Brooks).** Tiene interiores, cocina, baño, tienda, comida, exteriores, estaciones, GUI y personajes, todo sin IA. Su estilo es cartoon casual, no kawaii, y **su licencia hay que leerla antes de comprar**.
5. **Recomendación estratégica:**
   - **Fase 1 (prototipo, unos 100–150 USD):** assets comprados en tiendas de juego y CC0.
   - **Fase 2 (producción):** encargar a un ilustrador una guía de estilo y el **kit de avatar propio**, con cesión total de derechos. El kit de avatar es el corazón del juego. Si es propio, se evitan las cláusulas anti-avatar-builder, los topes de descargas y el parecido con Toca o Avatar World.

---

## 2. Licencias por plataforma

| Plataforma | Juego comercial compilado | Atribución | Riesgos clave | Veredicto |
|---|---|---|---|---|
| **Kenney** | Sí (CC0) | No | Ninguno | ✅ Seguro |
| **CraftPix** | Sí: "You can sell and distribute games with our assets" | No | ⚠️ *"An app that allows the user to save or export a modified version of the artwork itself is not fine"*. Esto importa si el jugador puede exportar o compartir su avatar como imagen. Lo descargado sigue siendo tuyo tras cancelar. | ✅ Seguro (sin exportar arte) |
| **gamedeveloperstudio.com** | Sí: multiproyecto, sin topes, apps con anuncios permitidas | No | Prohíbe NFT y plantillas de juego para reventa. Licencia leída solo parcialmente. | ✅ Seguro (verificar el texto) |
| **GameDev Market (Pro Licence)** | Sí, incluidos IAP y anuncios. Proyectos ilimitados. | No | ⚠️ **Cláusula 7.2:** los derechos sobre tus **modificaciones** pasan al vendedor. Prohíbe que el usuario pueda extraer el asset. | 🟡 Con condiciones |
| **Unity Asset Store (EULA estándar)** | Sí. **No exige usar Unity.** | No | ⚠️ El asset no puede ser una "substantial portion" del producto. ⚠️ **2.2.1.1(c):** necesitas autorización para monetizar assets en productos cuyo propósito principal es **crear contenido generado por el usuario**; un sandbox puede entrar ahí. Evita los assets "Restricted" o con Unity Companion License. Los "Extension Assets" están limitados a 2 PCs. | 🟡 Con condiciones |
| **itch.io** | Depende de cada autor | Depende | Si no hay texto de licencia, cuenta como no apto. Guarda una captura o PDF de la licencia. | 🟡 Con condiciones |
| **Gumroad** | Depende de cada autor | Depende | Exige una licencia escrita que mencione juegos. | 🟡 Con condiciones |
| **Envato Market / GraphicRiver** | Sí, con licencia **Extended** si hay IAP o el juego es de pago | No | Una licencia por producto final. Prohíbe el "build it yourself". | 🟡 Solo para UI y fondos; 🔴 para piezas personalizables |
| **Envato Elements** | Sí, registrando cada item por proyecto | No | La licencia solo vale si el producto se **termina con la suscripción activa**. Prohíbe el "build it yourself". **Sus fuentes no se pueden incrustar en apps.** | 🔴 Riesgoso |
| **Freepik / Magnific** | No si el asset es el "main element" | Sí en el plan gratis | Cláusula del elemento principal. Mucho contenido está generado con IA. Sus fuentes no se pueden incrustar. | 🔴 Riesgoso; ❌ para arte central |
| **Creative Market** | Solo con **Extended**: 1 título y hasta 250.000 descargas | No | Tope de descargas. Prohíbe la personalización por el usuario. | 🔴 Riesgoso |
| **Vecteezy** | Free: no. Pro Standard: máximo 1.000 unidades. Pro Business: sí. | Sí en Free | Prohíbe diseños "on-demand". Al cancelar hay que borrar lo descargado. Sus fuentes no se pueden incrustar. | ❌ Free / 🔴 Pro Standard / 🟡 Pro Business |
| **Adobe Stock** | Standard, ambiguo: la audiencia es ilimitada en apps móviles, pero prohíbe productos cuyo "valor principal" sea el asset. **Extended** es claro. | No | El **audio** requiere siempre la Audio Extended. | 🟡 Con Extended |
| **Shutterstock** | Probablemente sí (Standard o Enhanced) *(sin verificar: página bloqueada)* | No | Los agentes encontraron datos contradictorios sobre si hace falta la Enhanced. | 🟡 Verificar antes |
| **Iconscout** | Ambiguo: "Mobile App" está permitido, pero "Games" figura como merchandise *(sin verificar)* | — | Preguntar a soporte. | 🔴 Riesgoso |
| **OpenGameArt** | CC0: sí. OGA-BY: sí, con créditos. | Según la licencia | CC-BY puede chocar con el DRM de las tiendas. CC-BY-SA y GPL no sirven para una app cerrada. | ✅ CC0 / 🟡 OGA-BY / ❌ GPL y SA |
| **GraphicMama** | — | — | Prohíbe los "avatar builders". | ❌ Descartar |
| **Blush.design** | — | — | Prohíbe competir con su servicio, y un creador de avatares compite *(sin verificar)*. | ❌ Descartar |

**Reglas generales:**
- Evita los assets marcados como "AI Assisted": el arte generado con IA puede no tener copyright y la titularidad queda débil.
- Evita licencias NC (no comerciales), ND (sin modificaciones), GPL y CC-BY-SA.
- Evita la música registrada en Content ID, porque generaría reclamaciones en tus tráilers.

---

## 3. Assets recomendados por categoría

### 3.1 Personajes y avatares

| Asset | Autor / tienda | Precio | Licencia | Estilo | Notas |
|---|---|---|---|---|---|
| [Modular Characters](https://kenney.nl/assets/modular-characters) | Kenney | Gratis | CC0 | 3 | **Para el prototipo.** SVG por categoría (cara, pelo, camisas, pantalones, zapatos), extremidades separadas y varios tonos de piel. Proporciones adultas y aspecto antiguo. |
| [2D Cute Customizable Characters](https://assetstore.unity.com/packages/2d/characters/2d-cute-customizable-characters-287229) | tsakura (Unity) | $20 | Unity EULA | **4** | Lo más cercano al género: chibi frontal con 3 tonos de piel. Descarga de 2,6 MB, así que la resolución probablemente es baja. Verificar si es un "Extension Asset". |
| [Children Avatar Creator Kit](https://creativemarket.com/insemar/6371757-Children-Avatar-Creator-Kit) | insemar (Creative Market) | $80 (Extended) | CM Extended | 3-4 | Solo cabeza y busto. Tope de 250.000 descargas y cláusula de personalización. **Solo como referencia.** |
| [Build a Character](https://maellemarylloup.itch.io/chibi-character-basics-reworked) | MaelleMarylloup (itch) | Paga lo que quieras | Texto informal del autor | 3 | 45 cuerpos con 29 colores de piel y un PSD en capas. Baja resolución (444×700). |
| [Pet Pack 1–4](https://layerlab.itch.io/2d-character-pet-pack1) | LAYERLAB | $19.99 cada uno | LayerLab (máx. 5 usuarios) | 3 | Mascotas con animación en Spine. Requiere licencia de Spine. Pocas mascotas son "reales". |
| [Woman / Man Character Mega Pack](https://gamedeveloperstudio.itch.io/woman-character-mega-pack) | Robert Brooks (GDS) | $20 cada uno | Propia de GDS | 3 | Personajes con rig de Spriter. Probablemente en vista lateral. |
| [Kawaii Face Creator](https://gamedeveloperstudio.itch.io/kawaii-face-creator-pack) | Robert Brooks (GDS) | $5 | Propia de GDS | 4 | Más de 50 caras kawaii en SVG. Útiles para objetos con cara o NPC. |
| Estilos Lorelei, Notionists y Big Smile de [DiceBear](https://www.dicebear.com/licenses/) | Varios | Gratis | CC0 / CC BY 4.0 | 3 | Solo avatares de perfil en SVG, compatibles con react-native-svg. |

**Descartados:**
- Character Creation Kit (Envato), por la cláusula "build it yourself".
- GraphicMama, que prohíbe los avatar builders.
- Luma Forge (Unity), porque parece generado con IA y no lo declara.
- Serie de dress-up de Igor Galochkin: estilo "fashion doll" semirrealista, no Toca.
- Personajes de CraftPix y GameArt2D: casi todos son de plataformas en vista lateral.

### 3.2 Interiores, muebles y objetos

| Asset | Autor / tienda | Precio | Licencia | Estilo | Notas |
|---|---|---|---|---|---|
| [Home Interior Mega Pack](https://gamedeveloperstudio.itch.io/home-interior-mega-pack) | GDS | $25 | GDS | 3-4 | **Base principal.** Sofás, camas, lámparas y cuadros. Vectorial, con PNG y variantes de color. Confirmar que la vista sea frontal: existe otro pack en vista cenital. |
| [Bathroom Interior Pack](https://gamedeveloperstudio.itch.io/bathroom-interior-environement-design-pack) | GDS | $19.95 | GDS | 3-4 | Más de 85 props vectoriales. |
| [Side View Kitchen Mega Prop Pack](https://gamedeveloperstudio.itch.io/side-view-kitchen-interior-mega-prop-pack) | GDS | $12 | GDS | 3 | Cocina en SVG y PNG. |
| [Mega Cooking Game Environment](https://gamedeveloperstudio.itch.io/mega-cooking-game-environment-pack) | GDS | $25 | GDS | 3-4 | Restaurante: hornos, ollas, platos y electrodomésticos animables. |
| [2D Shop Interior Construction Kit](https://www.gamedevmarket.net/asset/2d-shop-interior-scene-construction-kit) | GDS (GDM) | ? | GDM Pro | 3-4 | Tienda o supermercado. |
| Burger / Pizza / Sushi / Vegetable packs | GDS | $10–20 | GDS | 3 | Comida vectorial. |
| Glitch: [Furniture SVG](https://opengameart.org/content/glitch-furniture-svg) y [Food & Drink SVG](https://opengameart.org/content/glitch-food-drink-items-svg) | Tiny Speck | Gratis | **CC0** | 3-4 | Más de 10.000 assets. Estilo pictórico de fantasía muy reconocible. No usar la marca "Glitch". |
| [Furniture set cartoon style](https://sungraphica.itch.io/furniture-set-cartoon-style) | SunGraphica | Gratis | CC BY 4.0 (con créditos) | 3 | AI, SVG y PNG. |
| [Food and drink pack](https://sungraphica.itch.io/food-and-drinks-pack) | SunGraphica | Paga lo que quieras | Comercial, con créditos | 3-4 | Muy amplio. |
| [Cozy Bakery & Food](https://jimal-art.itch.io/bakery-food-asset-pack-vector) | Jimal | Paga lo que quieras | Comercial, con créditos | 4 | Sin IA. |
| [Cartoon food icons](https://www.gamedevmarket.net/asset/cartoon-food-icons-game-set-5328) | Chuchilko (GDM) | $4 | GDM Pro | 4 | 25 comidas en 4 variantes. |
| Packs de habitación de UpadlySzczurek ([salón](https://assetstore.unity.com/packages/2d/environments/2d-living-room-furniture-pack-214326), cocina, baño…) | Unity Asset Store | $4.99 cada uno | Unity EULA | 3 | **Cómpralos en Unity**, no en itch, donde no tienen licencia. PNG de baja resolución. |
| Fondos de habitación (dormitorio infantil, salón, aula) | alexdndz (Envato / Vecteezy) | Suscripción | Envato / Vecteezy Pro Business | 4 | Buen estilo. Obliga a pasar por Vecteezy Pro Business, y hay que despiezar los objetos. |
| "Cartoon interior creating set" (cocina, dormitorio, baño) | Yuliya Pauliukevich (Vecteezy) | Pro Business | Vecteezy | **4** | Muebles sueltos para montar habitaciones. En el plan Free no se permiten productos para reventa. |

**Descartados:**
- Casi todo el catálogo de interiores de CraftPix, porque es pixel art o vista cenital.
- Packs de comida "AI Assisted" (AuraSoft, Coffee Beans Studio).
- vfrabasil, porque su estética es adulta.
- Freepik (upklyak, brgfx), por la cláusula del elemento principal. brgfx vale la pena revisarlo en Shutterstock o Adobe con licencia Extended.

### 3.3 Exteriores, mundo y parallax

| Asset | Autor / tienda | Precio | Licencia | Estilo | Notas |
|---|---|---|---|---|---|
| [Cartoon City 2D Backgrounds](https://craftpix.net/product/cartoon-city-2d-backgrounds/) | CraftPix | $5.50 | CraftPix | 4 | 4 momentos del día. Vectorial, en capas de parallax y con loop horizontal. |
| [City Street Background Tiles](https://craftpix.net/product/city-street-game-background-tiles/) | CraftPix | $5.50 | CraftPix | 3-4 | Modular, para generar calles largas. Confirmar que no sea pixel art. |
| [Free Cartoon Parallax](https://craftpix.net/freebies/free-cartoon-parallax-2d-backgrounds/) y [Free Beach](https://craftpix.net/freebies/free-beach-2d-game-backgrounds/) | CraftPix | Gratis | CraftPix | 4 | Capas de cielo, colinas y playa. |
| [Landscape parallax sets](https://craftpix.net/sets/landscape-cartoon-parallax-backgrounds/) (sky, forest, snowy, ocean) | CraftPix | $5.50 cada uno | CraftPix | 4 | Para estaciones y naturaleza. |
| Background Creator Mega Pack | GDS | $25 | GDS | 3-4 | Más de 45 capas tileables. PNG y SVG. |
| City scene mega pack | GDS | $19.95 | GDS | 3-4 | Filtrar lo que sea vista lateral: hay mucho en vista cenital. |
| Mega farm pack | GDS | $8.25 | GDS | 3-4 | Granja. |
| Cutesy background mega pack | GDS | $8 | GDS | 4 | 9 fondos pastel (unicornios, arcoíris, dulces). Para la pantalla de carga o de menú. |
| [Parallax Town Background](https://assetstore.unity.com/packages/2d/environments/parallax-town-background-72025) | Eremid (Unity) | $4.99 | Unity EULA | 3-4 | 30 casas y scroll infinito. Pack antiguo, solo PNG. |
| [Background Elements Remastered](https://kenney.nl/assets/background-elements-remastered) | Kenney | Gratis | CC0 | 3 | Relleno de capas lejanas. |
| [Level Map Backgrounds](https://craftpix.net/product/level-map-2d-game-backgrounds/) | CraftPix | $5.50 | CraftPix | 3 | Base para el mapa del mundo. Mejor encargarlo a medida. |

**A evitar:**
- vowxstudios (GDM): vendedor sin historial, activo desde junio de 2026.
- Packs de itch sin licencia: Askariot, v.rozenfeld, MarwaMJ.
- upklyak (Freepik), por la cláusula del elemento principal.

### 3.4 Interfaz, iconos y efectos visuales

| Asset | Autor / tienda | Precio | Licencia | Estilo | Notas |
|---|---|---|---|---|---|
| [Casual GUI](https://uncogames.itch.io/casual-gui) | Unco Games (Unity) | Ver ficha | Unity EULA | **5** | Pastel y cute. Más de 70 iconos, 3 temas, PNG y SVG, sin IA. |
| [Cartoon Games GUI Pack 18](https://www.gamedevmarket.net/asset/cartoon-games-gui-pack-18-1096) | pzUH (GDM) | $20 | GDM Pro | 4-5 | "Cute, colorful… kids". |
| [Kids Fantasy Game GUI](https://craftpix.net/freebies/kids-fantasy-game-gui/) | CraftPix | Gratis | CraftPix | 4 | AI, PSD y PNG. |
| [UI Pack 2.0](https://kenney.nl/assets/ui-pack) | Kenney | Gratis | CC0 | 3 | 430 elementos en SVG. Hay que recolorearlos. |
| [2D MEGA 450+ Icon Pack](https://www.gamedevmarket.net/asset/2d-mega-450-icon-pack) | dkaratas962 (GDM) | $12 | GDM Pro | 4 | Comida, ropa, monedas. |
| [Particle Pack](https://kenney.nl/assets/particle-pack) y [Smoke Particles](https://kenney.nl/assets/smoke-particles) | Kenney | Gratis | CC0 | 3 | Chispas y nubes de "poof", para usar con Skia o Reanimated. |
| [Cartoon VFX Essentials / Mega](https://cartooncoffee.itch.io/megapack-spritesheets) | CartoonCoffee | $98 (mega) | Texto del autor, comercial | 4 | Muy pesado para móvil. Usar solo lo necesario. |

**Falta:** no hay iconos de muebles ni de ubicaciones con estética dollhouse. Hay que encargarlos.

### 3.5 Audio

| Asset | Precio | Licencia | Notas |
|---|---|---|---|
| Kenney: [Interface Sounds](https://kenney.nl/assets/interface-sounds), UI Audio y Digital Audio | Gratis | CC0 | Clics, pops y monedas. |
| [Cute & Cozy UI SFX](https://caseportman.itch.io/cute-cozy-ui-sfx) (Case Portman) | £4.99+ | Comercial, sin reventa | **Estilo 5.** Más de 200 efectos con variantes, sin IA. |
| [Casual Fun Game Music Pack](https://www.gamedevmarket.net/asset/casual-fun-game-music-pack) (SkyhammerSound) | $20 | GDM Pro | **Música principal.** 26 pistas con ukelele y marimba. |
| [Happy Casual Music Pack](https://morphonaut.itch.io/happy-casual-music-pack) | $3+ | Comercial en juegos | 8 loops. |
| [Sonniss #GameAudioGDC](https://sonniss.com/gdc-bundle-license/) | Gratis | Propia, sin atribución | Ambientes de cocina, parque y foley. |
| Freesound (**solo CC0**) / Pixabay Audio | Gratis | CC0 / Pixabay | Guardar un comprobante de cada descarga. |

**No usar:**
- Epidemic Sound y Artlist: solo cubren apps con planes Enterprise o Max.
- Música de Adobe Stock sin la Audio Extended.
- Kids Games Music Pack: está registrado en Content ID.

### 3.6 Fuentes

- **Recomendadas:** **Fredoka**, **DynaPuff** y **Baloo 2**. Otras que también encajan: Nunito, Quicksand, Sniglet, Lilita One y Grandstander.
- Todas tienen licencia OFL 1.1 y se cargan con `expo-font`. Incluye el `OFL.txt` en la pantalla de créditos.
- Chewy y Luckiest Guy usan licencia Apache 2.0: incluye también su aviso de licencia.
- **No uses fuentes de Envato Elements, Freepik ni Vecteezy.** Sus licencias prohíben incrustarlas en apps.

---

## 4. Estudios con varios packs en el mismo estilo

| Estudio | Personajes | Interiores | Comida | Exteriores | UI | Licencia | Encaje |
|---|---|---|---|---|---|---|---|
| **Game Developer Studio (Robert Brooks)** | ✓ (vista lateral) | ✓✓ | ✓ | ✓ | ✓ | Buena (sin atribución) | Cartoon casual 3-4 — **mejor opción base** |
| **CraftPix** | Vista lateral | ✗ (pixel) | ✓ | ✓✓ | ✓ | La mejor, salvo la cláusula de exportar arte | 4 en fondos |
| **LAYERLAB** | ✓ (RPG) | Parcial | — | ✓ | ✓✓ | Máx. 5 usuarios + Spine | Casual móvil 3 |
| **SunGraphica** | ✓ | ✓ | ✓ | ✓ | ✓ | CC BY / con créditos | 3 |
| **Kenney** | ✓ | — | — | ✓ | ✓ | CC0 | Variable 3 |
| **Glitch (CC0)** | Avatares | ✓✓ | ✓✓ | ✓ | — | CC0 | Pictórico 3-4 |
| Yuliya Pauliukevich / alexdndz / brgfx (stock) | ✓ | ✓✓ | ✓ | ✓ | — | Stock (licencia cara o con riesgo) | **4-5**, la mejor estética |

---

## 5. Plan recomendado

### Fase 1: prototipo (unos 100–150 USD)
1. **Personajes:** Kenney Modular Characters. Sirve para montar ya el sistema de capas y de rig con `react-native-svg` o `@shopify/react-native-skia`. Añadir tsakura ($20) como prueba de estilo.
2. **Interiores:** GDS Home Interior Mega Pack, Bathroom y Kitchen (unos $57).
3. **Comida:** Chuchilko ($4) y los packs de comida de SunGraphica.
4. **Exteriores:** membresía anual de CraftPix (unos $24–48/año según la oferta), con fondos de ciudad, cielo y playa.
5. **UI:** Unco Casual GUI o pzUH GUI Pack 18, más los packs de Kenney.
6. **Audio:** SkyhammerSound ($20), Cute & Cozy SFX (£5) y Kenney.
7. **Fuentes:** Fredoka y Baloo 2.

### Fase 2: identidad propia (producción)
Encargar a un ilustrador (en ArtStation, Behance, Fiverr Pro o Upwork), con **contrato de cesión total de derechos (work for hire)**:
- Guía de estilo: paleta, grosor de línea, proporciones y sombreado.
- **Kit de avatar:** 3 edades, 6 o más tonos de piel, piezas intercambiables y rig. **Es la pieza más importante.**
- Mapa del mundo y fachadas únicas (escuela, hospital, café).
- Iconos de ubicaciones y de categorías de muebles.
- Repintar o unificar los packs comprados, respetando sus licencias de modificación. Ojo: en GameDev Market (cláusula 7.2), los derechos sobre esas modificaciones pasan al vendedor.

### Registro de licencias (obligatorio)
Crear `assets/LICENSES/` con un archivo por asset que incluya:
- URL y autor.
- Fecha de compra y número de pedido.
- Tipo de licencia.
- Captura o PDF del texto de la licencia en la fecha de compra.

---

## 6. Qué verificar antes de comprar

1. Mirar las previews de todos los packs para confirmar el estilo, la resolución y la vista frontal o lateral.
2. Leer https://www.gamedeveloperstudio.com/license.php, que no se pudo abrir durante la investigación.
3. **Unity EULA 2.2.1.1(c)** (contenido generado por el usuario): pedir aclaración a Unity o al vendedor.
4. **CraftPix:** si el juego permitirá guardar o compartir capturas de avatares y casas, preguntar si eso cuenta como "export a modified version of the artwork".
5. **Shutterstock:** leer "Using Images in software, apps and video games" y confirmar si hace falta la licencia Standard o la Enhanced.
6. Precios de la licencia Extended en GraphicRiver, en el checkout.
7. Confirmar si los packs de tsakura y UpadlySzczurek son "Extension Assets".
8. Autores de itch sin licencia escrita: pedir confirmación por email y guardarla.

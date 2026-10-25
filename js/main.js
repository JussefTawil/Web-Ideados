(function () {
  "use strict"; // Modo estricto: evita errores silenciosos

  /* ==========================================================
   * 1. CONFIGURACIÓN (lo único que normalmente hay que editar)
   * ========================================================== */
  const CONFIG = Object.freeze({
    whatsapp: "56930227946",  // +56 9 3022 7946. Solo dígitos, con código de país
    moneda: "$",                // Peso chileno (CLP)
    carpetaImagenes: "images/productos/", // Dónde están las fotos de productos
    extensionImagen: "jpg",     // Cambiar a "webp" o "png" si el diseñador entrega otro formato
    locale: "es-CL"
  });

  // Catálogo. tipo: "caja" (3 dimensiones) o "bolsa" (2 dimensiones).
  // En producción puede venir de un JSON o de una API; por eso se valida más abajo.
  const PRODUCTOS_RAW = [
    { id: "bolsas-papel", nombre: "Bolsas de papel", descripcion: "Para tiendas y entregas", tipo: "bolsa", cantidadMedidas: 6, precioBase: 900 },
    { id: "cajas-autoarmables", nombre: "Cajas autoarmables", descripcion: "Se arman sin pegamento", tipo: "caja", cantidadMedidas: 30, precioBase: 1800 },
    { id: "cajas-embalaje", nombre: "Cajas de embalaje", descripcion: "Para envíos y mudanzas", tipo: "caja", cantidadMedidas: 15, precioBase: 2200 },
    { id: "cajas-kraft", nombre: "Cajas Kraft", descripcion: "Cartón kraft natural", tipo: "caja", cantidadMedidas: 8, precioBase: 1500 },
    { id: "cajas-duplex", nombre: "Cajas dúplex", descripcion: "Cartón con cara blanca", tipo: "caja", cantidadMedidas: 8, precioBase: 1700 },
    { id: "cajas-almohada", nombre: "Cajas almohada", descripcion: "Para regalos y accesorios", tipo: "caja", cantidadMedidas: 6, precioBase: 800 },
    { id: "bolsas-tela", nombre: "Bolsas de tela", descripcion: "Reutilizables", tipo: "bolsa", cantidadMedidas: 6, precioBase: 1200 },
    { id: "sacos-tela", nombre: "Sacos de tela", descripcion: "Con cordón", tipo: "bolsa", cantidadMedidas: 5, precioBase: 1100 },
    { id: "bolsas-tnt", nombre: "Bolsas de TNT", descripcion: "Tela no tejida", tipo: "bolsa", cantidadMedidas: 6, precioBase: 600 },
    { id: "sacos-kraft", nombre: "Sacos Kraft", descripcion: "Papel kraft resistente", tipo: "bolsa", cantidadMedidas: 6, precioBase: 1400 },
    { id: "doypacks", nombre: "Doypacks", descripcion: "Bolsa con base y cierre", tipo: "bolsa", cantidadMedidas: 6, precioBase: 700 },
    { id: "sobres-kraft", nombre: "Sobres Kraft", descripcion: "Para documentos y envíos", tipo: "bolsa", cantidadMedidas: 6, precioBase: 400 }
  ];

  // Anchos base (cm) usados para generar medidas de ejemplo.
  const DIMS = [10, 12, 15, 18, 20, 22, 25, 28, 30, 32, 35, 38, 40, 42, 45, 48, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130];

  /* ==========================================================
   * 2. UTILIDADES
   * ========================================================== */

  /** Busca un elemento y falla con un mensaje claro si no existe. */
  function $(selector) {
    const nodo = document.querySelector(selector);
    if (!nodo) throw new Error("No se encontró el elemento: " + selector);
    return nodo;
  }

  /**
   * Crea un elemento DOM de forma segura (usa textContent, nunca innerHTML),
   * así los datos del catálogo no pueden inyectar HTML ni scripts (XSS).
   * @param {string} tag  Etiqueta HTML.
   * @param {Object} [attrs]  Atributos; "text" = texto; "onclick" etc. = eventos.
   * @param {Array<Node|string>} [hijos]
   */
  function h(tag, attrs, hijos) {
    const nodo = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      const v = attrs[k];
      if (k === "text") nodo.textContent = v;
      else if (k.indexOf("on") === 0) nodo.addEventListener(k.slice(2), v);
      else nodo.setAttribute(k, v);
    });
    (hijos || []).forEach(function (c) {
      nodo.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return nodo;
  }

  /** Muestra un aviso temporal. tipo: "info" | "error". */
  let toastTimer = null;
  function avisar(mensaje, tipo) {
    const t = $("#toast");
    t.textContent = mensaje;
    t.style.background = tipo === "error" ? "#b3261e" : "";
    t.style.color = tipo === "error" ? "#fff" : "";
    t.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.display = "none"; }, 4500);
  }

  /** Formatea precios. Si Intl falla, usa un formato simple de respaldo. */
  function formatearPrecio(n) {
    try {
      return CONFIG.moneda + new Intl.NumberFormat(CONFIG.locale).format(n);
    } catch (e) {
      return CONFIG.moneda + String(n);
    }
  }

  /** Devuelve el enlace de WhatsApp con mensaje, o null si el número no es válido. */
  function urlWhatsApp(mensaje) {
    if (!/^\d{8,15}$/.test(CONFIG.whatsapp)) {
      console.error("Número de WhatsApp inválido en CONFIG.whatsapp");
      return null;
    }
    return "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(mensaje);
  }

  /* ==========================================================
   * 3. DATOS: validación y generación de medidas
   * ========================================================== */

  /** Descarta productos con datos incorrectos en lugar de romper toda la página. */
  function validarProductos(lista) {
    const ids = new Set();
    return lista.filter(function (p) {
      const ok = p && typeof p.id === "string" && !ids.has(p.id) &&
        typeof p.nombre === "string" && p.nombre.length > 0 &&
        (p.tipo === "caja" || p.tipo === "bolsa") &&
        Number.isInteger(p.cantidadMedidas) && p.cantidadMedidas > 0 && p.cantidadMedidas <= DIMS.length &&
        Number.isFinite(p.precioBase) && p.precioBase > 0;
      if (ok) ids.add(p.id);
      else console.warn("Producto inválido omitido:", p);
      return ok;
    });
  }
    function placeholderProducto(p) {
      const colores = ["#d9c4a5", "#c8d8cf", "#d8cce5", "#e7c9bb", "#c6d8df", "#e3d5ad"];
      const indice = Array.from(p.id).reduce(function (total, letra) { return total + letra.charCodeAt(0); }, 0) % colores.length;
      const color = colores[indice];
      const lateral = ["#bca17e", "#a7bcb1", "#b6a8c8", "#c99f91", "#9fbac3", "#c5b37f"][indice];
      let empaque;

      if (p.tipo === "caja") {
        empaque = '<path d="M188 231 391 175l90 48-205 62z" fill="#f5f1e8"/><path d="m391 175 90 48v211l-90-51z" fill="' + lateral + '"/><path d="m188 231 203-56v208l-203 55z" fill="' + color + '"/><path d="m188 231 203 56v96l-203 55z" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="4"/><path d="m391 231 25 7v34l-25-7z" fill="#f4ead7" opacity=".9"/><path d="m220 282 135-37" stroke="#fff" stroke-opacity=".45" stroke-width="4"/>';
      } else if (p.id.indexOf("sobres-") === 0) {
        empaque = '<path d="m162 238 229-64 87 49-227 67z" fill="#f7f2e8"/><path d="m162 238 89 52v166l-89-54z" fill="' + lateral + '"/><path d="m251 290 227-67v179l-227 54z" fill="' + color + '"/><path d="m251 290 112 74-112 92z" fill="#f1e6d2" opacity=".86"/><path d="m478 223-115 141" stroke="#fff" stroke-opacity=".55" stroke-width="4"/>';
      } else if (p.id === "doypacks") {
        empaque = '<path d="m213 210 217-40 29 47-21 216-211 30-35-53z" fill="' + color + '"/><path d="m213 210 217-40-27 47-187 34z" fill="#f5f1e8"/><path d="m231 251 197-35" stroke="' + lateral + '" stroke-width="7"/><path d="m257 401 177-24 25 56-211 30z" fill="' + lateral + '"/><path d="M265 303h139" stroke="#fff" stroke-opacity=".6" stroke-width="4"/><path d="M265 324h112" stroke="#fff" stroke-opacity=".6" stroke-width="4"/>';
      } else if (p.id.indexOf("sacos-") === 0) {
        empaque = '<path d="m231 217 177-24 31 55-14 215-210 2-14-208z" fill="' + color + '"/><path d="m231 217 177-24-15 35-151 20z" fill="#f4efe5"/><path d="M233 253 426 230M222 427l211 0" stroke="' + lateral + '" stroke-width="6"/><path d="M247 293h168M244 313h174M242 333h178" stroke="#fff" stroke-opacity=".42" stroke-width="3"/><path d="M250 220v-19m138-1v18" stroke="' + lateral + '" stroke-width="6"/>';
      } else {
        empaque = '<path d="M236 224v-37c0-34 25-59 57-59s57 25 57 59v31" fill="none" stroke="' + lateral + '" stroke-width="15"/><path d="M189 222h218l-15 241H204z" fill="' + color + '"/><path d="m189 222 35 24v210l-20 7z" fill="' + lateral + '"/><path d="M224 275h146" stroke="#fff" stroke-opacity=".58" stroke-width="4"/><path d="M224 291h112" stroke="#fff" stroke-opacity=".58" stroke-width="4"/><path d="M204 449h188" stroke="#fff" stroke-opacity=".38" stroke-width="4"/>';
      }

      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><rect width="640" height="640" fill="#eeece7"/><ellipse cx="326" cy="490" rx="155" ry="24" fill="#27231f" opacity=".1"/><g filter="drop-shadow(0 16px 14px #0002)">' + empaque + '</g></svg>';
      return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }


  /** Genera medidas y precios de ejemplo. Sustituir por datos reales del cliente. */
  function generarMedidas(p) {
    const medidas = [];
    for (let i = 0; i < p.cantidadMedidas; i++) {
      const a = DIMS[i];
      const b = Math.round(a * (p.tipo === "caja" ? 0.8 : 1.3));
      const c = Math.round(a * 0.6);
      medidas.push({
        etiqueta: p.tipo === "caja" ? a + "×" + b + "×" + c + " cm" : a + "×" + b + " cm",
        precio: Math.round((p.precioBase * (1 + i * 0.18)) / 10) * 10
      });
    }
    return medidas;
  }

  const PRODUCTOS = validarProductos(PRODUCTOS_RAW);

  /* ==========================================================
   * 4. ESTADO
   * ========================================================== */
  const state = {
    cat: "sin",        // "sin" = sin impresión, "con" = con impresión
    prodId: null,      // null = se muestra el catálogo
    query: "",
    medidaIdx: 0,
    unidades: 50
  };

  /* ==========================================================
   * 5. ACCIONES
   * ========================================================== */

  /* ==========================================================
   * 6. VISTAS
   * ========================================================== */

  /**
   * Imagen de un producto. El nombre del archivo es el id del producto:
   * images/productos/<id>.jpg (por ejemplo cajas-kraft.jpg).
  * Si el archivo no existe, se muestra una ilustración provisional del empaque.
   */
  function imagenProducto(p) {
    const img = h("img", {
      src: CONFIG.carpetaImagenes + p.id + "." + CONFIG.extensionImagen,
      alt: p.nombre, loading: "lazy", decoding: "async"
    });
    let usandoPlaceholder = false;
    img.addEventListener("error", function () {
      if (usandoPlaceholder) { img.remove(); return; }
      usandoPlaceholder = true;
      img.src = placeholderProducto(p);
    });
    return h("div", { class: "ph" }, ["Foto del producto", img]);
  }

  function montarDestacados() {
    const showcase = $("#hero-showcase");
    const shell = showcase.parentElement;
    const orbit = $("#showcase-orbit");
    const track = h("div", { class: "showcase-track" });
    const grupo = h("div", { class: "showcase-group" });
    const repeticion = h("div", { class: "showcase-group", "aria-hidden": "true" });
    const orbitCards = [];
    const rutaOrbita = [1, 3, 4, 6, 5, 2];
    let indicePosicion = 0;
    const ultimaDireccionPorProducto = new Map(PRODUCTOS.map(function (p, i) {
      return [p.id, i % 2 === 0 ? -1 : 1];
    }));

    // Alterna el último giro de cada producto y mantiene los vecinos en sentidos opuestos.
    function variarPosicion(card) {
      const slot = Number(card.dataset.orbitSlot);
      const inclinacion = Number(card.dataset.orbitDirection);
      if (!inclinacion || slot < 1 || slot > 6) return;
      const haciaExterior = slot === 1 || slot === 2 ? -1 : slot === 5 || slot === 6 ? 1 : 0;
      const desplazamientoX = haciaExterior
        ? haciaExterior * (3 + Math.random() * 4)
        : (Math.random() - 0.5) * 10;
      card.style.setProperty("--orbit-shift-x", desplazamientoX.toFixed(1) + "px");
      card.style.setProperty("--orbit-shift-y", ((Math.random() - 0.5) * 18).toFixed(1) + "px");
      card.style.setProperty("--orbit-angle", (inclinacion * (9 + Math.random() * 7)).toFixed(1) + "deg");
    }

    function tarjeta(p, clase, oculta) {
      const attrs = {
        class: clase, type: "button", "data-product-id": p.id,
        "aria-label": "Ver " + p.nombre
      };
      if (oculta) Object.assign(attrs, { tabindex: "-1", "aria-hidden": "true" });
      return h("button", attrs, [imagenProducto(p), h("strong", { text: p.nombre })]);
    }

    PRODUCTOS.forEach(function (p, i) {
      grupo.appendChild(tarjeta(p, "featured-card feature-" + (i % 4 + 1), false));
      repeticion.appendChild(tarjeta(p, "featured-card feature-" + (i % 4 + 1), true));
    });

    PRODUCTOS.slice(0, 6).forEach(function (p, i) {
      const card = tarjeta(p, "featured-card orbit-card orbit-" + (i + 1), false);
      card.dataset.orbitSlot = String(rutaOrbita[i]);
      card.dataset.orbitDirection = String(-ultimaDireccionPorProducto.get(p.id));
      ultimaDireccionPorProducto.set(p.id, Number(card.dataset.orbitDirection));
      variarPosicion(card);
      orbitCards.push(card);
      orbit.appendChild(card);
    });

    track.appendChild(grupo);
    track.appendChild(repeticion);
    showcase.replaceChildren(track);
    const anterior = shell.querySelector(".showcase-arrow.previous");
    const siguiente = shell.querySelector(".showcase-arrow.next");

    const reducirMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const escritorio = window.matchMedia("(min-width: 761px)");
    let pausaManual = reducirMovimiento;
    let sobreCarrusel = false;
    let ultimoFrame = 0;
    let indiceRotacion = 0;

    function mover(direccion) {
      pausaManual = true;
      const tarjeta = grupo.querySelector(".featured-card");
      const espacio = parseFloat(getComputedStyle(grupo).columnGap) || 12;
      showcase.scrollBy({ left: direccion * (tarjeta.getBoundingClientRect().width + espacio), behavior: reducirMovimiento ? "auto" : "smooth" });
    }

    function animar(ahora) {
      const delta = ultimoFrame ? Math.min(ahora - ultimoFrame, 50) : 0;
      ultimoFrame = ahora;
      if (!pausaManual && !sobreCarrusel && !document.hidden && !escritorio.matches) {
        const ciclo = grupo.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap);
        showcase.scrollLeft += delta * 0.032;
        if (ciclo > 0 && showcase.scrollLeft >= ciclo) showcase.scrollLeft -= ciclo;
      }
      requestAnimationFrame(animar);
    }

    if (!reducirMovimiento) {
      window.setInterval(function () {
        if (!escritorio.matches || document.hidden || PRODUCTOS.length < 2) return;
        // Avanza un grupo completo para renovar los productos visibles en cada posición.
        indiceRotacion = (indiceRotacion + orbitCards.length) % PRODUCTOS.length;
        orbitCards.forEach(function (card, i) {
          const producto = PRODUCTOS[(indiceRotacion + i) % PRODUCTOS.length];
          card.classList.add("is-changing");
          card.dataset.orbitSlot = String(rutaOrbita[(i + indicePosicion + 1) % rutaOrbita.length]);
          card.dataset.orbitDirection = String(-ultimaDireccionPorProducto.get(producto.id));
          ultimaDireccionPorProducto.set(producto.id, Number(card.dataset.orbitDirection));
          variarPosicion(card);
          card.dataset.productId = producto.id;
          card.setAttribute("aria-label", "Ver " + producto.nombre);
          card.replaceChildren(imagenProducto(producto), h("strong", { text: producto.nombre }));
          window.setTimeout(function () { card.classList.remove("is-changing"); }, 180);
        });
        indicePosicion = (indicePosicion + 1) % rutaOrbita.length;
      }, 3200);
    }

    shell.addEventListener("click", function (ev) {
      const flecha = ev.target.closest(".showcase-arrow");
      if (flecha) {
        mover(flecha.classList.contains("next") ? 1 : -1);
        return;
      }
      const tarjeta = ev.target.closest(".featured-card");
      if (!tarjeta) return;
      pausaManual = true;
      const producto = PRODUCTOS.find(function (p) { return p.id === tarjeta.dataset.productId; });
      if (!producto) return;
      state.cat = "sin";
      state.prodId = producto.id;
      state.medidaIdx = 0;
      render({ enfocar: "titulo" });
    });
    shell.addEventListener("pointerdown", function () { pausaManual = true; });
    shell.addEventListener("touchstart", function () { pausaManual = true; }, { passive: true });
    shell.addEventListener("wheel", function () { pausaManual = true; }, { passive: true });
    shell.addEventListener("mouseenter", function () { sobreCarrusel = true; });
    shell.addEventListener("mouseleave", function () { sobreCarrusel = false; });
    shell.addEventListener("keydown", function (ev) {
      if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
      ev.preventDefault();
      mover(ev.key === "ArrowRight" ? 1 : -1);
    });
    if (!reducirMovimiento) requestAnimationFrame(animar);
  }

  /** Catálogo: una tarjeta por producto. */
  function vistaCatalogo(productos) {
    const grid = h("div", { class: "grid" });
    productos.forEach(function (p) {
      grid.appendChild(h("button", {
        class: "card", type: "button", "data-id": p.id,
        onclick: function () { state.prodId = p.id; state.medidaIdx = 0; render({ enfocar: "titulo" }); }
      }, [
        imagenProducto(p),
        h("b", { text: p.nombre }),
        h("small", { text: p.descripcion + " · " + p.cantidadMedidas + " medidas" })
      ]));
    });
    return grid;
  }

  /** Detalle: selector de medidas, precio y botón de compra o WhatsApp. */
  function vistaDetalle(p) {
    const medidas = generarMedidas(p);
    const idx = Math.min(state.medidaIdx, medidas.length - 1);
    const medida = medidas[idx];
    const conImpresion = state.cat === "con";
    const cantidadInput = h("input", {
      class: "quantity-input", id: "cantidad-unidades", type: "number",
      min: "50", max: "500", step: "50", value: String(state.unidades),
      readonly: "", "aria-readonly": "true", "aria-valuemin": "50",
      "aria-valuemax": "500", "aria-valuenow": String(state.unidades),
      "aria-describedby": "quantity-hint"
    });
    const restarUnidades = h("button", {
      class: "quantity-step", type: "button", "aria-label": "Restar 50 unidades", text: "−"
    });
    const sumarUnidades = h("button", {
      class: "quantity-step", type: "button", "aria-label": "Sumar 50 unidades", text: "+"
    });

    function urlPedido(unidades) {
      const verbo = conImpresion ? "cotizar" : "pedir";
      const impresion = conImpresion ? " con impresión" : "";
      return urlWhatsApp("Hola, quiero " + verbo + " " + p.nombre + impresion + ", medida " + medida.etiqueta + ", " + unidades + " unidades.");
    }

    function urlPedidoEspecial() {
      const impresion = conImpresion ? " con impresión" : "";
      return urlWhatsApp("Hola, necesito coordinar un pedido personalizado o superior a 500 unidades de " + p.nombre + impresion + ", medida " + medida.etiqueta + ".");
    }

    const botonesMedida = medidas.map(function (m, i) {
      return h("button", {
        class: "size", type: "button", "aria-pressed": String(i === idx), text: m.etiqueta,
        onclick: function () { state.medidaIdx = i; render({ enfocar: "medida" }); }
      });
    });

    let precio, accion;
    if (conImpresion) {
      precio = h("div", { class: "price", style: "font-size:1.3rem", text: "Precio a cotizar" });
      const url = urlPedido(state.unidades);
      accion = url
        ? h("a", { class: "btn wa order-link", href: url, target: "_blank", rel: "noopener noreferrer", text: "Cotizar por WhatsApp" })
        : h("p", { class: "note", text: "WhatsApp no está disponible por ahora. Inténtalo más tarde." });
    } else {
      precio = h("div", { class: "price", text: formatearPrecio(medida.precio) }, [
        h("small", { style: "font-size:1rem;font-weight:400;color:var(--muted)", text: " por unidad" })
      ]);
      const url = urlPedido(state.unidades);
      accion = url
        ? h("a", { class: "btn wa order-link", href: url, target: "_blank", rel: "noopener noreferrer", text: "Pedir por WhatsApp" })
        : h("p", { class: "note", text: "WhatsApp no está disponible por ahora. Inténtalo más tarde." });
    }

    const especialUrl = urlPedidoEspecial();
    const pedidoEspecial = especialUrl
      ? h("a", { class: "custom-order-link", href: especialUrl, target: "_blank", rel: "noopener noreferrer", text: "¿Pedido personalizado o superior a 500 unidades?" })
      : h("p", { class: "note", text: "WhatsApp no está disponible por ahora." });

    function actualizarUnidades(cantidad) {
      state.unidades = Math.max(50, Math.min(500, cantidad));
      cantidadInput.value = String(state.unidades);
      cantidadInput.setAttribute("aria-valuenow", String(state.unidades));
      restarUnidades.disabled = state.unidades === 50;
      sumarUnidades.disabled = state.unidades === 500;

      const pedidoUrl = urlPedido(state.unidades);
      if (accion.classList && accion.classList.contains("order-link")) {
        accion.href = pedidoUrl || "#";
        accion.setAttribute("aria-disabled", String(!pedidoUrl));
      }
      const especialActualizado = urlPedidoEspecial();
      if (pedidoEspecial.tagName === "A") pedidoEspecial.href = especialActualizado || "#";
    }

    restarUnidades.addEventListener("click", function () { actualizarUnidades(state.unidades - 50); });
    sumarUnidades.addEventListener("click", function () { actualizarUnidades(state.unidades + 50); });
    actualizarUnidades(state.unidades);

    if (accion.classList && accion.classList.contains("order-link")) {
      accion.addEventListener("click", function (ev) {
        if (!cantidadInput.validity.valid || !Number.isInteger(Number(cantidadInput.value))) {
          ev.preventDefault();
          cantidadInput.reportValidity();
          cantidadInput.focus();
        }
      });
    }

    return h("div", {}, [
      h("button", { class: "back", type: "button", text: "Volver a productos", onclick: function () { state.prodId = null; render({ enfocar: "titulo" }); } }),
      h("div", { class: "detail" }, [
        imagenProducto(p),
        h("div", {}, [
          h("h2", { id: "titulo-detalle", tabindex: "-1", style: "margin-bottom:4px", text: p.nombre }),
          h("div", { style: "color:var(--muted)", text: p.descripcion + (conImpresion ? " · con impresión" : " · sin impresión") }),
          h("div", { class: "label", text: "Medida" }),
          h("div", { class: "sizes" }, botonesMedida),
          h("div", { class: "quantity-field" }, [
            h("label", { class: "label", for: "cantidad-unidades", text: "Unidades" }),
            h("div", { class: "quantity-control" }, [restarUnidades, cantidadInput, sumarUnidades]),
            h("small", { id: "quantity-hint", class: "field-help", text: "De 50 en 50 · mínimo 50 · máximo 500 unidades" })
          ]),
          // Precio + acción agrupados: en celular quedan fijos abajo (ver CSS .buybar)
          h("div", { class: "buybar" }, [
            precio,
            h("p", { class: "note-text", style: "color:var(--muted);margin:0 0 16px", text: conImpresion ? "Revisamos tu diseño y condiciones contigo por WhatsApp." : "Medida seleccionada: " + medida.etiqueta }),
            h("div", { class: "order-actions" }, [accion, pedidoEspecial])
          ])
        ])
      ])
    ]);
  }

  /** Vista de respaldo si algo falla al dibujar: la página no queda en blanco. */
  function vistaError() {
    return h("div", { role: "alert" }, [
      h("p", { text: "No pudimos mostrar los productos." }),
      h("button", { class: "btn", type: "button", text: "Reintentar", onclick: function () { state.prodId = null; render(); } })
    ]);
  }

  /* ==========================================================
   * 7. RENDER PRINCIPAL
   * ========================================================== */

  /** Dibuja la sección de productos según el estado. opciones.enfocar mueve el foco (accesibilidad). */
  function render(opciones) {
    const vista = $("#view");
    try {
      document.querySelectorAll(".tab").forEach(function (b) {
        b.setAttribute("aria-selected", String(b.dataset.cat === state.cat));
      });
      $("#note").textContent = state.query
        ? "Resultados para \"" + state.query + "\""
        : state.cat === "sin"
        ? "Elige el producto y la medida, y paga directo en la web."
        : "Cada pedido con impresión se revisa contigo por WhatsApp antes de producirlo.";

      if (PRODUCTOS.length === 0) {
        vista.replaceChildren(h("p", { text: "El catálogo no está disponible por ahora." }));
        return;
      }
      // Si el producto guardado en el estado ya no existe, volvemos al catálogo.
      const producto = PRODUCTOS.find(function (p) { return p.id === state.prodId; });
      if (state.prodId !== null && !producto) state.prodId = null;

      const consulta = state.query.trim().toLocaleLowerCase();
      const productos = PRODUCTOS.filter(function (p) {
        return (p.nombre + " " + p.descripcion).toLocaleLowerCase().indexOf(consulta) !== -1;
      });
      if (!producto && productos.length === 0) {
        vista.replaceChildren(h("p", { class: "empty", role: "status", text: "No encontramos productos con ese nombre." }));
        return;
      }
      vista.replaceChildren(producto ? vistaDetalle(producto) : vistaCatalogo(productos));

      // Gestión de foco para teclado y lectores de pantalla.
      if (opciones && opciones.enfocar === "medida") {
        const activa = vista.querySelector('.size[aria-pressed="true"]');
        if (activa) activa.focus({ preventScroll: true });
      } else if (opciones && opciones.enfocar === "titulo") {
        const t = document.getElementById("titulo-detalle") || $("#productos h2");
        t.setAttribute("tabindex", "-1");
        irA("productos");                      // al abrir un producto o volver, quedar al inicio de la sección
        t.focus({ preventScroll: true });
      }
    } catch (e) {
      console.error("Error al dibujar el catálogo:", e);
      vista.replaceChildren(vistaError());
    }
  }

  /* ==========================================================
   * 8. EVENTOS E INICIO
   * ========================================================== */

  function cerrarMenu() {
    $("#nav").classList.remove("open");
    $("#burger").setAttribute("aria-expanded", "false");
  }

  /** Altura de la barra superior fija, para que no tape el título de la sección. */
  function alturaCabecera() {
    const cab = document.querySelector("header");
    return cab ? cab.offsetHeight : 0;
  }

  let animacionScroll = null; // id de la animación en curso (null = ninguna)

  /** Cancela la animación para que el usuario recupere el control al tocar o usar la rueda. */
  function cancelarAnimacion() {
    if (animacionScroll !== null) { cancelAnimationFrame(animacionScroll); animacionScroll = null; }
  }

  /** Respeta a quienes pidieron menos animaciones en su dispositivo (accesibilidad). */
  function prefiereMenosMovimiento() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  /**
   * Lleva la pantalla hasta una sección con un desplazamiento suave (sube o baja).
   * Animación propia con requestAnimationFrame: velocidad pareja y arranque/frenado suaves.
   * Duración según la distancia: entre 0,5 y 1,1 segundos.
   */
  function irA(id) {
    const destino = document.getElementById(id);
    if (!destino) return;
    cancelarAnimacion();

    const inicio = window.pageYOffset;
    const y = id === "inicio" ? 0 : Math.max(0, destino.getBoundingClientRect().top + inicio - alturaCabecera());
    const distancia = y - inicio;
    if (Math.abs(distancia) < 2) return; // ya estamos ahí

    if (prefiereMenosMovimiento()) { window.scrollTo(0, y); return; }

    const duracion = Math.min(1100, Math.max(500, Math.abs(distancia) * 0.45));
    const t0 = performance.now();
    let verificado = false;

    function paso(ahora) {
      const t = Math.min(1, (ahora - t0) / duracion);
      const suave = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
      window.scrollTo(0, inicio + distancia * suave);

      // Respaldo: si la página no se movió (algunos visores embebidos), usar el scroll suave nativo.
      if (!verificado && t > 0.15) {
        verificado = true;
        if (Math.abs(window.pageYOffset - inicio) < 1) {
          animacionScroll = null;
          try { destino.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { window.scrollTo(0, y); }
          return;
        }
      }
      animacionScroll = t < 1 ? requestAnimationFrame(paso) : null;
    }
    animacionScroll = requestAnimationFrame(paso);
  }

  /** Resalta en el menú la sección que se está viendo (si el navegador lo soporta). */
  function resaltarSeccionActual() {
    const destino = { inicio: "inicio", nosotros: "inicio", productos: "productos", contacto: "contacto" };
    const secciones = Object.keys(destino).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    let pendiente = false;

    function actualizar() {
      const cabecera = alturaCabecera();
      const umbral = cabecera + (window.innerHeight - cabecera) * 0.65;
      let activo = "inicio";
      secciones.forEach(function (sec) {
        if (sec.getBoundingClientRect().top <= umbral) activo = destino[sec.id];
      });
      document.querySelectorAll("nav a").forEach(function (a) {
        if (a.getAttribute("href") === "#" + activo) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
    }

    window.addEventListener("scroll", function () {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () {
        actualizar();
        pendiente = false;
      });
    });
    window.addEventListener("resize", actualizar);
    actualizar();
  }

  function iniciar() {
    montarDestacados();

    // Pestañas de categoría
    document.querySelectorAll(".tab").forEach(function (b) {
      b.addEventListener("click", function () {
        state.cat = b.dataset.cat;
        render();
        if (b.closest(".hero-tabs")) irA("productos");
      });
    });
    const buscador = $("#product-search");
    buscador.addEventListener("input", function () {
      state.query = this.value;
      state.prodId = null;
      render();
    });
    $("#search-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      irA("productos");
    });
    // Botones del inicio que eligen categoría
    document.querySelectorAll("[data-go]").forEach(function (a) {
      a.addEventListener("click", function () { state.cat = a.dataset.go; state.prodId = null; render(); });
    });
    // Menú hamburguesa (móvil)
    $("#burger").addEventListener("click", function () {
      const abierto = $("#nav").classList.toggle("open");
      this.setAttribute("aria-expanded", String(abierto));
    });
    document.querySelectorAll("nav a").forEach(function (a) { a.addEventListener("click", cerrarMenu); });
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") cerrarMenu(); });

    // Navegación del menú, el logo y los botones del inicio: suben o bajan hasta la sección indicada.
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (ev) {
        const id = a.getAttribute("href").slice(1);
        if (!document.getElementById(id)) return; // Enlace desconocido: comportamiento normal
        ev.preventDefault();
        cerrarMenu();
        // Si estaba viendo un producto y va a "Productos", vuelve al catálogo.
        if (id === "productos" && state.prodId !== null) { state.prodId = null; render(); }
        irA(id);
      });
    });
    resaltarSeccionActual();
    // Si la persona toca, usa la rueda o el teclado mientras se desplaza, se detiene la animación.
    ["wheel", "touchstart", "keydown"].forEach(function (tipo) {
      window.addEventListener(tipo, cancelarAnimacion, { passive: true });
    });

    // Enlace general de WhatsApp en Contacto
    const enlace = urlWhatsApp("Hola, quisiera más información sobre sus empaques.");
    const wa = $("#wa-general");
    if (enlace) wa.href = enlace;
    else { wa.removeAttribute("href"); wa.setAttribute("aria-disabled", "true"); wa.textContent = "WhatsApp no disponible"; }

    render();
  }

  // Red de seguridad: errores no capturados se registran y avisan sin romper la página.
  window.addEventListener("error", function (ev) { console.error("Error no controlado:", ev.error || ev.message); });
  window.addEventListener("unhandledrejection", function (ev) {
    console.error("Promesa rechazada sin manejar:", ev.reason);
    avisar("Ocurrió un error inesperado. Inténtalo de nuevo.", "error");
  });

  try { iniciar(); }
  catch (e) {
    console.error("Error al iniciar la página:", e);
    const v = document.getElementById("view");
    if (v) v.textContent = "No pudimos cargar el catálogo. Recarga la página.";
  }
})();
